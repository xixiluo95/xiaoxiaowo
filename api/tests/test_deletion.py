"""五分钟删除（设定 §11）：关闭信标计时、活跃不删、重开取消、到期 404/410。"""
from conftest import chat, new_session


async def test_five_minute_deletion(client):
    sid = await new_session(client)
    await chat(client, sid, "同桌欺负我，我很害怕")  # medium 风险 + 日记
    await client.post("/internal/dev/bindings", json={"sessionId": sid, "relation": "妈妈"})
    await chat(client, sid, "他还抢我的文具")
    share = (await client.post("/api/diary/share", json={"sessionId": sid})).json()
    token = share["shareToken"]

    # 页面活跃期间不因满五分钟删除（无信标 → 数据一直在）
    assert (await client.get("/api/diary", params={"sessionId": sid})).json()["diary"]

    # 关闭信标 → 开始倒计时，当天日记同步整理（会话结束即整理）
    resp = await client.post("/api/session/beacon", json={"sessionId": sid})
    assert resp.json()["status"] == "closing"
    assert resp.json()["deleteAt"] is not None

    # 五分钟内重新打开 → 取消倒计时
    resp = await client.post("/api/session/resume", json={"sessionId": sid})
    assert resp.json()["status"] == "active"
    await client.post("/internal/dev/purge-expired", json={})
    assert (await client.get("/api/diary", params={"sessionId": sid})).json()["diary"]

    # 再次关闭并到期 → 业务数据全部清除
    await client.post("/api/session/beacon", json={"sessionId": sid})
    await client.post("/internal/dev/force-expire", json={"sessionId": sid})
    await client.post("/internal/dev/purge-expired", json={})

    # 到期后接口/日历/旧分享链接一律 404/410
    assert (await client.get(f"/api/session/{sid}")).status_code == 410
    assert (await client.get("/api/diary", params={"sessionId": sid})).status_code == 410
    assert (await client.get(f"/api/mood/{sid}")).status_code == 410
    assert (await client.get(f"/api/parent/heart/{sid}")).status_code == 410
    assert (await client.get(f"/api/parent/diaries/{sid}")).status_code == 410
    assert (await client.get(f"/api/parent/guidance/{sid}")).status_code == 410
    assert (await client.get(f"/api/share/{token}")).status_code == 404
    assert (await client.post("/api/session/resume", json={"sessionId": sid})).status_code == 410
    resp = await client.post("/api/chat", json={"sessionId": sid, "text": "还在吗"})
    assert resp.status_code == 410

    # 数据库层面确认业务数据被删除
    db = client._transport.app.state.db
    for table in ("daily_diaries", "emotion_events", "risk_events",
                  "mood_confirmations", "parent_bindings"):
        col = "subject_id" if table == "daily_diaries" else "session_id"
        count = db.execute(
            f"SELECT COUNT(*) c FROM {table} WHERE {col} = ?", (sid,)
        ).fetchone()["c"]
        assert count == 0, table
    assert db.execute("SELECT COUNT(*) c FROM shared_snapshots").fetchone()["c"] == 0
    assert db.execute("SELECT COUNT(*) c FROM diary_blocks").fetchone()["c"] == 0
    status = db.execute("SELECT status FROM sessions WHERE id = ?", (sid,)).fetchone()
    assert status["status"] == "deleted"


async def test_active_session_not_deleted(client):
    """正常打开使用超过删除时限，不能仅因创建时间到期而删除。"""
    sid = await new_session(client)
    await chat(client, sid, "今天很开心")
    # 无信标直接清扫 → 不应删除任何活跃会话
    purged = (await client.post("/internal/dev/purge-expired", json={})).json()["purged"]
    assert purged == []
    assert (await client.get("/api/diary", params={"sessionId": sid})).json()["diary"]
