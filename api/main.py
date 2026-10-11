"""入口包装：保持骨架约定的 `uvicorn main:app`，实际应用工厂在 app.main。"""
from app.main import create_app

app = create_app()
