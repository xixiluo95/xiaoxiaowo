import asyncio
import threading
from pathlib import Path

import pytest

from app.stt import FunASRProvider, STTUnavailable


async def test_cold_model_load_keeps_event_loop_responsive(monkeypatch):
    provider = FunASRProvider("unused")
    started = threading.Event()
    release = threading.Event()
    loop_thread = threading.get_ident()
    temporary_paths = []

    class Model:
        def generate(self, input):
            assert threading.get_ident() != loop_thread
            assert Path(input).read_bytes() == b"test audio"
            temporary_paths.append(input)
            return [{"text": "你好"}]

    def load():
        started.set()
        assert threading.get_ident() != loop_thread
        assert release.wait(3)
        return Model()

    monkeypatch.setattr(provider, "_load", load)
    task = asyncio.create_task(provider.transcribe(b"test audio"))
    try:
        assert await asyncio.to_thread(started.wait, 1)
        await asyncio.sleep(0)
        assert not task.done()
    finally:
        release.set()
    assert await task == "你好"
    assert all(not Path(path).exists() for path in temporary_paths)


async def test_meta_tokens_are_stripped(monkeypatch):
    provider = FunASRProvider("unused")

    class Model:
        def generate(self, input):
            return [{"text": "<|zh|><|HAPPY|><|Speech|><|woitn|>我今天很开心"}]

    monkeypatch.setattr(provider, "_load", lambda: Model())
    assert await provider.transcribe(b"audio") == "我今天很开心"


async def test_only_meta_tokens_counts_as_empty(monkeypatch):
    provider = FunASRProvider("unused")

    class Model:
        def generate(self, input):
            return [{"text": "<|zh|><|Speech|>"}]

    monkeypatch.setattr(provider, "_load", lambda: Model())
    with pytest.raises(STTUnavailable, match="stt_empty_result"):
        await provider.transcribe(b"audio")
