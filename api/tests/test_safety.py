"""安全规则：风险分级出指南（疑似霸凌起）、指南结构、家庭风险接收人屏蔽。"""
from conftest import chat, new_session


async def test_conflict_no_guidance(client):
    """普通冲突（low）不生成行动指南。"""
    sid = await new_session(client)
    result = await chat(client, sid, "今天和同学吵架了，很生气")
    assert result["emotion"]["riskLevel"] == "low"
    assert result["riskEventId"] is not None  # 风险事件有记录

    resp = await client.get(f"/api/parent/guidance/{sid}")
    assert resp.json()["guidance"] == []


async def test_bullying_generates_guidance(client):
    """疑似霸凌（medium）起生成指南；指南含五类内容，概述用不确定措辞。"""
    sid = await new_session(client)
    result = await chat(client, sid, "班里同学总是欺负我，抢我的东西，我很害怕")
    assert result["emotion"]["riskLevel"] == "medium"

    resp = await client.get(f"/api/parent/guidance/{sid}")
    guidance = resp.json()["guidance"]
    assert len(guidance) == 1
    g = guidance[0]["guidance"]
    for key in ("suggestedActions", "openingLines", "avoidSaying",
                "followUpQuestions", "observationAndHelp"):
        assert g[key], key
    assert "可能" in g["eventSummary"]  # 不确定措辞
    assert len(g["eventSummary"]) <= 60  # 简短，不替代日记全文
    assert guidance[0]["levelName"] == "疑似霸凌"


async def test_clear_danger_generates_guidance(client):
    sid = await new_session(client)
    result = await chat(client, sid, "高年级的说要拿刀威胁我，我很害怕")
    assert result["emotion"]["riskLevel"] == "high"
    resp = await client.get(f"/api/parent/guidance/{sid}")
    guidance = resp.json()["guidance"]
    assert len(guidance) == 1
    assert guidance[0]["levelName"] == "明确危险"


async def test_family_risk_shielding(client):
    """涉及家长施害/身份不清：默认屏蔽全部家长；逐接收人排除后才可发送。"""
    sid = await new_session(client)
    b1 = (await client.post(
        "/internal/dev/bindings", json={"sessionId": sid, "relation": "爸爸"}
    )).json()
    b2 = (await client.post(
        "/internal/dev/bindings", json={"sessionId": sid, "relation": "妈妈"}
    )).json()

    result = await chat(client, sid, "爸爸打我打得很重，还威胁我不能告诉别人，我很害怕")
    assert result["emotion"]["riskLevel"] == "high"
    risk_event_id = result["riskEventId"]

    # 默认：所有家长屏蔽，无绑定视图也不可见
    assert (await client.get(f"/api/parent/guidance/{sid}")).json()["guidance"] == []
    assert (await client.get(
        f"/api/parent/guidance/{sid}", params={"bindingId": b1["bindingId"]}
    )).json()["guidance"] == []
    assert (await client.get(
        f"/api/parent/guidance/{sid}", params={"bindingId": b2["bindingId"]}
    )).json()["guidance"] == []

    # 明确排除妈妈不是施害者 → 仅妈妈可见，爸爸仍屏蔽
    await client.post("/internal/dev/risk-recipient-exclusion",
                      json={"riskEventId": risk_event_id, "bindingId": b2["bindingId"]})
    mom_view = (await client.get(
        f"/api/parent/guidance/{sid}", params={"bindingId": b2["bindingId"]}
    )).json()["guidance"]
    assert len(mom_view) == 1
    recipients = {r["bindingId"]: r["sendAllowed"] for r in mom_view[0]["recipients"]}
    assert recipients[b2["bindingId"]] is True
    assert recipients[b1["bindingId"]] is False  # 其他家长不自动解除屏蔽
    assert (await client.get(
        f"/api/parent/guidance/{sid}", params={"bindingId": b1["bindingId"]}
    )).json()["guidance"] == []


async def test_guidance_summary_not_leaking_diary(client):
    """未分享日记全文不得逐字进入家长指南事件概述（§8/Q02 单事件日记边界）。

    孩子原话、日记块原文都不得出现在指南 eventSummary 里；
    概述只能是类别级模糊描述，保持不确定措辞与简短。
    """
    sid = await new_session(client)
    text = "班里有同学总是欺负我，我很害怕"
    await chat(client, sid, text)

    diary = (await client.get("/api/diary", params={"sessionId": sid})).json()
    block_texts = [b["text"] for b in diary["blocks"] if b["text"]]
    assert block_texts  # 当天确有日记内容

    guidance = (await client.get(f"/api/parent/guidance/{sid}")).json()["guidance"]
    assert len(guidance) == 1
    summary = guidance[0]["guidance"]["eventSummary"]
    assert text not in summary  # 孩子原话不得逐字出现
    for bt in block_texts:
        assert bt not in summary  # 日记块原文不得整体出现
    assert "可能" in summary or "疑似" in summary  # 不确定措辞
    assert len(summary) <= 60


async def test_binding_requires_relation(client):
    sid = await new_session(client)
    resp = await client.post(
        "/internal/dev/bindings", json={"sessionId": sid, "relation": "叔叔"}
    )
    assert resp.status_code == 400  # 亲属身份不在允许范围不能完成绑定


async def test_risk_event_independent_of_diary_deletion(client):
    """删除日记事件不影响风险事件（独立于日记删除链）。"""
    sid = await new_session(client)
    result = await chat(client, sid, "同学欺负我，我很害怕")
    await client.request(
        "DELETE", f"/api/events/{result['eventId']}", params={"sessionId": sid}
    )
    db = client._transport.app.state.db
    count = db.execute(
        "SELECT COUNT(*) c FROM risk_events WHERE session_id = ?", (sid,)
    ).fetchone()["c"]
    assert count == 1
    guidance = (await client.get(f"/api/parent/guidance/{sid}")).json()["guidance"]
    assert len(guidance) == 1
