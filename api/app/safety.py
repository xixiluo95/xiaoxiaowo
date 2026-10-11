"""安全与风险：三级风险（普通冲突/疑似霸凌/明确危险）、家长行动指南、家庭风险接收人屏蔽。

设定 §8/§9/§10 硬规则：
- 疑似霸凌（medium）起才生成指南；普通冲突（low）不生成。
- 指南事件概述用不确定措辞且简短，主体是行动建议，不展示未分享日记全文。
- 涉及家长施害或身份不清 → 默认屏蔽全部家长推送；逐接收人明确排除后才允许发送。
- 发送权限与读取权限分开记录（Q03 主动读取是否屏蔽为待确认项）。
- 不明确通知时说"可能/疑似"；不在未送达时宣称已通知家长。
"""
from __future__ import annotations

import json
import sqlite3

from .diary_service import _new_id, now_iso

LEVEL_NAMES = {"low": "普通冲突", "medium": "疑似霸凌", "high": "明确危险"}
GUIDANCE_MIN_LEVEL = "medium"  # 疑似霸凌是行动指南的起始等级
ALLOWED_RELATIONS = ("爸爸", "妈妈", "爷爷", "奶奶", "姥姥", "姥爷")


def _guidance(level: str, summary: str) -> dict:
    """模板化指南：内容简短可执行，事件概述用不确定措辞，不以 AI 推断下诊断。"""
    short = summary[:30] if summary else "一些让他/她不舒服的事情"
    event_summary = f"孩子可能遇到了{short}，具体情况还不确定。"
    if level == "high":
        return {
            "eventSummary": event_summary,
            "suggestedActions": [
                "尽快找一个安静、不受打扰的时间和环境陪孩子",
                "先保证孩子当下的身体安全，再谈事情经过",
                "如确认存在明确危险，联系可信任的成年人、老师或专业机构",
            ],
            "openingLines": [
                "今天有没有发生什么让你不太舒服的事？愿意和我说说吗？",
                "不管发生什么，我都会站在你这边。",
            ],
            "avoidSaying": [
                "是不是你先惹人家的？",
                "这有什么大不了的。",
                "你为什么不早点说？",
            ],
            "followUpQuestions": [
                "那个时候你在哪里？有谁在旁边吗？",
                "你现在觉得安全吗？",
                "你希望谁帮你？",
            ],
            "observationAndHelp": "持续关注孩子的睡眠、食欲和上学意愿；如出现退缩、噩梦或身体不适，建议尽快联系老师或专业儿童心理/法律援助渠道。",
        }
    return {
        "eventSummary": event_summary,
        "suggestedActions": [
            "今天抽时间轻松地问一句，不要正式审问",
            "先听孩子说完，再回应情绪，最后才讨论办法",
        ],
        "openingLines": [
            "今天在学校有没有和谁闹别扭呀？",
            "我看到你今天好像有点不一样，想聊聊吗？",
        ],
        "avoidSaying": [
            "一个巴掌拍不响。",
            "你别理他就行了。",
            "小孩打闹很正常，别在意。",
        ],
        "followUpQuestions": [
            "这样的事情是第一次，还是发生过几次了？",
            "当时有老师或其他同学看到吗？",
            "你希望我怎么帮你？",
        ],
        "observationAndHelp": "连续几天观察孩子情绪变化；如果类似情况反复出现或升级，建议主动联系老师了解情况后决定下一步。",
    }


def record_risk_event(
    db: sqlite3.Connection,
    lock,
    session_id: str,
    local_date: str,
    level: str,
    summary: str,
    involves_parent_perpetrator: bool,
    perpetrator_identity_clear: bool,
) -> str:
    """记录风险事件（独立于日记删除链），并为每个绑定家长初始化接收权限。

    默认规则：涉及家长施害或身份不清 → 全部家长 send_allowed=0；
    否则默认允许发送。逐接收人排除由 exclude_recipient 处理。
    """
    default_blocked = involves_parent_perpetrator or not perpetrator_identity_clear
    with lock:
        risk_id = _new_id()
        now = now_iso()
        db.execute(
            "INSERT INTO risk_events"
            " (id, session_id, local_date, level, summary, involves_parent_perpetrator,"
            "  perpetrator_identity_clear, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (risk_id, session_id, local_date, level, summary,
             1 if involves_parent_perpetrator else 0,
             1 if perpetrator_identity_clear else 0, now),
        )
        bindings = db.execute(
            "SELECT id FROM parent_bindings WHERE session_id = ?", (session_id,)
        ).fetchall()
        for b in bindings:
            allowed = 0 if default_blocked else 1
            db.execute(
                "INSERT INTO risk_recipient_permissions"
                " (id, risk_event_id, binding_id, excluded_as_perpetrator, send_allowed, read_allowed, created_at)"
                " VALUES (?, ?, ?, 0, ?, ?, ?)",
                (_new_id(), risk_id, b["id"], allowed, allowed, now),
            )
        db.commit()
    return risk_id


def exclude_recipient(db: sqlite3.Connection, lock, risk_event_id: str, binding_id: str) -> bool:
    """逐接收人明确排除施害嫌疑后才允许发送；不影响其他接收人的屏蔽状态。"""
    with lock:
        cur = db.execute(
            "UPDATE risk_recipient_permissions"
            " SET excluded_as_perpetrator = 1, send_allowed = 1, read_allowed = 1"
            " WHERE risk_event_id = ? AND binding_id = ?",
            (risk_event_id, binding_id),
        )
        db.commit()
        return cur.rowcount > 0


def list_guidance(
    db: sqlite3.Connection,
    session_id: str,
    local_date: str | None = None,
    binding_id: str | None = None,
) -> list[dict]:
    """家长行动指南列表。普通冲突不生成指南；
    家庭风险屏蔽中的事件，只有明确排除后的接收人才能看到。"""
    sql = (
        "SELECT * FROM risk_events WHERE session_id = ? AND level IN ('medium', 'high')"
    )
    params: list = [session_id]
    if local_date:
        sql += " AND local_date = ?"
        params.append(local_date)
    sql += " ORDER BY created_at"
    events = db.execute(sql, params).fetchall()

    result = []
    for ev in events:
        perms = db.execute(
            "SELECT p.*, b.relation FROM risk_recipient_permissions p"
            " JOIN parent_bindings b ON b.id = p.binding_id WHERE p.risk_event_id = ?",
            (ev["id"],),
        ).fetchall()
        recipients = [
            {
                "bindingId": p["binding_id"],
                "relation": p["relation"],
                "sendAllowed": bool(p["send_allowed"]),
                "readAllowed": bool(p["read_allowed"]),
            }
            for p in perms
        ]
        if binding_id:
            mine = next((r for r in recipients if r["bindingId"] == binding_id), None)
            visible = bool(mine and mine["sendAllowed"])
        elif recipients:
            visible = any(r["sendAllowed"] for r in recipients)
        else:
            # 无绑定家长（路演单端演示）：未触发家庭屏蔽时可见
            visible = not (ev["involves_parent_perpetrator"] or not ev["perpetrator_identity_clear"])
        if not visible:
            continue
        g = _guidance(ev["level"], ev["summary"])
        result.append({
            "riskEventId": ev["id"],
            "date": ev["local_date"],
            "level": ev["level"],
            "levelName": LEVEL_NAMES[ev["level"]],
            "guidance": g,
            "recipients": recipients,
            "createdAt": ev["created_at"],
        })
    return result


def add_demo_binding(db: sqlite3.Connection, lock, session_id: str, relation: str) -> dict:
    """路演演示绑定（is_demo=1）。亲属身份必填，未填写不能完成绑定。"""
    if relation not in ALLOWED_RELATIONS:
        raise ValueError("relation_required")
    with lock:
        binding_id = _new_id()
        db.execute(
            "INSERT INTO parent_bindings (id, session_id, relation, is_demo, created_at)"
            " VALUES (?, ?, ?, 1, ?)",
            (binding_id, session_id, relation, now_iso()),
        )
        db.commit()
    return {"bindingId": binding_id, "relation": relation, "isDemo": True}
