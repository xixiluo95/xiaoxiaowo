"""家长端聚合查询：单日内容（心情心脏 + 已分享日记快照 + 行动指南）与月历概览。

家长端只读，读取不取消孩子的删除计时（由路由层 purge 已到期会话）。
心情未确认一律白色（confirmed=False、colors 空），与已确认平静区分（§7/Q06）。
"""
from __future__ import annotations

import sqlite3

from . import diary_service, safety
from .diary_service import EMOTION_ORDER


def _votes_to_stats(votes: dict) -> list[dict]:
    return [
        {"emotion": e, "count": votes[e]}
        for e in EMOTION_ORDER
        if votes.get(e)
    ]


def _normalize_stats(raw) -> list[dict]:
    """快照里的 emotion_stats_snapshot 存的是 heart_status JSON（含 votes）；
    对外统一为 [{emotion, count}] 等权计票数组。"""
    if isinstance(raw, dict):
        return _votes_to_stats(raw.get("votes") or {})
    if isinstance(raw, list):
        return raw
    return []


def _map_guidance(entry: dict) -> dict:
    """safety.list_guidance 的单条记录 → 家长端卡片结构（概述简短、行动为主体）。"""
    g = entry["guidance"]
    return {
        "id": entry["riskEventId"],
        "riskLevel": entry["level"],
        "levelName": entry["levelName"],
        "eventBrief": g["eventSummary"],
        "actions": g["suggestedActions"],
        "openingLines": g["openingLines"],
        "avoid": g["avoidSaying"],
        "followUps": g["followUpQuestions"],
        "watchOut": g["observationAndHelp"],
    }


def _shared_diary_guidance(snapshot: dict) -> dict:
    """只使用孩子已分享的快照生成日常指南，不读取后续私人日记或风险事件。"""
    stats = _normalize_stats(snapshot["emotionStats"])
    suggestions = {
        "joy": "请孩子挑一件开心的事讲给您听，具体回应他/她付出的努力，一起庆祝。",
        "anger": "先听孩子说完生气的原因，回应感受，等平静后再一起商量一个小办法。",
        "sadness": "给孩子一点陪伴和安静的时间，先问他/她想聊聊、抱抱，还是一起待一会儿。",
        "fear": "先询问孩子现在是否安心，尊重他/她愿意讲的范围，一起想想需要怎样的支持。",
        "calm": "找一个轻松的时刻，邀请孩子聊聊今天印象最深的一件小事。",
    }
    actions = ["先感谢孩子愿意分享日记，留出几分钟专心听，不急着评价或给答案。"]
    for emotion in dict.fromkeys(s["emotion"] for s in stats):
        if emotion in suggestions:
            actions.append(suggestions[emotion])
    actions.append("让孩子选择一件希望您一起做的小事，并约好一个方便的时间。")
    return {
        "riskEventId": f"shared-{snapshot['id']}",
        "date": snapshot["date"],
        "level": "none",
        "levelName": "日常陪伴",
        "guidance": {
            "eventSummary": "孩子主动分享了这篇日记，可以从感谢分享、倾听感受和一起做一件小事开始。",
            "suggestedActions": actions,
            "openingLines": ["谢谢你愿意把日记分享给我。里面哪件事最想和我聊聊？", "你希望我先听你说，还是和你一起想办法？"],
            "avoidSaying": ["这有什么好说的。", "你应该听我的。", "别人都能做到，你怎么不行？"],
            "followUpQuestions": ["现在回想这件事，你的感觉有变化吗？", "明天有什么小事是你希望我们一起做的？"],
            "observationAndHelp": "下次见面时轻轻问候这件事，尊重孩子不想继续聊的选择；分享的日记只用于理解和陪伴，不转发或用来批评孩子。",
        },
        "recipients": [],
        "createdAt": snapshot["createdAt"],
    }


def list_guidance(db: sqlite3.Connection, session_id: str, local_date: str | None = None,
                  binding_id: str | None = None) -> list[dict]:
    """保留可见的风险指南；每个有分享但无风险指南的日期补充日常陪伴指南。"""
    entries = safety.list_guidance(db, session_id, local_date, binding_id)
    risk_dates = {entry["date"] for entry in entries}
    latest = {s["date"]: s for s in diary_service.list_shared_snapshots(db, session_id, local_date)}
    entries.extend(_shared_diary_guidance(s) for date, s in latest.items() if date not in risk_dates)
    return sorted(entries, key=lambda entry: entry["createdAt"])


def _mood_payload(heart: dict) -> dict:
    confirmed = heart["state"] == "confirmed"
    return {
        "confirmed": confirmed,
        "colors": heart["colors"] if confirmed else [],
        "gradient": bool(heart.get("gradient")) if confirmed else False,
        "stats": _votes_to_stats(heart.get("votes") or {}),
    }


def day_content(db: sqlite3.Connection, session_id: str, local_date: str) -> dict:
    """家长端某一天可见的全部内容。未分享日记绝不出现；指南按接收人规则过滤。"""
    heart = diary_service.heart_status(db, session_id, local_date)

    shared = None
    snaps = diary_service.list_shared_snapshots(db, session_id, local_date)
    if snaps:
        s = snaps[-1]  # 同一天多次分享时展示最新一版快照
        shared = {
            "id": s["id"],
            "date": s["date"],
            "text": s["text"],
            "emotionStats": _normalize_stats(s["emotionStats"]),
            "sharedAt": s["createdAt"],
        }

    guidances = list_guidance(db, session_id, local_date)
    guidance = _map_guidance(guidances[-1]) if guidances else None

    return {
        "date": local_date,
        "mood": _mood_payload(heart),
        "guidance": guidance,
        "sharedDiary": shared,
    }


def calendar_month(db: sqlite3.Connection, session_id: str, month: str) -> list[dict]:
    """月历概览：逐日心情颜色（并列最高多色）、是否有已分享日记、是否有行动指南。
    只返回保留期内有内容的日期；前端按日期索引，缺失即空白。"""
    like = f"{month}-%"
    dates: set[str] = set()
    for row in db.execute(
        "SELECT DISTINCT local_date FROM emotion_events"
        " WHERE session_id = ? AND local_date LIKE ? AND deleted_at IS NULL",
        (session_id, like),
    ).fetchall():
        dates.add(row["local_date"])
    for row in db.execute(
        "SELECT DISTINCT local_date FROM mood_confirmations"
        " WHERE session_id = ? AND local_date LIKE ?",
        (session_id, like),
    ).fetchall():
        dates.add(row["local_date"])
    for row in db.execute(
        "SELECT DISTINCT d.local_date FROM shared_snapshots s"
        " JOIN daily_diaries d ON d.id = s.diary_id"
        " WHERE d.subject_id = ? AND d.local_date LIKE ? AND s.revoked_at IS NULL",
        (session_id, like),
    ).fetchall():
        dates.add(row["local_date"])
    for row in db.execute(
        "SELECT DISTINCT local_date FROM risk_events"
        " WHERE session_id = ? AND local_date LIKE ? AND level IN ('medium', 'high')",
        (session_id, like),
    ).fetchall():
        dates.add(row["local_date"])

    days = []
    for date in sorted(dates):
        heart = diary_service.heart_status(db, session_id, date)
        mood = _mood_payload(heart)
        has_shared = bool(diary_service.list_shared_snapshots(db, session_id, date))
        has_guidance = has_shared or bool(safety.list_guidance(db, session_id, date))
        days.append({
            "date": date,
            "moodConfirmed": mood["confirmed"],
            "colors": mood["colors"],
            "hasSharedDiary": has_shared,
            "hasGuidance": has_guidance,
        })
    return days
