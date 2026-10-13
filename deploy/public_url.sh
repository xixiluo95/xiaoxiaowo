#!/usr/bin/env bash
# 小小我 · 手机公网入口（鲁班）：打印当前可用链接、刷新二维码、做一次按扫码路径的可达性探测
#
# 两条隧道二选一，都依赖 xiaoxiaowo-public-preview：
#   1) xiaoxiaowo-public-tunnel（Cloudflare 快速隧道 / QUIC）——默认首选，实测 ~200KB/s
#   2) xiaoxiaowo-public-ssh（localhost.run 反向隧道）——备用，实测 ~20KB/s
# 两者每次重连都会换随机域名，因此域名变化后跑一次本脚本即可拿到新链接与新二维码。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CF_LOG="$ROOT/deploy/logs/public-tunnel.log"
SSH_LOG="$ROOT/deploy/logs/public-ssh.log"
ENVFILE="$ROOT/deploy/public-preview.env"
OUT_TXT="$ROOT/data/public-preview-url.txt"
OUT_PNG="$ROOT/data/public-preview-qr.png"
PROXY="http://127.0.0.1:7890"

if [ ! -f "$ENVFILE" ]; then
  echo "缺少 $ENVFILE（含 PREVIEW_ACCESS_TOKEN）" >&2
  exit 1
fi
TOKEN="$(grep '^PREVIEW_ACCESS_TOKEN=' "$ENVFILE" | cut -d= -f2)"

# 邀请制网关：未带 cookie 直接请求 /api/health 会得到 403，所以按手机扫码的真实路径探测
probe_link() {
  local base="$1"
  local direct
  direct="$(curl -s -o /dev/null -w '%{http_code}' -L --cookie-jar /dev/null --max-time 15 "$base/enter/$TOKEN" 2>/dev/null || true)"
  if [ "$direct" = "200" ]; then
    echo "200 direct"
    return
  fi
  if curl -s -o /dev/null --max-time 3 "$PROXY" 2>/dev/null; then
    local via
    via="$(curl -s -o /dev/null -w '%{http_code}' -L --cookie-jar /dev/null --max-time 20 --proxy "$PROXY" "$base/enter/$TOKEN" 2>/dev/null || true)"
    echo "$via 经本机代理"
    return
  fi
  echo "${direct:-无响应} 直连"
}

PICKED=""
PICKED_HOST=""
PICKED_NOTE=""
for pair in "cloudflare-quic:$CF_LOG:https://[a-z0-9-]+\.trycloudflare\.com" "localhost.run-ssh:$SSH_LOG:https://[a-z0-9]+\.lhr\.life"; do
  name="${pair%%:*}"; rest="${pair#*:}"; log="${rest%%:*}"; pattern="${rest#*:}"
  [ -f "$log" ] || continue
  host="$(grep -ohE "$pattern" "$log" 2>/dev/null | tail -n 1 || true)"
  [ -n "$host" ] || continue
  read -r code note <<<"$(probe_link "$host")"
  if [ "$code" = "200" ]; then
    PICKED="$host"; PICKED_HOST="$name"; PICKED_NOTE="$note"
    break
  fi
  echo "（$name 当前不可用：$(echo "$host" | sed 's|https://||') 探测返回 $code）" >&2
done

if [ -z "$PICKED" ]; then
  echo "两条隧道都没探测通。可依次尝试：" >&2
  echo "  systemctl --user restart xiaoxiaowo-public-tunnel" >&2
  echo "  systemctl --user restart xiaoxiaowo-public-ssh" >&2
  exit 2
fi

URL="$PICKED/enter/$TOKEN"
printf '%s\n' "$URL" > "$OUT_TXT"
chmod 600 "$OUT_TXT"

python3 - "$URL" "$OUT_PNG" <<'PY'
import sys
import qrcode

url, out = sys.argv[1], sys.argv[2]
img = qrcode.make(url, box_size=10, border=3)
img.save(out)
PY

echo "公网入口：$PICKED_HOST（$PICKED_NOTE 探测邀请链接 -> 200）"
echo "  邀请链接：$URL"
echo "  链接文件：$OUT_TXT"
echo "  二维码：  $OUT_PNG（手机扫码即可打开，24 小时内免重复输入）"
