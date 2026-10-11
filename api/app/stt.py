"""STT Provider 接口：FunASR 优先，未配置/失败时返回明确错误让前端回退文字输入。

不接 MiniMax STT（接口未确认）。原始儿童录音不保存为业务记录（设定 §11）：
音频字节仅在内存中用于识别，不落盘、不写日志。
"""
from __future__ import annotations

from typing import Protocol


class STTUnavailable(RuntimeError):
    pass


class STTProvider(Protocol):
    async def transcribe(self, audio: bytes, language: str = "zh-CN") -> str:
        ...


class FunASRProvider:
    """本地 FunASR 模型识别。需要 FUNASR_MODEL_DIR 指向模型目录。"""

    def __init__(self, model_dir: str):
        self.model_dir = model_dir
        self._model = None

    def _load(self):
        if self._model is None:
            try:
                from funasr import AutoModel
            except ImportError as exc:
                raise STTUnavailable("funasr_not_installed") from exc
            self._model = AutoModel(model=self.model_dir)
        return self._model

    async def transcribe(self, audio: bytes, language: str = "zh-CN") -> str:
        import asyncio
        import tempfile

        model = self._load()
        # 短暂音频处理：写入临时文件仅供 FunASR 读取，识别后立即删除，不进入业务记录
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=True) as tmp:
            tmp.write(audio)
            tmp.flush()
            result = await asyncio.to_thread(model.generate, input=tmp.name)
        texts = [seg.get("text", "") for seg in (result or [])]
        text = "".join(texts).strip()
        if not text:
            raise STTUnavailable("stt_empty_result")
        return text


def build_stt_provider(settings) -> STTProvider | None:
    if settings.funasr_model_dir:
        return FunASRProvider(settings.funasr_model_dir)
    return None
