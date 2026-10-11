"""MiniMax TTS HTTP Adapter（/v1/t2a_v2，Bearer Key，hex 音频，指数退避+抖动）。

参考《制作方针》Python 版实现。API Key 只存在于服务端，绝不进入任何接口响应。
"""
from __future__ import annotations

import asyncio
import random

import httpx

RETRYABLE = {429, 500, 502, 503, 504}


class TTSNotConfigured(RuntimeError):
    pass


class TTSFailed(RuntimeError):
    pass


class MiniMaxTTS:
    def __init__(self, settings):
        self.settings = settings

    async def synthesize(self, text: str) -> bytes:
        api_key = self.settings.minimax_api_key
        voice_id = self.settings.minimax_voice_id
        if not api_key or not voice_id:
            raise TTSNotConfigured("tts_not_configured")

        payload = {
            "model": "speech-2.8-turbo",
            "text": text[:10000],
            "stream": False,
            "language_boost": "Chinese",
            "output_format": "hex",
            "voice_setting": {
                "voice_id": voice_id,
                "speed": self.settings.minimax_tts_speed,
                "vol": 1,
                "pitch": 0,
            },
            "audio_setting": {
                "sample_rate": 32000,
                "bitrate": 128000,
                "format": "mp3",
                "channel": 1,
            },
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            for attempt in range(3):
                try:
                    resp = await client.post(
                        f"{self.settings.minimax_base_url}/v1/t2a_v2",
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json",
                        },
                        json=payload,
                    )
                    if resp.status_code in RETRYABLE and attempt < 2:
                        await asyncio.sleep(0.25 * (2**attempt) + random.random() * 0.15)
                        continue
                    resp.raise_for_status()
                    result = resp.json()
                    base_resp = result.get("base_resp", {})
                    if base_resp.get("status_code") != 0:
                        raise TTSFailed("minimax_api_error")
                    audio_hex = (result.get("data") or {}).get("audio")
                    if not audio_hex:
                        raise TTSFailed("minimax_no_audio")
                    return bytes.fromhex(audio_hex)
                except (httpx.TimeoutException, httpx.NetworkError):
                    if attempt == 2:
                        raise TTSFailed("tts_network_error")
                    await asyncio.sleep(0.25 * (2**attempt) + random.random() * 0.15)
        raise TTSFailed("tts_failed")
