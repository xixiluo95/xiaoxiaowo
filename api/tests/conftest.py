import os
import sys
import tempfile

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import db as dbmod  # noqa: E402
from app.main import create_app  # noqa: E402


@pytest_asyncio.fixture
async def client():
    fd, path = tempfile.mkstemp(suffix=".sqlite")
    os.close(fd)
    os.environ["XIAOXIAOWO_DB_PATH"] = path
    for key in ("DEEPSEEK_API_KEY", "MINIMAX_API_KEY", "MINIMAX_VOICE_ID"):
        os.environ.pop(key, None)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    dbmod.reset()
    os.unlink(path)


async def new_session(client: AsyncClient) -> str:
    resp = await client.post("/api/session")
    assert resp.status_code == 200
    return resp.json()["sessionId"]


async def chat(client: AsyncClient, session_id: str, text: str) -> dict:
    resp = await client.post("/api/chat", json={"sessionId": session_id, "text": text})
    assert resp.status_code == 200, resp.text
    return resp.json()
