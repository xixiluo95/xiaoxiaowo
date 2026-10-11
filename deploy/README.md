# deploy/ — 小小我本地 HTTPS 预览部署（鲁班维护）

## 组成

- `build.sh`：构建 H5 前端产物 `web/dist`（必要时自动 `npm ci`）。
- `start.sh`：启动 systemd --user 服务 `xiaoxiaowo-preview`（单元文件 `~/.config/systemd/user/xiaoxiaowo-preview.service`，Restart=on-failure，已 `enable` + `loginctl enable-linger`，崩溃/登出/重启自动拉起），随后做最多 60s 就绪检查。服务以 `api/.venv-stt`（含 FunASR STT）运行 uvicorn，HTTPS 用 `deploy/certs/` 下 mkcert 证书，静态目录指向 `web/dist`，环境变量经 `EnvironmentFile` 读仓库根 `.env`（只进进程环境，不入日志/回显）。日志 `deploy/logs/server.log`（亦可 `journalctl --user -u xiaoxiaowo-preview`）。
- `stop.sh`：停止服务。
- `status.sh`：服务状态 + `/api/health` 探测 + 打印局域网入口。

## 一次性准备

```bash
# 局域网 HTTPS 证书（手机麦克风要求安全上下文）
mkcert -cert-file deploy/certs/lan.pem -key-file deploy/certs/lan-key.pem \
  <本机局域网IP> localhost 127.0.0.1 $(hostname)
```

## 手机信任根证书（每台手机一次）

mkcert 根证书在 `mkcert -CAROOT` 输出的目录下（本机 `~/.local/share/mkcert/rootCA.pem`）。
把它（`rootCA.pem`，**仅 .pem 公钥证书，绝不传 rootCA-key.pem**）发到手机并安装为受信任的 CA：
安卓「设置 → 安全 → 加密与凭据 → 安装证书 → CA 证书」；iOS 安装描述文件后在「关于本机 → 证书信任设置」中开启完全信任。
装好后手机访问 `https://<局域网IP>:8443/` 才是安全上下文，`getUserMedia` 麦克风才可用。

## 端口约定

8443 为本项目预览端口；8000 被 xiaozhi-esp32-server 占用、8080 为 code-server、3000 已占用，均不抢占。

## 已知外部依赖

- DeepSeek（对话/情绪判断）：`.env` 的 `DEEPSEEK_API_KEY` 为空时 `/api/chat` 不可用（TTS/STT/页面浏览不受影响）。
- MiniMax TTS：`MINIMAX_API_KEY`/`MINIMAX_VOICE_ID` 已配置，仅服务端读取。
- 合成语速：`MINIMAX_TTS_SPEED` 默认 `1.25`，可在 `.env` 调整（范围 `0.5–2.0`，`1.0` 为原速）。修改配置或 API 代码后执行 `systemctl --user restart xiaoxiaowo-preview`，再运行 `bash deploy/status.sh` 检查健康；`start.sh` 不会重启已经运行的服务。新语速仅作用于重新生成的语音，已生成的音频需重新请求。
- FunASR STT：本地模型 `data/models/SenseVoiceSmall`，CPU 推理，无需联网。
