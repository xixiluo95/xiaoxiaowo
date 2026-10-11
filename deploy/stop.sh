#!/usr/bin/env bash
# 小小我 · 停止（鲁班）
set -euo pipefail
systemctl --user stop xiaoxiaowo-preview
echo "[stop] 已停止 xiaoxiaowo-preview"
