import os
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent

DB_PATH = Path(
    os.environ.get(
        "XIAOXIAOWO_DB_PATH",
        BASE_DIR.parent / "data" / "xiaoxiaowo.sqlite",
    )
)
STATIC_DIR = Path(
    os.environ.get("XIAOXIAOWO_STATIC_DIR", BASE_DIR / "static")
)


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)"
        )
        conn.execute(
            "INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '1')"
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="xiaoxiaowo", lifespan=lifespan)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
