#!/usr/bin/env bash
# 小小我 · 状态检查（鲁班）：服务状态 + HTTPS 健康 + 局域网入口
set -euo pipefail
PORT=8443
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"

systemctl --user status xiaoxiaowo-preview --no-pager | head -5 || true
echo -n "健康：https://127.0.0.1:$PORT/api/health -> "
curl -sk --max-time 3 "https://127.0.0.1:$PORT/api/health" || echo "不可达"
echo
echo "局域网入口：https://$LAN_IP:$PORT/ （手机需信任 mkcert 根证书，见 deploy/README.md）"
echo "日志：deploy/logs/server.log（或 journalctl --user -u xiaoxiaowo-preview）"
