"""STT Provider 接口：FunASR 优先，未配置/失败时返回明确错误让前端回退文字输入。

不接 MiniMax STT（接口未确认）。原始儿童录音不保存为业务记录（设定 §11）：
音频字节仅在内存中用于识别，不落盘、不写日志。
"""
from __future__ import annotations

import asyncio
import re
import threading
from typing import Protocol

# SenseVoice 等模型会在识别文本中混入元信息 token（如 <|zh|><|HAPPY|><|Speech|>），
# 这些 token 不能进入回显、对话与日记链路，在出口统一剥离。
_META_TOKEN_RE = re.compile(r"<\|[^|]*\|>")


def _clean_text(text: str) -> str:
    return _META_TOKEN_RE.sub("", text).strip()


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
        self._inference_lock = threading.Lock()

    def _load(self):
        if self._model is None:
            try:
                from funasr import AutoModel
            except ImportError as exc:
                raise STTUnavailable("funasr_not_installed") from exc
            self._model = AutoModel(model=self.model_dir, disable_update=True)
        return self._model

    async def transcribe(self, audio: bytes, language: str = "zh-CN") -> str:
        return await asyncio.to_thread(self._transcribe_sync, audio)

    def _transcribe_sync(self, audio: bytes) -> str:
        # 首次导入、模型加载及推理都不能占用 HTTP 事件循环。
        # 同一模型串行使用，防止首次并发加载及推理缓存竞争。
        with self._inference_lock:
            return self._infer(audio)

    def _infer(self, audio: bytes) -> str:
        import tempfile

        model = self._load()
        # 短暂音频处理：写入临时文件仅供 FunASR 读取，识别后立即删除，不进入业务记录
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=True) as tmp:
            tmp.write(audio)
            tmp.flush()
            result = model.generate(input=tmp.name)
        texts = [seg.get("text", "") for seg in (result or [])]
        text = _clean_text("".join(texts))
        if not text:
            raise STTUnavailable("stt_empty_result")
        return text


def build_stt_provider(settings) -> STTProvider | None:
    if settings.funasr_model_dir:
        return FunASRProvider(settings.funasr_model_dir)
    return None
