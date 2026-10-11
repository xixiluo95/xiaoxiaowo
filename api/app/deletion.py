"""五分钟数据删除（设定 §11）。

Q01 边界（待确认项，代码内标注）：按「任一端关闭即各自计时、重开取消」实现——
信标（beacon）上报关闭后开始倒计时；倒计时内任何会话活动（重开/聊天/读取）
取消倒计时；到期后接口/日历/旧分享链接一律 404/410。
删除对象：该 session 关联的日记、心情、快照、指南、风险事件等云端业务数据；
不删除代码、部署配置、静态素材。
"""
from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta

from .diary_service import finalize_diaries, now_iso


def _parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts)


def mark_closed(db: sqlite3.Connection, lock, session_id: str, delete_after_seconds: int) -> sqlite3.Row | None:
    """页面关闭信标：开始五分钟倒计时；会话结束即整理当天日记（路演不等零点）。"""
    with lock:
        row = db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
        if row is None or row["status"] == "deleted":
            return None
        now = datetime.now().astimezone()
        delete_at = (now + timedelta(seconds=delete_after_seconds)).isoformat(timespec="seconds")
        db.execute(
            "UPDATE sessions SET status = 'closing', close_started_at = ?, delete_at = ? WHERE id = ?",
            (now.isoformat(timespec="seconds"), delete_at, session_id),
        )
        db.commit()
    finalize_diaries(db, lock, session_id=session_id)
    with lock:
        return db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()


def resume(db: sqlite3.Connection, lock, session_id: str) -> sqlite3.Row | None | str:
    """重新打开：倒计时内取消计时；已到期则先清除再返回 'deleted'。"""
    purge_if_expired(db, lock, session_id)
    with lock:
        row = db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
        if row is None:
            return None
        if row["status"] == "deleted":
            return "deleted"
        db.execute(
            "UPDATE sessions SET status = 'active', close_started_at = NULL, delete_at = NULL,"
            " last_active_at = ? WHERE id = ?",
            (now_iso(), session_id),
        )
        db.commit()
        return db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()


def purge_if_expired(db: sqlite3.Connection, lock, session_id: str) -> bool:
    with lock:
        row = db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
        if row is None or row["status"] != "closing" or not row["delete_at"]:
            return False
        if _parse(row["delete_at"]) > datetime.now().astimezone():
            return False
    purge_session(db, lock, session_id)
    return True


def purge_expired(db: sqlite3.Connection, lock) -> list[str]:
    with lock:
        rows = db.execute(
            "SELECT id, delete_at FROM sessions WHERE status = 'closing' AND delete_at IS NOT NULL"
        ).fetchall()
    now = datetime.now().astimezone()
    purged = [r["id"] for r in rows if _parse(r["delete_at"]) <= now]
    for sid in purged:
        purge_session(db, lock, sid)
    return purged


def purge_session(db: sqlite3.Connection, lock, session_id: str) -> None:
    """到期清除该 session 全部云端业务数据。sessions 保留墓碑行使旧请求得到 410。"""
    with lock:
        diary_ids = [
            r["id"]
            for r in db.execute(
                "SELECT id FROM daily_diaries WHERE subject_id = ?", (session_id,)
            ).fetchall()
        ]
        for did in diary_ids:
            db.execute("DELETE FROM diary_blocks WHERE diary_id = ?", (did,))
            db.execute("DELETE FROM diary_versions WHERE diary_id = ?", (did,))
            db.execute("DELETE FROM shared_snapshots WHERE diary_id = ?", (did,))
        db.execute("DELETE FROM daily_diaries WHERE subject_id = ?", (session_id,))
        db.execute("DELETE FROM emotion_events WHERE session_id = ?", (session_id,))
        db.execute("DELETE FROM mood_confirmations WHERE session_id = ?", (session_id,))
        db.execute("DELETE FROM risk_events WHERE session_id = ?", (session_id,))
        db.execute("DELETE FROM parent_bindings WHERE session_id = ?", (session_id,))
        db.execute(
            "UPDATE sessions SET status = 'deleted', deleted_at = ?, delete_at = NULL,"
            " close_started_at = NULL, current_character = 'none' WHERE id = ?",
            (now_iso(), session_id),
        )
        db.commit()
