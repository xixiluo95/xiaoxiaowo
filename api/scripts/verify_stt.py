"""STT 最小验证脚本：用本地 FunASR 模型把一段中文语音转成文字。

用法（在 api/ 目录下）：
    .venv-stt/bin/python scripts/verify_stt.py [音频文件路径]

默认音频：scripts/asr_example_zh.wav（FunASR 官方中文示例，16kHz 单声道 wav）。
模型目录取环境变量 FUNASR_MODEL_DIR，默认 ../data/models/SenseVoiceSmall。
"""
import os
import re
import sys

MODEL_DIR = os.environ.get(
    "FUNASR_MODEL_DIR",
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "models", "SenseVoiceSmall"),
)
DEFAULT_AUDIO = os.path.join(os.path.dirname(__file__), "asr_example_zh.wav")


def main() -> int:
    audio = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_AUDIO
    if not os.path.isdir(MODEL_DIR):
        print(f"FAIL: 模型目录不存在: {MODEL_DIR}")
        return 1
    if not os.path.isfile(audio):
        print(f"FAIL: 音频文件不存在: {audio}")
        return 1

    from funasr import AutoModel

    model = AutoModel(model=MODEL_DIR, disable_update=True)
    result = model.generate(input=audio)
    raw = "".join(seg.get("text", "") for seg in (result or [])).strip()
    # SenseVoice 输出带 <|zh|><|NEUTRAL|> 等元信息标签，展示时剔除
    text = re.sub(r"<\|[^|]*\|>", "", raw).strip()
    if not text:
        print(f"FAIL: 识别结果为空（raw={raw!r}）")
        return 1
    print(f"OK: {text}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
