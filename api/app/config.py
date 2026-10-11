import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    db_path: str
    deepseek_api_key: str | None
    deepseek_base_url: str
    deepseek_model: str
    minimax_api_key: str | None
    minimax_voice_id: str | None
    minimax_base_url: str
    delete_after_seconds: int
    funasr_model_dir: str | None


def load_settings() -> Settings:
    return Settings(
        db_path=os.environ.get(
            "XIAOXIAOWO_DB_PATH",
            # 骨架约定：数据文件在仓库根 data/（已被 .gitignore 排除）
            os.path.join(os.path.dirname(__file__), "..", "..", "data", "xiaoxiaowo.sqlite"),
        ),
        deepseek_api_key=os.environ.get("DEEPSEEK_API_KEY") or None,
        deepseek_base_url=os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
        deepseek_model=os.environ.get("DEEPSEEK_MODEL", "deepseek-chat"),
        minimax_api_key=os.environ.get("MINIMAX_API_KEY") or None,
        minimax_voice_id=os.environ.get("MINIMAX_VOICE_ID") or None,
        minimax_base_url=os.environ.get("MINIMAX_BASE_URL", "https://api.minimax.io"),
        delete_after_seconds=int(os.environ.get("XIAOXIAOWO_DELETE_AFTER_SECONDS", "300")),
        funasr_model_dir=os.environ.get("FUNASR_MODEL_DIR") or None,
    )
