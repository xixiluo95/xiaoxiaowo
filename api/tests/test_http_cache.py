"""缓存头与压缩：a) cache_directive 路径分类；b) 真实静态目录下的响应头与 gzip 行为。"""
import os
import tempfile
from pathlib import Path

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app import db as dbmod
from app.http_cache import cache_directive
from app.main import create_app

JS_BODY = "export const pad = '%s';\n" % ("x" * 3000)  # >1KB 且可压缩，用于验证 gzip


def test_cache_directive_paths():
    """指纹资源长缓存、普通素材短缓存、HTML 外壳每次校验、API 不缓存。"""
    assert cache_directive("/api/parent/day") == "no-store"
    assert cache_directive("/api/tts") == "no-store"
    assert "immutable" in cache_directive("/assets/index-BK6Wf8oK.js")
    assert "immutable" in cache_directive("/assets/index-DjcSirlj.css")
    assert cache_directive("/assets/emotions/joy/loop.mp4") == "public, max-age=3600"
    assert cache_directive("/assets/ui/chat-input-base.png") == "public, max-age=3600"
    assert cache_directive("/") == "no-cache"
    assert cache_directive("/parent") == "no-cache"
    assert cache_directive("/index.html") == "no-cache"
    assert cache_directive("/favicon.ico") is None


@pytest_asyncio.fixture
async def static_client():
    """带临时静态目录的应用：覆盖 index.html、指纹 JS、视频三类响应。"""
    with tempfile.TemporaryDirectory() as static_dir:
        root = Path(static_dir)
        media_dir = root / "assets" / "emotions" / "joy"
        media_dir.mkdir(parents=True)
        (root / "index.html").write_text("<!doctype html><title>小小我</title>", encoding="utf-8")
        (root / "assets" / "index-abc12345.js").write_text(JS_BODY, encoding="utf-8")
        (media_dir / "loop.mp4").write_bytes(b"\x00" * 4096)

        fd, db_path = tempfile.mkstemp(suffix=".sqlite")
        os.close(fd)
        prev_db = os.environ.get("XIAOXIAOWO_DB_PATH")
        prev_static = os.environ.get("XIAOXIAOWO_STATIC_DIR")
        os.environ["XIAOXIAOWO_DB_PATH"] = db_path
        os.environ["XIAOXIAOWO_STATIC_DIR"] = static_dir
        app = create_app()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
        dbmod.reset()
        os.unlink(db_path)
        for key, prev in (("XIAOXIAOWO_DB_PATH", prev_db), ("XIAOXIAOWO_STATIC_DIR", prev_static)):
            if prev is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = prev


async def test_html_uncached(static_client):
    resp = await static_client.get("/")
    assert resp.status_code == 200
    assert resp.headers["cache-control"] == "no-cache"


async def test_fingerprinted_asset_immutable_and_gzipped(static_client):
    """指纹 JS 长缓存 + gzip 生效（传输体积显著变小，解压后内容一致）。"""
    resp = await static_client.get("/assets/index-abc12345.js", headers={"accept-encoding": "gzip"})
    assert resp.status_code == 200
    assert "immutable" in resp.headers["cache-control"]
    assert resp.headers.get("content-encoding") == "gzip"
    # httpx 会自动解压，因此用响应头里的传输长度判断压缩效果
    assert int(resp.headers["content-length"]) < len(JS_BODY) // 2
    assert resp.text == JS_BODY


async def test_video_not_gzipped_and_range_kept(static_client):
    """视频不压缩；Range 请求保持 206 且不被压缩（否则播放会坏）。"""
    key = "/assets/emotions/joy/loop.mp4"
    full = await static_client.get(key, headers={"accept-encoding": "gzip"})
    assert full.status_code == 200
    assert full.headers["cache-control"] == "public, max-age=3600"
    assert "content-encoding" not in full.headers

    part = await static_client.get(key, headers={"accept-encoding": "gzip", "range": "bytes=0-1023"})
    assert part.status_code == 206
    assert "content-encoding" not in part.headers
    assert len(part.content) == 1024


async def test_api_not_cached(static_client):
    resp = await static_client.get("/api/health")
    assert resp.status_code == 200
    assert resp.headers["cache-control"] == "no-store"
