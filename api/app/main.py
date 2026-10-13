"""小小我 API — FastAPI 应用入口。"""
from __future__ import annotations

import asyncio
import contextlib
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.gzip import GZipMiddleware

from . import db as dbmod
from . import deletion
from .config import Settings, load_settings
from .deepseek import DeepSeekClient
from .http_cache import StaticCacheMiddleware
from .routes import router
from .stt import build_stt_provider
from .tts import MiniMaxTTS


async def _sweeper(app: FastAPI) -> None:
    """后台清扫：到期的删除计时真正执行清除。"""
    while True:
        await asyncio.sleep(1)
        try:
            purged = deletion.purge_expired(app.state.db, app.state.db_lock)
            for sid in purged:
                app.state.histories.pop(sid, None)
        except Exception:
            pass


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()

    @contextlib.asynccontextmanager
    async def lifespan(app: FastAPI):
        task = asyncio.create_task(_sweeper(app))
        try:
            yield
        finally:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

    app = FastAPI(title="小小我 API", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.db = dbmod.connect(settings.db_path)
    app.state.db_lock = dbmod.lock_for(settings.db_path)
    app.state.deepseek = DeepSeekClient(settings)
    app.state.tts = MiniMaxTTS(settings)
    app.state.stt = build_stt_provider(settings)
    app.state.histories = {}

    # 顺序即洋葱层次：最后 add 的最外层，因此 CORS 仍在最外面，其次补缓存头，再次 gzip
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(StaticCacheMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)

    @app.get("/api/health")
    def health() -> dict:
        return {"status": "ok"}

    # 鲁班骨架约定：web 构建产物由同一容器提供（XIAOXIAOWO_STATIC_DIR 可覆盖）
    static_dir = Path(
        os.environ.get(
            "XIAOXIAOWO_STATIC_DIR",
            Path(__file__).resolve().parent.parent / "static",
        )
    )
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

    return app


app = create_app()
