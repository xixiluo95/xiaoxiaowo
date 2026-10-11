"""10 路并发会话隔离 + 接口不泄露 API Key。"""
import asyncio
import os

from conftest import chat, new_session
from app.main import create_app
from app import db as dbmod
from httpx import ASGITransport, AsyncClient
import tempfile


async def test_ten_sessions_isolated(client):
    sids = await asyncio.gather(*[new_session(client) for _ in range(10)])

    texts = [
        "今天很开心，考试得了满分",
        "同桌抢我的笔，我很生气",
        "小狗生病了，我很难过",
        "晚上一个人在家，我很害怕",
        "今天很开心，吃了冰淇淋",
        "美术课被笑话，我很生气",
        "好朋友转学了，我很难过",
        "打雷了，我很害怕",
        "今天很开心，去了游乐园",
        "玩具被弄坏了，我很生气",
    ]

    follow_ups = ["真开心", "气死我了", "好难过", "好害怕", "真开心",
                  "气死我了", "好难过", "好害怕", "真开心", "气死我了"]

    async def run(i, sid):
        r1 = await chat(client, sid, texts[i])
        r2 = await chat(client, sid, follow_ups[i])
        return sid, r1, r2

    results = await asyncio.gather(*[run(i, sid) for i, sid in enumerate(sids)])

    db = client._transport.app.state.db
    for i, (sid, r1, r2) in enumerate(results):
        # 各自只有一篇当天日记，且只包含自己的事件
        count = db.execute(
            "SELECT COUNT(*) c FROM daily_diaries WHERE subject_id = ?", (sid,)
        ).fetchone()["c"]
        assert count == 1
        diary = (await client.get("/api/diary", params={"sessionId": sid})).json()
        event_ids = {b["eventId"] for b in diary["blocks"]}
        assert r1["eventId"] in event_ids
        for j, (other_sid, other_r1, _) in enumerate(results):
            if i != j:
                assert other_r1["eventId"] not in event_ids
        # 角色状态隔离
        session = (await client.get(f"/api/session/{sid}")).json()
        expected = {"0": "joy", "1": "anger", "2": "sadness", "3": "fear",
                    "4": "joy", "5": "anger", "6": "sadness", "7": "fear",
                    "8": "joy", "9": "anger"}
        assert session["character"] == expected[str(i)]


async def test_no_api_key_in_responses():
    """配置 Key 后，任何接口响应都不得包含 Key（含错误路径）。"""
    fd, path = tempfile.mkstemp(suffix=".sqlite")
    os.close(fd)
    os.environ["XIAOXIAOWO_DB_PATH"] = path
    os.environ["DEEPSEEK_API_KEY"] = "SK-SENTINEL-DEEPSEEK-KEY"
    os.environ["MINIMAX_API_KEY"] = "SK-SENTINEL-MINIMAX-KEY"
    os.environ["MINIMAX_VOICE_ID"] = "VOICE-SENTINEL-ID"
    try:
        app = create_app()
        # 离线测试：替换为 stub/必然失败的实现，不外呼
        from app.deepseek import DeepSeekClient

        class _OfflineDeepSeek(DeepSeekClient):
            async def complete(self, history, text):
                from app.deepseek import stub_complete
                return stub_complete(text)

        class _OfflineTTS:
            async def synthesize(self, text):
                from app.tts import TTSFailed
                raise TTSFailed("tts_failed")

        app.state.deepseek = _OfflineDeepSeek(app.state.settings)
        app.state.tts = _OfflineTTS()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            sid = (await c.post("/api/session")).json()["sessionId"]
            bodies = []
            bodies.append((await c.post("/api/chat", json={"sessionId": sid, "text": "今天很开心"})).text)
            bodies.append((await c.get("/api/diary", params={"sessionId": sid})).text)
            bodies.append((await c.get(f"/api/mood/{sid}")).text)
            bodies.append((await c.get(f"/api/parent/heart/{sid}")).text)
            bodies.append((await c.get(f"/api/parent/guidance/{sid}")).text)
            bodies.append((await c.post("/api/tts", json={"sessionId": sid, "text": "你好"})).text)
            bodies.append((await c.post("/api/stt")).text)
            bodies.append((await c.get("/api/share/nonexistent-token")).text)
            bodies.append((await c.post("/api/session/beacon", json={"sessionId": sid})).text)
            bodies.append((await c.post("/internal/dev/finalize-diary", json={})).text)
            for body in bodies:
                assert "SK-SENTINEL-DEEPSEEK-KEY" not in body
                assert "SK-SENTINEL-MINIMAX-KEY" not in body
                assert "VOICE-SENTINEL-ID" not in body
    finally:
        for key in ("DEEPSEEK_API_KEY", "MINIMAX_API_KEY", "MINIMAX_VOICE_ID"):
            os.environ.pop(key, None)
        dbmod.reset()
        os.unlink(path)
