# THIRD_PARTY_NOTICES — 小小我（黑客松 MVP）

本文档记录「小小我」项目全部第一梯队第三方依赖的版本锁定、许可证与用途。
所有版本与许可证均于 **2026-10-11** 重新核实（来源 URL 附在各条目中）。
本文件不是法律意见；正式发布前应根据实际复制代码范围复核 upstream `LICENSE`。

## 一、第一梯队依赖版本锁定

### 前端（npm）

| Package | 锁定版本 | 发布日期 | License | 用途 | Upstream |
|---|---|---|---|---|---|
| antd-mobile | 5.43.0 | 2026-09-14 | MIT | H5 移动端基础组件（Modal/Toast/Calendar/Input/Button） | https://github.com/ant-design/ant-design-mobile · https://www.npmjs.com/package/antd-mobile |
| @assistant-ui/react | 0.15.27 | 2026-10-10 | MIT | 聊天交互 primitives（Thread/Composer/Message），仅摘取交互模式与 registry 组件 | https://github.com/assistant-ui/assistant-ui · https://www.npmjs.com/package/@assistant-ui/react |
| @assistant-ui/react-markdown | 0.14.20 | 2026-10（随 0.15.x 线更新） | MIT | 消息 Markdown 渲染（如需） | 同上 |

**assistant-ui 摘取范围说明**：assistant-ui 采用 Radix 风格 primitives + shadcn 风格 registry（`assistant-ui add` 把组件源码拷入本仓库）。MIT 许可证允许复制，条件是保留 `licenses/assistant-ui-react-0.15.27.MIT.txt` 中的版权声明。建议只摘取 registry 中的 thread / composer / message / scroll 相关组件源码并重做视觉，不深度耦合其 runtime API——该仓 0.x 迭代极快（0.15.24 → 0.15.27 仅 4 天），直接依赖易遇 breaking change。React 与 Vite 本体（MIT）属通用基础设施，未列入逐项清单。

### 后端（pip）

| Package | 锁定版本 | 发布日期 | License | 用途 | Upstream |
|---|---|---|---|---|---|
| fastapi | 0.143.0 | 2026-10-08 | MIT | REST + WebSocket API | https://github.com/fastapi/fastapi · https://pypi.org/project/fastapi/ |
| uvicorn | 0.54.0 | 2026-09-25 | BSD-3-Clause | ASGI 服务器 | https://github.com/encode/uvicorn · https://pypi.org/project/uvicorn/ |
| pydantic | 2.14.0 | 2026-10-08 | MIT | 数据校验 / 结构化输出 schema | https://github.com/pydantic/pydantic · https://pypi.org/project/pydantic/ |
| httpx | 0.28.1 | 2024-12-06 | BSD-3-Clause | 异步 HTTP 客户端（MiniMax TTS Adapter） | https://github.com/encode/httpx · https://pypi.org/project/httpx/ |

### STT（pip + 模型）

| Package | 锁定版本 | 发布日期 | License | 用途 | Upstream |
|---|---|---|---|---|---|
| funasr | 1.4.16（PyPI；GitHub tag v1.4.16） | 2026-09-18 | MIT | 中文离线语音识别（STT Provider 首选） | https://github.com/modelscope/FunASR · https://pypi.org/project/funasr/ |

- 锁定点：GitHub release `v1.4.16`（2026-09-18）；main 分支最新核验提交 `e7e61293d3`（2026-10-08），仓库持续活跃。
- **最小部署方式**：`pip install funasr` + `AutoModel(model="paraformer-zh")` 离线管道，CPU 可推理；模型首次运行从 ModelScope 下载，可用 `MODELSCOPE_CACHE` 环境变量预置缓存目录并提前打包。
- **模型下载体积（2026-10-11 自 ModelScope 文件列表实测）**：
  - `iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch`：ASR 主模型 **~900 MB**（model.pt 900.7 MB）— https://modelscope.cn/models/iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch
  - `iic/speech_fsmn_vad_zh-cn-16k-common-pytorch`（VAD）：**~4 MB**
  - `iic/punc_ct-transformer_zh-cn-common-vocab272727-pytorch`（ct-punc-c，默认标点）：**~296 MB**；若用大标点模型 `punc_ct-transformer_cn-en-common-vocab471067-large` 则为 **~1.19 GB**
  - 备选 `iic/SenseVoiceSmall`（单模型多任务）：**~940 MB** — https://modelscope.cn/models/iic/SenseVoiceSmall
  - 流式备选 `speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-online`：**~889 MB**
- **黑客松建议**：默认管道（paraformer-zh + fsmn-vad + ct-punc-c）合计约 **1.2 GB**，必须赛前预下载进镜像/缓存卷；不要在比赛现场拉模型。

### MiniMax 参考实现（不进生产依赖）

| Repo | 锁定点 | 日期 | License | 用途 | Upstream |
|---|---|---|---|---|---|
| MiniMax-AI/MiniMax-MCP | main 分支 commit `0856b9aef8`（该仓无 GitHub release） | 2026-08-20 | MIT | 仅参考官方 TTS/voice API 调用模式，不作为运行时依赖 | https://github.com/MiniMax-AI/MiniMax-MCP |

### 云服务 API（非开源包，接口规格锁定）

| 服务 | 锁定项 | 核实日期 | 说明 | 来源 |
|---|---|---|---|---|
| DeepSeek API | Base URL `https://api.deepseek.com`；当前模型名 `deepseek-flash`（DeepSeek-V4.1-Flash）、`deepseek-v4-pro`（V4-Pro-0813）；JSON Output ✓、Tool Calls ✓、上下文 1M | 2026-10-11 | **注意：旧报告泛称 "DeepSeek" 需更新**——当前官方文档型号为 deepseek-flash / deepseek-v4-pro，旧名 deepseek-v4-flash 已退役并映射到 V4.1-Flash。黑客松对话+结构化情绪判断建议用 `deepseek-flash`（低延迟、并发上限 2500）。结构化输出用 JSON Output（`response_format={"type":"json_object"}`），情绪决策按 EmotionDecision schema 走 | https://api-docs.deepseek.com/quick_start/pricing |
| MiniMax TTS（T2A V2，HTTP） | `POST https://api.minimax.cn/v1/t2a_v2`（国内）/ `https://api.minimax.io/v1/t2a_v2`（国际）；Bearer API Key；`speech-2.8-turbo` **确认仍在官方 model 枚举中**（speech-2.8-hd / speech-2.8-turbo / speech-2.6-* / speech-02-* / speech-01-*） | 2026-10-11 | 关键字段：请求 `model/text/stream/voice_setting{voice_id,speed,vol,pitch,emotion}/audio_setting{sample_rate,bitrate,format,channel}/language_boost/output_format(hex|url)/text_normalization_mode/subtitle_enable`；响应 `data.audio`（hex 编码，非流式）、`data.status=2`、`extra_info.usage_characters`、`trace_id`、`base_resp.status_code==0` 为成功。text < 10000 字符，>3000 建议流式。**语气词标签（(laughs)/(sighs) 等）仅 speech-2.8 系列支持**——正好可用于情绪剧场表现力。限流见风险摘要 | https://platform.minimax.cn/docs/api-reference/speech-t2a-http |

## 二、红线复核（仅参考、未复制）

以下三个仓库**不进入本项目依赖树，未复制其任何代码**，仅在调研阶段阅读参考：

| Repo | 许可证核实结果（2026-10-11） | 结论 |
|---|---|---|
| langgenius/dify | GitHub 元数据 `NOASSERTION`；实际 LICENSE 为**修改版 Apache-2.0**：附加多租户运营限制与前端 LOGO/版权信息保留义务（© 2025 LangGenius）——非标准 OSS 许可证 | 仅参考，未复制；不引入依赖 ✅ |
| NVIDIA-NeMo/Guardrails | GitHub 元数据 `NOASSERTION`；实际 `LICENSE.md` 声明 **Apache-2.0**（NVIDIA），`NOASSERTION` 源于其非标准布局（LICENSE-Apache-2.0.txt + LICENCES-3rd-party/ 目录）。许可本身比原研究报告预想的宽松，但本项目按既定红线处理 | 仅参考，未复制；不引入依赖 ✅ |
| MiniMax-AI/awesome-minimax-integrations | 仓库根目录**无任何 LICENSE 文件**（GitHub `license: NONE`，main 分支核验）——法律上默认保留所有权利，代码不可复制 | 仅阅读参考，未复制；不引入依赖 ✅ |

## 三、风险摘要与降级建议（黑客松现场）

1. **FunASR 模型下载体积大（高危）**：默认管道合计约 1.2 GB（ASR 900 MB + VAD 4 MB + 标点 296 MB），现场 Wi-Fi 拉取必然翻车。降级链：① 赛前把 `MODELSCOPE_CACHE` 打进 Docker 镜像/数据卷；② 不行则 SenseVoiceSmall 单模型（940 MB）；③ 再降级用云 STT（MiniMax asr-1.0，注意仅充值用户可用，CONN 2 / 30,000 音频秒 TPM）；④ 兜底 whisper.cpp tiny/base（75/142 MB）。
2. **MiniMax TTS 限流（高危）**：官方限流表（2026-09-16 更新）——T2A v2 **免费用户 10 RPM / 充值用户 20 RPM**，按主账号+子账号合并计算。10 台评委设备同时对话，每轮一次 TTS 即可打满。对策：① 按 text-hash 缓存音频，重复话术直接命中；② 常用开场白/兜底语预生成；③ 请求失败退避重试（429/5xx）且 TTS 失败时只显示文本、对话不中断；④ 把「应用 10 并发」与「真实云 TTS 并发」分开压测，别把限流误诊为架构问题。来源：https://platform.minimax.cn/docs/guides/rate-limits
3. **DeepSeek 模型名漂移（中危）**：研究报告中的泛称已过时，锁代码前确认用 `deepseek-flash`；旧型号名会被映射/退役。JSON Output 确认支持，情绪 JSON 不要靠解析自然语言。
4. **assistant-ui 0.x 快速迭代（中危）**：4 天连发 3 版，API 不稳。对策：只摘 registry 组件源码入仓（MIT 允许），或用 `package-lock.json` 精确锁 0.15.27，不升级。
5. **现场依赖拉取（中危）**：npm/pip 全部走 lockfile + 赛前构建好单一镜像（前端 Vite build 产物由 FastAPI 容器直接托管），现场只做 `docker run`。
6. **API Key 泄露（高危红线）**：MiniMax/DeepSeek Key 只在后端，H5 bundle 中不得出现；验收时用手机浏览器 DevTools/抓包确认。

## 四、许可证文本

各依赖许可证全文见 `licenses/` 目录（均于 2026-10-11 从 upstream 仓库默认分支取得）：

- `antd-mobile-5.43.0.MIT.txt`
- `assistant-ui-react-0.15.27.MIT.txt`
- `fastapi-0.143.0.MIT.txt`
- `uvicorn-0.54.0.BSD-3-Clause.txt`
- `pydantic-2.14.0.MIT.txt`
- `httpx-0.28.1.BSD-3-Clause.txt`
- `funasr-1.4.16.MIT.txt`
- `minimax-mcp-0856b9aef8.MIT.txt`

MIT / BSD-3-Clause 均要求再分发时保留版权声明；本项目通过在仓库内保留 `licenses/` 与本文件满足该义务。
