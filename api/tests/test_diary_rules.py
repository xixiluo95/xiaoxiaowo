"""日记核心规则：唯一约束、锁定块保护、零点幂等、删除重算、快照不可变、情绪占比。"""
from conftest import chat, new_session


async def test_diary_unique_per_day(client):
    sid = await new_session(client)
    await chat(client, sid, "今天体育课跑步拿了第一名，太开心了")
    await chat(client, sid, "但是同桌抢我的笔，我很生气")

    resp = await client.get("/api/diary", params={"sessionId": sid})
    data = resp.json()
    assert data["diary"] is not None
    assert len(data["blocks"]) == 2

    # 数据库唯一约束：同一 subject+date 只有一篇
    db = client._transport.app.state.db
    count = db.execute(
        "SELECT COUNT(*) c FROM daily_diaries WHERE subject_id = ?", (sid,)
    ).fetchone()["c"]
    assert count == 1


async def test_locked_block_not_overwritten(client):
    sid = await new_session(client)
    await chat(client, sid, "同桌抢我的笔，我很生气")
    diary = (await client.get("/api/diary", params={"sessionId": sid})).json()
    block = diary["blocks"][0]

    # 孩子亲自修改 → 锁定
    resp = await client.put(
        f"/api/diary/blocks/{block['id']}",
        json={"sessionId": sid, "text": "我其实不是很生气，只是觉得委屈。"},
    )
    assert resp.json()["locked"] is True

    # 后续 AI 只追加，不覆盖已锁定块
    await chat(client, sid, "晚上我还和妈妈聊了恐龙，很开心")
    diary = (await client.get("/api/diary", params={"sessionId": sid})).json()
    texts = [b["text"] for b in diary["blocks"]]
    assert "我其实不是很生气，只是觉得委屈。" in texts
    locked = [b for b in diary["blocks"] if b["id"] == block["id"]][0]
    assert locked["locked"] is True
    assert len(diary["blocks"]) == 2


async def test_finalize_idempotent(client):
    sid = await new_session(client)
    await chat(client, sid, "今天很开心，因为老师表扬了我")

    r1 = await client.post("/internal/dev/finalize-diary", json={})
    assert len(r1.json()["finalized"]) == 1
    r2 = await client.post("/internal/dev/finalize-diary", json={})
    assert r2.json()["finalized"] == []

    db = client._transport.app.state.db
    count = db.execute(
        "SELECT COUNT(*) c FROM daily_diaries WHERE subject_id = ?", (sid,)
    ).fetchone()["c"]
    assert count == 1
    diary = (await client.get("/api/diary", params={"sessionId": sid})).json()
    assert diary["diary"]["status"] == "final_draft"


async def test_delete_event_recalculates(client):
    sid = await new_session(client)
    r1 = await chat(client, sid, "同桌抢我的笔，我很生气")
    r2 = await chat(client, sid, "但是放学踢球赢了，太开心了")

    mood = (await client.get(f"/api/mood/{sid}")).json()
    assert mood["votes"] == {"anger": 1, "joy": 1}
    assert mood["gradient"] is True  # 并列最高 → 多色渐变

    # 删除 anger 事件 → 重算占比 → joy 单色；内容从日记移除
    resp = await client.request(
        "DELETE", f"/api/events/{r1['eventId']}", params={"sessionId": sid}
    )
    assert resp.json()["deleted"] is True
    assert resp.json()["heart"]["votes"] == {"joy": 1}

    diary = (await client.get("/api/diary", params={"sessionId": sid})).json()
    assert len(diary["blocks"]) == 1

    # 后续生成不得补回已删除内容
    await chat(client, sid, "晚饭吃了糖醋排骨，很开心")
    diary = (await client.get("/api/diary", params={"sessionId": sid})).json()
    assert all(r1["eventId"] != b["eventId"] for b in diary["blocks"])
    mood = (await client.get(f"/api/mood/{sid}")).json()
    assert mood["votes"] == {"joy": 2}
    assert r2["eventId"] is not None


async def test_snapshot_immutable(client):
    sid = await new_session(client)
    await chat(client, sid, "今天很开心，因为老师表扬了我")
    share = (await client.post("/api/diary/share", json={"sessionId": sid})).json()
    token = share["shareToken"]

    snap1 = (await client.get(f"/api/share/{token}")).json()
    original_text = snap1["text"]

    # 分享后修改私人日记，快照不变
    await chat(client, sid, "后来我们又去玩了滑梯，太开心了")
    diary = (await client.get("/api/diary", params={"sessionId": sid})).json()
    block = diary["blocks"][0]
    await client.put(
        f"/api/diary/blocks/{block['id']}",
        json={"sessionId": sid, "text": "改过的私人内容"},
    )

    snap2 = (await client.get(f"/api/share/{token}")).json()
    assert snap2["text"] == original_text
    assert "改过的私人内容" not in snap2["text"]

    # 撤回后旧链接 410
    await client.post(
        "/api/diary/share/revoke", json={"sessionId": sid, "shareToken": token}
    )
    resp = await client.get(f"/api/share/{token}")
    assert resp.status_code == 410


async def test_revoke_share_by_date(client):
    """孩子端按天撤回：无需 token，当天全部版本快照的旧链接一并 410。"""
    sid = await new_session(client)
    await chat(client, sid, "今天很开心，因为老师表扬了我")
    t1 = (await client.post("/api/diary/share", json={"sessionId": sid})).json()["shareToken"]
    t2 = (await client.post("/api/diary/share", json={"sessionId": sid})).json()["shareToken"]

    resp = await client.post("/api/diary/share/revoke", json={"sessionId": sid})
    assert resp.json() == {"revoked": True, "count": 2}
    for t in (t1, t2):
        assert (await client.get(f"/api/share/{t}")).status_code == 410

    # 家长端快照列表（儿童端 shared 标记数据源）同步清空
    diaries = (await client.get(f"/api/parent/diaries/{sid}")).json()
    assert diaries["snapshots"] == []

    # 重复撤回 → 404
    again = await client.post("/api/diary/share/revoke", json={"sessionId": sid})
    assert again.status_code == 404


async def test_chitchat_not_counted(client):
    sid = await new_session(client)
    result = await chat(client, sid, "你好呀")  # 普通闲聊 → calm 不计票
    assert result["emotion"]["primary"] == "calm"

    mood = (await client.get(f"/api/mood/{sid}")).json()
    assert mood["state"] == "unconfirmed"  # 未确认=白
    assert mood["colors"] == []
    assert mood["votes"] == {}

    # 孩子主动确认平静 → 已确认平静（与未确认区分）
    resp = await client.post(
        "/api/diary/confirm-mood", json={"sessionId": sid, "emotion": "calm"}
    )
    assert resp.json()["state"] == "confirmed"
    assert resp.json()["colors"] == ["calm"]


async def test_ambiguous_keeps_character(client):
    sid = await new_session(client)
    r1 = await chat(client, sid, "今天很开心")
    assert r1["character"] == "joy"
    # 含糊输入（同时命中两种情绪）→ 不强判，保持当前角色
    r2 = await chat(client, sid, "开心又难过，说不清楚")
    assert r2["emotion"]["ambiguous"] is True
    assert r2["character"] == "joy"
