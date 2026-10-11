"""对话编排：DeepSeek 一次调用 → 回复 + 情绪决策 → 会话状态/日记/事件/风险。"""
from __future__ import annotations

import sqlite3

from . import diary_service, safety


async def process_message(app_state, session_id: str, text: str) -> dict:
    db: sqlite3.Connection = app_state.db
    lock = app_state.db_lock

    history = app_state.histories.setdefault(session_id, [])
    decision = await app_state.deepseek.complete(history, text)
    history.append({"role": "user", "content": text})
    history.append({"role": "assistant", "content": decision["reply"]})
    del history[:-24]  # 仅在内存保留短上下文，聊天内容不落库（设定 §11）

    emo = decision["emotion"]
    today = diary_service.local_today()
    now = diary_service.now_iso()

    # 情绪含糊时不强判：保持当前角色
    with lock:
        session = db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
        character = session["current_character"]
        if not emo["ambiguous"]:
            character = emo["primary"]
            db.execute(
                "UPDATE sessions SET current_character = ?, last_active_at = ? WHERE id = ?",
                (character, now, session_id),
            )
        else:
            db.execute("UPDATE sessions SET last_active_at = ? WHERE id = ?", (now, session_id))
        db.commit()

    # 值得记录的内容写入当天唯一日记（普通闲聊计入正文但不计票）
    event_id = None
    if emo["diaryEligible"]:
        diary = diary_service.get_or_create_today(db, lock, session_id, today)
        event_id = diary_service.insert_emotion_event(
            db, lock, session_id, diary["id"], today,
            emo["primary"], emo["countsForStats"],
            emo["eventSummary"], emo["riskLevel"],
        )
        diary_service.append_ai_block(db, lock, diary["id"], event_id, emo["eventSummary"])

    # 风险事件独立于日记链；指南生成门槛在查询层（medium 起）
    risk_event_id = None
    if emo["riskLevel"] in ("low", "medium", "high"):
        family = emo.get("familyRisk") or {}
        risk_event_id = safety.record_risk_event(
            db, lock, session_id, today, emo["riskLevel"], emo["eventSummary"],
            family.get("involvesParentPerpetrator", False),
            family.get("perpetratorIdentityClear", True),
        )

    return {
        "reply": decision["reply"],
        "emotion": {
            "primary": emo["primary"],
            "confidence": emo["confidence"],
            "ambiguous": emo["ambiguous"],
            "diaryEligible": emo["diaryEligible"],
            "riskLevel": emo["riskLevel"],
            "eventSummary": emo["eventSummary"],
        },
        "character": character,
        "eventId": event_id,
        "riskEventId": risk_event_id,
        "date": today,
    }
