"""DeepSeek 对话适配器：一次调用返回 reply + 结构化情绪决策 JSON。

未配置 DEEPSEEK_API_KEY 时使用确定性本地 stub（黑客松演示/测试可离线运行）。
任何异常都不向前端抛出细节，避免泄露 Key 或内部信息。
"""
from __future__ import annotations

import json
import re

import httpx

EMOTIONS = ("calm", "joy", "anger", "sadness", "fear")
RISK_LEVELS = ("none", "low", "medium", "high")

SYSTEM_PROMPT = """你是「小小我」，一个陪伴 7-9 岁孩子表达情绪的「另一个我」。规则：
1. 口吻是共同探索的「另一个我」，例如「我们是不是因为……？」，允许被否认。
2. 问句简短、一次只围绕一个重点；不重复追问已知事实；不补造经历或人物动机。
3. 孩子可以说「不知道」、纠正你、拒绝回答或暂停。第一次拒绝建议后立即回到陪伴；
   同一问题累计拒绝两次后仅陪伴，不再主动提建议。明确安全风险独立处理。
4. 区分孩子陈述的事实、孩子的感受、你的猜测、孩子的需求；不把猜测写成结论。
5. 只输出 JSON，不要输出其他任何文字。格式：
{
  "reply": "给孩子看的回复，简短温柔",
  "emotion": {
    "primary": "calm|joy|anger|sadness|fear",
    "confidence": 0.0,
    "ambiguous": false,
    "diaryEligible": true,
    "countsForStats": true,
    "riskLevel": "none|low|medium|high",
    "eventSummary": "孩子第一人称的一句话事件概述，无事件则空字符串",
    "familyRisk": {"involvesParentPerpetrator": false, "perpetratorIdentityClear": true}
  }
}
6. 情绪含糊（两种以上情绪都可能）时 ambiguous=true 并保持当前角色，不要强判。
7. 普通闲聊归 calm，countsForStats=false（不计入情绪统计）；普通日常记录 diaryEligible 可为 true 但不计票。
8. riskLevel：low=普通冲突，medium=疑似霸凌，high=明确危险（伤害、威胁、不当接触、自伤他伤线索）。
9. 涉及家庭成员可能施害或施害者身份不清时，familyRisk 如实标记。"""


def _fallback_decision() -> dict:
    return {
        "reply": "我这边有点卡壳了，我们再说一次好吗？",
        "emotion": {
            "primary": "calm",
            "confidence": 0.0,
            "ambiguous": True,
            "diaryEligible": False,
            "countsForStats": False,
            "riskLevel": "none",
            "eventSummary": "",
        },
    }


def normalize_decision(raw: dict) -> dict:
    emo = raw.get("emotion") or {}
    primary = emo.get("primary") if emo.get("primary") in EMOTIONS else "calm"
    risk = emo.get("riskLevel") if emo.get("riskLevel") in RISK_LEVELS else "none"
    try:
        confidence = float(emo.get("confidence", 0.0))
    except (TypeError, ValueError):
        confidence = 0.0
    confidence = max(0.0, min(1.0, confidence))
    diary_eligible = bool(emo.get("diaryEligible", False))
    counts_default = diary_eligible and primary != "calm"
    family = emo.get("familyRisk") or {}
    return {
        "reply": str(raw.get("reply") or "我在听。"),
        "emotion": {
            "primary": primary,
            "confidence": confidence,
            "ambiguous": bool(emo.get("ambiguous", False)),
            "diaryEligible": diary_eligible,
            "countsForStats": bool(emo.get("countsForStats", counts_default)) and diary_eligible,
            "riskLevel": risk,
            "eventSummary": str(emo.get("eventSummary") or ""),
            "familyRisk": {
                "involvesParentPerpetrator": bool(family.get("involvesParentPerpetrator", False)),
                "perpetratorIdentityClear": bool(family.get("perpetratorIdentityClear", True)),
            },
        },
    }


_JOY = ["开心", "高兴", "太好了", "好玩", "喜欢", "棒"]
_ANGER = ["生气", "气死", "讨厌", "烦死", "愤怒", "哼"]
_SAD = ["难过", "伤心", "哭", "委屈", "不开心", "沮丧"]
_FEAR = ["害怕", "恐惧", "紧张", "不敢"]
_DANGER = ["威胁", "刀", "不想活", "自杀", "流血", "往死里打", "伤害自己"]
_BULLY = ["欺负", "打我", "骂我", "抢我", "孤立", "排挤", "起外号"]
_CONFLICT = ["吵架", "争执", "闹矛盾", "抢玩具"]
_PARENT_PERP = ["爸爸打", "妈妈打", "爸爸骂", "妈妈骂", "爷爷打", "奶奶打", "爸爸威胁", "妈妈威胁"]


def stub_complete(text: str) -> dict:
    """离线确定性 stub：按关键词给出情绪/风险判断，供无 Key 演示与测试。"""
    danger = any(k in text for k in _DANGER)
    parent_perp = any(k in text for k in _PARENT_PERP)
    bully = any(k in text for k in _BULLY)
    conflict = any(k in text for k in _CONFLICT)

    hits = []
    if any(k in text for k in _JOY):
        hits.append("joy")
    if any(k in text for k in _ANGER):
        hits.append("anger")
    if any(k in text for k in _SAD):
        hits.append("sadness")
    if any(k in text for k in _FEAR):
        hits.append("fear")

    if danger:
        risk, primary = "high", "fear"
        hits = [primary]
    elif bully:
        risk = "medium"
        primary = hits[0] if hits else "fear"
        hits = [primary]
    elif conflict:
        risk = "low"
        primary = hits[0] if hits else "anger"
        hits = [primary]
    else:
        risk = "none"
        primary = hits[0] if hits else "calm"

    ambiguous = len(hits) > 1
    diary_eligible = bool(hits) or risk != "none" or len(text.strip()) >= 8
    if primary == "calm" and not diary_eligible:
        summary = ""
    elif primary == "calm":
        summary = "今天闲聊了一会儿。"
    else:
        summary = f"我说：{text[:40]}"

    reply_map = {
        "joy": "听起来这件事让你很开心，多想和我讲讲吗？",
        "anger": "这件事情好像让你很生气，我在听，你慢慢说。",
        "sadness": "听起来有点难过，没关系，我陪着你。",
        "fear": "这听起来让人有点害怕，我们可以慢慢来。",
        "calm": "嗯，我在听呢，今天还有什么想聊的吗？",
    }
    if risk == "high":
        reply = "听到这个我很担心你。这件事可能需要一个你信任的大人帮忙，我们一起想想可以找谁，好吗？"

    return normalize_decision({
        "reply": reply_map[primary] if risk != "high" else reply,
        "emotion": {
            "primary": primary,
            "confidence": 0.9 if hits or risk != "none" else 0.6,
            "ambiguous": ambiguous,
            "diaryEligible": diary_eligible,
            "countsForStats": diary_eligible and primary != "calm",
            "riskLevel": risk,
            "eventSummary": summary,
            "familyRisk": {
                "involvesParentPerpetrator": parent_perp,
                "perpetratorIdentityClear": not parent_perp,
            },
        },
    })


class DeepSeekClient:
    def __init__(self, settings):
        self.settings = settings

    async def complete(self, history: list[dict], text: str) -> dict:
        if not self.settings.deepseek_api_key:
            return stub_complete(text)
        try:
            return await self._call_api(history, text)
        except Exception:
            # 不向前端抛出异常细节（避免泄露 Key/内部信息），降级为安全兜底回复
            return _fallback_decision()

    async def _call_api(self, history: list[dict], text: str) -> dict:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        messages.extend(history[-12:])
        messages.append({"role": "user", "content": text})
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self.settings.deepseek_base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.settings.deepseek_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.settings.deepseek_model,
                    "messages": messages,
                    "response_format": {"type": "json_object"},
                    "temperature": 0.7,
                },
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if not match:
            return _fallback_decision()
        return normalize_decision(json.loads(match.group(0)))
