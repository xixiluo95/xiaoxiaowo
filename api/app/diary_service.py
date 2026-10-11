"""日记与事件服务：每日唯一日记、锁定块保护、事件删除重算、不可变快照、情绪占比。"""
from __future__ import annotations

import hashlib
import json
import secrets
import sqlite3
import uuid
from datetime import datetime

EMOTION_ORDER = ["joy", "anger", "sadness", "fear", "calm"]


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def local_today() -> str:
    return datetime.now().astimezone().date().isoformat()


def _new_id() -> str:
    return uuid.uuid4().hex


def get_or_create_today(db: sqlite3.Connection, lock, subject_id: str, local_date: str) -> sqlite3.Row:
    """UNIQUE(subject_id, local_date) 保证同一自然日最多一篇日记。"""
    with lock:
        now = now_iso()
        db.execute(
            "INSERT OR IGNORE INTO daily_diaries (id, subject_id, local_date, status, created_at, updated_at)"
            " VALUES (?, ?, ?, 'live', ?, ?)",
            (_new_id(), subject_id, local_date, now, now),
        )
        db.commit()
        return db.execute(
            "SELECT * FROM daily_diaries WHERE subject_id = ? AND local_date = ?",
            (subject_id, local_date),
        ).fetchone()


def get_diary(db: sqlite3.Connection, subject_id: str, local_date: str) -> sqlite3.Row | None:
    return db.execute(
        "SELECT * FROM daily_diaries WHERE subject_id = ? AND local_date = ?",
        (subject_id, local_date),
    ).fetchone()


def append_ai_block(db: sqlite3.Connection, lock, diary_id: str, event_id: str | None, text: str) -> str:
    """AI 只追加新块；永不修改 source=user 或 locked=1 的块。"""
    with lock:
        row = db.execute(
            "SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM diary_blocks WHERE diary_id = ?",
            (diary_id,),
        ).fetchone()
        block_id = _new_id()
        now = now_iso()
        db.execute(
            "INSERT INTO diary_blocks (id, diary_id, event_id, source, locked, text, position, created_at, updated_at)"
            " VALUES (?, ?, ?, 'ai', 0, ?, ?, ?, ?)",
            (block_id, diary_id, event_id, text, row["pos"], now, now),
        )
        db.execute("UPDATE daily_diaries SET updated_at = ? WHERE id = ?", (now, diary_id))
        db.commit()
        return block_id


def list_blocks(db: sqlite3.Connection, diary_id: str) -> list[dict]:
    rows = db.execute(
        "SELECT id, event_id, source, locked, text, position, created_at, updated_at"
        " FROM diary_blocks WHERE diary_id = ? ORDER BY position",
        (diary_id,),
    ).fetchall()
    return [
        {
            "id": r["id"],
            "eventId": r["event_id"],
            "source": r["source"],
            "locked": bool(r["locked"]),
            "text": r["text"],
            "position": r["position"],
        }
        for r in rows
    ]


def user_edit_block(db: sqlite3.Connection, lock, block_id: str, subject_id: str, text: str) -> dict | None:
    """孩子修改块内容 → 置 locked，AI 后续不得覆盖。"""
    with lock:
        row = db.execute(
            "SELECT b.* FROM diary_blocks b JOIN daily_diaries d ON d.id = b.diary_id"
            " WHERE b.id = ? AND d.subject_id = ?",
            (block_id, subject_id),
        ).fetchone()
        if row is None:
            return None
        now = now_iso()
        db.execute(
            "UPDATE diary_blocks SET text = ?, locked = 1, source = 'user', updated_at = ? WHERE id = ?",
            (text, now, block_id),
        )
        db.commit()
        return {"id": block_id, "text": text, "locked": True, "source": "user"}


def insert_emotion_event(
    db: sqlite3.Connection,
    lock,
    session_id: str,
    diary_id: str,
    local_date: str,
    primary: str,
    counts_for_stats: bool,
    summary: str,
    risk_level: str,
) -> str:
    with lock:
        event_id = _new_id()
        db.execute(
            "INSERT INTO emotion_events"
            " (id, session_id, diary_id, local_date, primary_emotion, counts_for_stats, summary, risk_level, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (event_id, session_id, diary_id, local_date, primary,
             1 if counts_for_stats else 0, summary, risk_level, now_iso()),
        )
        db.commit()
        return event_id


def delete_event(db: sqlite3.Connection, lock, session_id: str, event_id: str) -> dict | None:
    """删除事件：软删 emotion_event → 移除可检索块 → 重算情绪占比。

    不得被后续生成补回：编排器只追加新事件，软删的事件永不复活。
    risk_events 独立于日记删除链，此处不动。
    """
    with lock:
        row = db.execute(
            "SELECT * FROM emotion_events WHERE id = ? AND session_id = ? AND deleted_at IS NULL",
            (event_id, session_id),
        ).fetchone()
        if row is None:
            return None
        db.execute("UPDATE emotion_events SET deleted_at = ? WHERE id = ?", (now_iso(), event_id))
        db.execute("DELETE FROM diary_blocks WHERE event_id = ?", (event_id,))
        db.commit()
    return heart_status(db, session_id, row["local_date"])


def emotion_stats(db: sqlite3.Connection, session_id: str, local_date: str) -> dict:
    """每事件一主情绪等权计票；普通日常记录（counts_for_stats=0）不计票。"""
    rows = db.execute(
        "SELECT primary_emotion, COUNT(*) AS c FROM emotion_events"
        " WHERE session_id = ? AND local_date = ? AND deleted_at IS NULL AND counts_for_stats = 1"
        " GROUP BY primary_emotion",
        (session_id, local_date),
    ).fetchall()
    return {r["primary_emotion"]: r["c"] for r in rows}


def heart_status(db: sqlite3.Connection, session_id: str, local_date: str) -> dict:
    """心情心脏：有计票事件按最高占比（并列多色渐变）；否则看孩子是否主动确认；
    未确认与已确认平静是两个状态（未确认=白）。"""
    votes = emotion_stats(db, session_id, local_date)
    if votes:
        top_count = max(votes.values())
        top = [e for e in EMOTION_ORDER if votes.get(e) == top_count]
        return {"state": "confirmed", "colors": top, "gradient": len(top) > 1, "votes": votes}
    conf = db.execute(
        "SELECT emotion FROM mood_confirmations WHERE session_id = ? AND local_date = ?",
        (session_id, local_date),
    ).fetchone()
    if conf:
        return {"state": "confirmed", "colors": [conf["emotion"]], "gradient": False, "votes": {}}
    return {"state": "unconfirmed", "colors": [], "gradient": False, "votes": {}}


def confirm_mood(db: sqlite3.Connection, lock, session_id: str, local_date: str, emotion: str) -> dict:
    with lock:
        db.execute(
            "INSERT INTO mood_confirmations (id, session_id, local_date, emotion, created_at)"
            " VALUES (?, ?, ?, ?, ?)"
            " ON CONFLICT(session_id, local_date) DO UPDATE SET emotion = excluded.emotion, created_at = excluded.created_at",
            (_new_id(), session_id, local_date, emotion, now_iso()),
        )
        db.commit()
    return heart_status(db, session_id, local_date)


def finalize_diaries(
    db: sqlite3.Connection,
    lock,
    session_id: str | None = None,
    local_date: str | None = None,
) -> dict:
    """零点/会话结束整理：live → final_draft。幂等：重跑不产生第二篇、不重复 finalize。"""
    sql = "SELECT * FROM daily_diaries WHERE status = 'live'"
    params: list = []
    if session_id:
        sql += " AND subject_id = ?"
        params.append(session_id)
    if local_date:
        sql += " AND local_date = ?"
        params.append(local_date)
    with lock:
        rows = db.execute(sql, params).fetchall()
        job_id = _new_id()
        now = now_iso()
        finalized = []
        for row in rows:
            cur = db.execute(
                "UPDATE daily_diaries SET status = 'final_draft', finalization_job_id = ?,"
                " finalized_at = ?, updated_at = ? WHERE id = ? AND status = 'live'",
                (job_id, now, now, row["id"]),
            )
            if cur.rowcount:
                finalized.append(row["id"])
        db.commit()
    return {"finalized": finalized, "jobId": job_id if finalized else None}


def confirm_diary(db: sqlite3.Connection, lock, session_id: str, local_date: str) -> sqlite3.Row | None:
    with lock:
        row = get_diary(db, session_id, local_date)
        if row is None:
            return None
        db.execute(
            "UPDATE daily_diaries SET status = 'confirmed', updated_at = ? WHERE id = ?",
            (now_iso(), row["id"]),
        )
        db.commit()
        return get_diary(db, session_id, local_date)


def share_diary(db: sqlite3.Connection, lock, session_id: str, local_date: str) -> dict | None:
    """生成独立不可变快照；分享后绝不 join live diary。"""
    with lock:
        diary = get_diary(db, session_id, local_date)
        if diary is None:
            return None
        blocks = list_blocks(db, diary["id"])
        text = "\n".join(b["text"] for b in blocks)
        stats = heart_status(db, session_id, local_date)
        version_row = db.execute(
            "SELECT COALESCE(MAX(version_no), 0) + 1 AS v FROM diary_versions WHERE diary_id = ?",
            (diary["id"],),
        ).fetchone()
        version = version_row["v"]
        now = now_iso()
        db.execute(
            "INSERT INTO diary_versions (id, diary_id, version_no, snapshot_json, created_at)"
            " VALUES (?, ?, ?, ?, ?)",
            (_new_id(), diary["id"], version,
             json.dumps({"text": text, "blocks": blocks}, ensure_ascii=False), now),
        )
        token = secrets.token_urlsafe(24)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        db.execute(
            "INSERT INTO shared_snapshots"
            " (id, diary_id, diary_version, text_snapshot, emotion_stats_snapshot, share_token_hash, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (_new_id(), diary["id"], version, text,
             json.dumps(stats, ensure_ascii=False), token_hash, now),
        )
        db.commit()
    return {"shareToken": token, "version": version, "diaryId": diary["id"]}


def get_snapshot_by_token(db: sqlite3.Connection, token: str) -> dict | None | str:
    """返回快照 dict；已撤回返回 'revoked'；不存在返回 None。只读快照列。"""
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    row = db.execute(
        "SELECT * FROM shared_snapshots WHERE share_token_hash = ?", (token_hash,)
    ).fetchone()
    if row is None:
        return None
    if row["revoked_at"]:
        return "revoked"
    return {
        "text": row["text_snapshot"],
        "emotionStats": json.loads(row["emotion_stats_snapshot"]),
        "version": row["diary_version"],
        "createdAt": row["created_at"],
    }


def revoke_snapshot(db: sqlite3.Connection, lock, token: str) -> bool:
    with lock:
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        cur = db.execute(
            "UPDATE shared_snapshots SET revoked_at = ? WHERE share_token_hash = ? AND revoked_at IS NULL",
            (now_iso(), token_hash),
        )
        db.commit()
        return cur.rowcount > 0


def revoke_snapshots_for_date(db: sqlite3.Connection, lock, session_id: str, local_date: str) -> int:
    """孩子端按天撤回：撤回该会话当天日记的全部有效分享快照（所有版本旧链接一并失效）。"""
    with lock:
        cur = db.execute(
            "UPDATE shared_snapshots SET revoked_at = ?"
            " WHERE revoked_at IS NULL AND diary_id IN"
            " (SELECT id FROM daily_diaries WHERE subject_id = ? AND local_date = ?)",
            (now_iso(), session_id, local_date),
        )
        db.commit()
        return cur.rowcount


def calendar_month(db: sqlite3.Connection, session_id: str, month: str) -> list[dict]:
    """儿童端心情日历月视图：逐日日记有无、心情颜色（并列最高多色，未确认空）。"""
    rows = db.execute(
        "SELECT * FROM daily_diaries WHERE subject_id = ? AND local_date LIKE ? ORDER BY local_date",
        (session_id, f"{month}-%"),
    ).fetchall()
    days = []
    for row in rows:
        heart = heart_status(db, session_id, row["local_date"])
        blocks = db.execute(
            "SELECT COUNT(*) AS c FROM diary_blocks WHERE diary_id = ?", (row["id"],)
        ).fetchone()["c"]
        confirmed = heart["state"] == "confirmed"
        days.append({
            "date": row["local_date"],
            "hasDiary": blocks > 0,
            "moodConfirmed": confirmed,
            "colors": heart["colors"] if confirmed else [],
        })
    return days


def list_shared_snapshots(db: sqlite3.Connection, session_id: str, local_date: str | None = None) -> list[dict]:
    sql = (
        "SELECT s.*, d.local_date AS diary_date FROM shared_snapshots s"
        " JOIN daily_diaries d ON d.id = s.diary_id"
        " WHERE d.subject_id = ? AND s.revoked_at IS NULL"
    )
    params: list = [session_id]
    if local_date:
        sql += " AND d.local_date = ?"
        params.append(local_date)
    sql += " ORDER BY s.created_at"
    rows = db.execute(sql, params).fetchall()
    return [
        {
            "id": r["id"],
            "date": r["diary_date"],
            "version": r["diary_version"],
            "text": r["text_snapshot"],
            "emotionStats": json.loads(r["emotion_stats_snapshot"]),
            "createdAt": r["created_at"],
        }
        for r in rows
    ]
