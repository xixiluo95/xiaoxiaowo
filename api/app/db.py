import os
import sqlite3
import threading

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active',        -- active | closing | deleted
  current_character TEXT NOT NULL DEFAULT 'none',
  created_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL,
  close_started_at TEXT,
  delete_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS daily_diaries (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'live',          -- live | final_draft | confirmed
  finalization_job_id TEXT,
  finalized_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(subject_id, local_date)
);

CREATE TABLE IF NOT EXISTS diary_blocks (
  id TEXT PRIMARY KEY,
  diary_id TEXT NOT NULL REFERENCES daily_diaries(id) ON DELETE CASCADE,
  event_id TEXT,
  source TEXT NOT NULL DEFAULT 'ai',            -- ai | user
  locked INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS emotion_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  diary_id TEXT REFERENCES daily_diaries(id) ON DELETE SET NULL,
  local_date TEXT NOT NULL,
  primary_emotion TEXT NOT NULL,                -- calm | joy | anger | sadness | fear
  counts_for_stats INTEGER NOT NULL DEFAULT 1,  -- 普通日常记录不计票
  summary TEXT NOT NULL DEFAULT '',
  risk_level TEXT NOT NULL DEFAULT 'none',      -- none | low | medium | high
  deleted_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS diary_versions (
  id TEXT PRIMARY KEY,
  diary_id TEXT NOT NULL REFERENCES daily_diaries(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shared_snapshots (
  id TEXT PRIMARY KEY,
  diary_id TEXT NOT NULL,
  diary_version INTEGER NOT NULL,
  text_snapshot TEXT NOT NULL,
  emotion_stats_snapshot TEXT NOT NULL,
  share_token_hash TEXT NOT NULL UNIQUE,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

-- risk_events 独立于日记删除链：删除日记事件不影响安全事件
CREATE TABLE IF NOT EXISTS risk_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  level TEXT NOT NULL,                          -- low 普通冲突 | medium 疑似霸凌 | high 明确危险
  summary TEXT NOT NULL DEFAULT '',
  involves_parent_perpetrator INTEGER NOT NULL DEFAULT 0,
  perpetrator_identity_clear INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS parent_bindings (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  relation TEXT NOT NULL,                       -- 爸爸 | 妈妈 | 爷爷 | 奶奶 | 姥姥 | 姥爷
  is_demo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- 发送权限与读取权限分开记录（设定 §9；Q03 主动读取是否屏蔽为待确认项）
CREATE TABLE IF NOT EXISTS risk_recipient_permissions (
  id TEXT PRIMARY KEY,
  risk_event_id TEXT NOT NULL REFERENCES risk_events(id) ON DELETE CASCADE,
  binding_id TEXT NOT NULL REFERENCES parent_bindings(id) ON DELETE CASCADE,
  excluded_as_perpetrator INTEGER NOT NULL DEFAULT 0,
  send_allowed INTEGER NOT NULL DEFAULT 0,
  read_allowed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(risk_event_id, binding_id)
);

CREATE TABLE IF NOT EXISTS mood_confirmations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  emotion TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(session_id, local_date)
);
"""

_connections: dict[str, sqlite3.Connection] = {}
_locks: dict[str, threading.RLock] = {}


def connect(db_path: str) -> sqlite3.Connection:
    if db_path not in _connections:
        if db_path != ":memory:":
            os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
        conn = sqlite3.connect(db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.executescript(SCHEMA)
        conn.commit()
        _connections[db_path] = conn
        _locks[db_path] = threading.RLock()
    return _connections[db_path]


def lock_for(db_path: str) -> threading.RLock:
    connect(db_path)
    return _locks[db_path]


def reset() -> None:
    for conn in _connections.values():
        conn.close()
    _connections.clear()
    _locks.clear()
