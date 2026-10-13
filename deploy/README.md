# deploy/ — 小小我本地 HTTPS 预览部署（鲁班维护）

## 组成

- `build.sh`：构建 H5 前端产物 `web/dist`（必要时自动 `npm ci`）。
- `start.sh`：启动 systemd --user 服务 `xiaoxiaowo-preview`（单元文件 `~/.config/systemd/user/xiaoxiaowo-preview.service`，Restart=on-failure，已 `enable` + `loginctl enable-linger`，崩溃/登出/重启自动拉起），随后做最多 60s 就绪检查。服务以 `api/.venv-stt`（含 FunASR STT）运行 uvicorn，HTTPS 用 `deploy/certs/` 下 mkcert 证书，静态目录指向 `web/dist`，环境变量经 `EnvironmentFile` 读仓库根 `.env`（只进进程环境，不入日志/回显）。日志 `deploy/logs/server.log`（亦可 `journalctl --user -u xiaoxiaowo-preview`）。
- `stop.sh`：停止服务。
- `status.sh`：服务状态 + `/api/health` 探测 + 打印局域网入口。
- `public_url.sh`：打印当前手机公网邀请链接、刷新二维码（`data/public-preview-qr.png`）、并按扫码路径探测可达性。

## 手机公网入口（临时隧道，鲁班维护）

公网访问走两条 systemd --user 服务，均依赖 `xiaoxiaowo-public-preview`（`deploy/public_preview.py`，监听 127.0.0.1:8444，用 `deploy/public-preview.env` 的 `PREVIEW_ACCESS_TOKEN` 做邀请制网关，数据库为隔离的 `data/public-preview.sqlite`）：

- `xiaoxiaowo-public-tunnel`：cloudflared 快速隧道，**当前首选**，单元里必须保留 `--protocol quic`。本机出口经 mihomo 代理时，TCP/http2 到 Cloudflare 边缘会被打断（日志 `TLS handshake with edge error: EOF`，自检也报 `TCP Connectivity ... blocked`），QUIC 通道可用，实测约 200KB/s。
- `xiaoxiaowo-public-ssh`：`ssh -R 80:127.0.0.1:8444 nokey@localhost.run` 反向隧道，**备用**，实测约 20KB/s（流量经 mihomo 的国外节点绕行）。
- 两条隧道每次重连都会换随机域名（`*.trycloudflare.com` / `*.lhr.life`），域名变化后跑一次 `bash deploy/public_url.sh` 取新链接与新二维码；该脚本优先探测 Cloudflare 通道，不通再回落备用通道。

链接形如 `https://<域名>/enter/<PREVIEW_ACCESS_TOKEN>`：手机扫二维码或点开即写入 24 小时有效的 `xxw_preview_access` Cookie，随后正常使用；直接访问根路径而无 Cookie 会返回 403 提示语。

## 传输优化（`api/app/http_cache.py` + GZipMiddleware）

- 压缩：`app/main.py` 挂 `GZipMiddleware(minimum_size=1024)`，按 Starlette 默认排除表跳过 `video/*`、`image/*` 等已压缩类型，并跳过 206 分段响应（视频 Range 播放不受影响）。`index.js` 358KB → 传输 118KB。
- 缓存：`StaticCacheMiddleware` 只补 `Cache-Control`——Vite 指纹资源（`index-<hash>.js`）`max-age=31536000, immutable`；`/assets/` 下不改名的素材（emotions/scenes/ui）`max-age=3600`；HTML 外壳 `no-cache`（改版即时可见）；`/api/*` `no-store`（会话数据不被浏览器或中间层缓存）。
- 改这两处后需重启 `xiaoxiaowo-preview` 与 `xiaoxiaowo-public-preview` 生效。


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
