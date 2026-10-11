"""家长端聚合接口：/api/parent/day（心情+快照+指南）与 /api/parent/calendar（月历概览）。"""
from conftest import chat, new_session


async def test_child_calendar_month(client):
    """儿童端月历：当天有日记与心情颜色；空月份为空。"""
    sid = await new_session(client)
    from app.diary_service import local_today

    month = local_today()[:7]
    empty = (await client.get("/api/calendar", params={"sessionId": sid, "month": month})).json()
    assert empty == []

    await chat(client, sid, "同桌抢我的笔，我很生气")
    days = (await client.get("/api/calendar", params={"sessionId": sid, "month": month})).json()
    assert len(days) == 1
    assert days[0]["date"] == local_today()
    assert days[0]["hasDiary"] is True
    assert days[0]["moodConfirmed"] is True
    assert days[0]["colors"] == ["anger"]


async def test_parent_day_unconfirmed_white(client):
    """未确认心情：confirmed=False、colors 空（白），无日记无指南。"""
    sid = await new_session(client)
    resp = await client.get("/api/parent/day", params={"sessionId": sid})
    assert resp.status_code == 200
    data = resp.json()
    assert data["mood"]["confirmed"] is False
    assert data["mood"]["colors"] == []
    assert data["guidance"] is None
    assert data["sharedDiary"] is None


async def test_parent_day_mood_and_stats(client):
    """情绪占比等权计票；并列最高 → 多色（gradient=True）。"""
    sid = await new_session(client)
    await chat(client, sid, "同桌抢我的笔，我很生气")
    await chat(client, sid, "但是放学踢球赢了，太开心了")

    data = (await client.get("/api/parent/day", params={"sessionId": sid})).json()
    mood = data["mood"]
    assert mood["confirmed"] is True
    assert set(mood["colors"]) == {"anger", "joy"}
    assert mood["gradient"] is True
    assert {s["emotion"]: s["count"] for s in mood["stats"]} == {"anger": 1, "joy": 1}


async def test_parent_day_shared_diary_snapshot(client):
    """分享后家长端可见快照（emotionStats 归一为数组）；未分享时不可见。"""
    sid = await new_session(client)
    await chat(client, sid, "今天体育课跑步拿了第一名，太开心了")

    data = (await client.get("/api/parent/day", params={"sessionId": sid})).json()
    assert data["sharedDiary"] is None  # 未分享 → 家长端看不到日记

    await client.post("/api/diary/share", json={"sessionId": sid})
    data = (await client.get("/api/parent/day", params={"sessionId": sid})).json()
    snap = data["sharedDiary"]
    assert snap is not None
    assert snap["id"]
    assert "跑步" in snap["text"]
    assert isinstance(snap["emotionStats"], list)
    assert snap["emotionStats"][0]["emotion"] == "joy"
    assert data["guidance"]["riskLevel"] == "none"
    assert data["guidance"]["levelName"] == "日常陪伴"
    assert data["guidance"]["actions"] and data["guidance"]["openingLines"]


async def test_shared_guidance_snapshot_and_revoke(client):
    """日常指南随分享出现，只用分享时的内容；私人编辑不改变它，撤回后消失。"""
    from app.diary_service import local_today
    sid = await new_session(client)
    await chat(client, sid, "今天跑步拿了第一名，太开心了")
    await client.post("/api/diary/share", json={"sessionId": sid})
    params = {"sessionId": sid}
    before = (await client.get("/api/parent/day", params=params)).json()["guidance"]
    assert any("庆祝" in action for action in before["actions"])
    listed = (await client.get(f"/api/parent/guidance/{sid}")).json()["guidance"]
    assert len(listed) == 1 and listed[0]["level"] == "none"
    month = {**params, "month": local_today()[:7]}
    day = (await client.get("/api/parent/calendar", params=month)).json()["days"][0]
    assert day["hasGuidance"] and day["hasSharedDiary"]

    await chat(client, sid, "后来和同学吵架了，很生气")
    assert (await client.get("/api/parent/day", params=params)).json()["guidance"] == before
    # 新分享采用新快照，且同一天仅保留一份日常指南。
    await client.post("/api/diary/share", json=params)
    after = (await client.get("/api/parent/day", params=params)).json()["guidance"]
    assert after["id"] != before["id"]
    assert any("生气" in action for action in after["actions"])
    assert len((await client.get(f"/api/parent/guidance/{sid}")).json()["guidance"]) == 1

    await client.post("/api/diary/share/revoke", json=params)
    revoked = (await client.get("/api/parent/day", params=params)).json()
    assert revoked["guidance"] is None and revoked["sharedDiary"] is None
    day = (await client.get("/api/parent/calendar", params=month)).json()["days"][0]
    assert not day["hasGuidance"] and not day["hasSharedDiary"]
    assert (await client.get(f"/api/parent/guidance/{sid}")).json()["guidance"] == []


async def test_shared_guidance_preserves_risk_guidance(client):
    sid = await new_session(client)
    await chat(client, sid, "同学总是欺负我，我很害怕")
    params = {"sessionId": sid}
    before = (await client.get("/api/parent/day", params=params)).json()["guidance"]
    await client.post("/api/diary/share", json=params)
    assert (await client.get("/api/parent/day", params=params)).json()["guidance"] == before
    await client.post("/api/diary/share/revoke", json=params)
    assert (await client.get("/api/parent/day", params=params)).json()["guidance"] == before


async def test_shared_guidance_does_not_reveal_blocked_risk(client):
    sid = await new_session(client)
    await chat(client, sid, "今天跑步很开心")
    params = {"sessionId": sid}
    await client.post("/api/diary/share", json=params)
    before = (await client.get("/api/parent/day", params=params)).json()["guidance"]
    from app import safety
    from app.diary_service import local_today
    state = client._transport.app.state
    safety.record_risk_event(state.db, state.db_lock, sid, local_today(), "high", True, False)
    assert (await client.get("/api/parent/day", params=params)).json()["guidance"] == before
    assert (await client.get("/api/parent/day", params={**params, "date": "2020-01-01"})).json()["guidance"] is None


async def test_parent_day_guidance_mapping(client):
    """疑似霸凌 → 指南出现；字段为家长端卡片结构，概述简短不确定。"""
    sid = await new_session(client)
    await chat(client, sid, "班里同学总是欺负我，抢我的东西，我很害怕")

    data = (await client.get("/api/parent/day", params={"sessionId": sid})).json()
    g = data["guidance"]
    assert g is not None
    assert g["riskLevel"] == "medium"
    assert g["levelName"] == "疑似霸凌"
    assert "可能" in g["eventBrief"]
    assert g["actions"] and g["openingLines"] and g["avoid"] and g["followUps"]
    assert g["watchOut"]


async def test_parent_day_conflict_no_guidance(client):
    """普通冲突不出现指南，但有心情颜色。"""
    sid = await new_session(client)
    await chat(client, sid, "今天和同学吵架了，很生气")
    data = (await client.get("/api/parent/day", params={"sessionId": sid})).json()
    assert data["guidance"] is None
    assert data["mood"]["confirmed"] is True


async def test_parent_calendar_month(client):
    """月历概览：当天含心情颜色、分享与指南标记；空月份为空。"""
    sid = await new_session(client)
    from app.diary_service import local_today

    month = local_today()[:7]

    empty = (await client.get(
        "/api/parent/calendar", params={"sessionId": sid, "month": month}
    )).json()
    assert empty["days"] == []

    await chat(client, sid, "班里同学总是欺负我，我很害怕")
    await client.post("/api/diary/share", json={"sessionId": sid})

    data = (await client.get(
        "/api/parent/calendar", params={"sessionId": sid, "month": month}
    )).json()
    assert len(data["days"]) == 1
    day = data["days"][0]
    assert day["date"] == local_today()
    assert day["moodConfirmed"] is True
    assert day["colors"] == ["fear"]
    assert day["hasSharedDiary"] is True
    assert day["hasGuidance"] is True


async def test_parent_endpoints_expired(client):
    """会话已删除 → 410，旧内容不可再读。"""
    sid = await new_session(client)
    await chat(client, sid, "今天很开心")
    await client.post("/api/session/beacon", json={"sessionId": sid})
    await client.post("/internal/dev/force-expire", json={"sessionId": sid})

    resp = await client.get("/api/parent/day", params={"sessionId": sid})
    assert resp.status_code == 410
    resp = await client.get(
        "/api/parent/calendar", params={"sessionId": sid, "month": "2026-10"}
    )
    assert resp.status_code == 410


async def test_parent_calendar_invalid_month(client):
    sid = await new_session(client)
    resp = await client.get(
        "/api/parent/calendar", params={"sessionId": sid, "month": "202610"}
    )
    assert resp.status_code == 400
