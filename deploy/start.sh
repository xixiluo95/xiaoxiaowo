#!/usr/bin/env bash
# 小小我 · 启动（鲁班）：systemd --user 服务 xiaoxiaowo-preview（崩溃/重启自动拉起）。
# 端口/证书/环境在 ~/.config/systemd/user/xiaoxiaowo-preview.service 中定义。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=8443
LOG_FILE="$ROOT/deploy/logs/server.log"

mkdir -p "$ROOT/deploy/logs"
[ -f "$ROOT/deploy/certs/lan.pem" ] || { echo "[start] 缺少证书，见 deploy/README.md（mkcert）"; exit 1; }
[ -d "$ROOT/web/dist" ] || { echo "[start] 缺少 web/dist，先执行 deploy/build.sh"; exit 1; }

systemctl --user start xiaoxiaowo-preview
echo "[start] 已请求启动 xiaoxiaowo-preview，日志 $LOG_FILE"

for i in $(seq 1 60); do
  if curl -sk --max-time 2 "https://127.0.0.1:$PORT/api/health" 2>/dev/null | grep -q '"ok"'; then
    echo "[start] 就绪：https://127.0.0.1:$PORT/api/health -> ok（${i}s）"
    exit 0
  fi
  systemctl --user is-active --quiet xiaoxiaowo-preview || {
    echo "[start] 服务未存活："
    systemctl --user status xiaoxiaowo-preview --no-pager | tail -15
    exit 1
  }
  sleep 1
done
echo "[start] 60s 内未就绪，见日志 $LOG_FILE"
exit 1
