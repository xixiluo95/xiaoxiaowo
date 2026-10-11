"""WebSocket 通道、语音降级、占位接口。"""
import os
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import db as dbmod  # noqa: E402
from app.main import create_app  # noqa: E402


def _make_client(tmp_path):
    os.environ["XIAOXIAOWO_DB_PATH"] = str(tmp_path / "ws.sqlite")
    for key in ("DEEPSEEK_API_KEY", "MINIMAX_API_KEY", "MINIMAX_VOICE_ID"):
        os.environ.pop(key, None)
    app = create_app()
    return TestClient(app)


def test_websocket_chat(tmp_path):
    with _make_client(tmp_path) as client:
        sid = client.post("/api/session").json()["sessionId"]
        with client.websocket_connect(f"/ws/chat/{sid}") as ws:
            ws.send_json({"type": "message", "text": "今天很开心"})
            msg = ws.receive_json()
            assert msg["type"] == "reply"
            assert msg["emotion"]["primary"] == "joy"
            assert msg["character"] == "joy"
            ws.send_json({"type": "ping"})
            assert ws.receive_json()["type"] == "pong"
        # REST 兜底仍可用
        resp = client.post("/api/chat", json={"sessionId": sid, "text": "真开心"})
        assert resp.status_code == 200

        # 无效 session → WS 拒绝
        with client.websocket_connect("/ws/chat/nonexistent") as ws:
            msg = ws.receive_json()
            assert msg["type"] == "error"


def test_voice_fallbacks(tmp_path):
    with _make_client(tmp_path) as client:
        sid = client.post("/api/session").json()["sessionId"]
        # TTS 未配置 → 503，不阻断文本（chat 正常）
        resp = client.post("/api/tts", json={"sessionId": sid, "text": "你好"})
        assert resp.status_code == 503
        assert resp.json()["error"] == "tts_unavailable"
        assert client.post("/api/chat", json={"sessionId": sid, "text": "你好"}).status_code == 200
        # STT 未配置 → 501，明确让前端回退文字
        resp = client.post("/api/stt", files={"audio": ("a.webm", b"fake", "audio/webm")})
        assert resp.status_code == 501
        assert resp.json()["fallback"] == "text"


def test_placeholder_endpoints(tmp_path):
    with _make_client(tmp_path) as client:
        for path in ("/api/auth/login", "/api/binding/create",
                     "/api/parent/notifications/list", "/api/memory/recall"):
            resp = client.post(path)
            assert resp.status_code == 501, path
            assert resp.json()["error"] == "not_implemented"
