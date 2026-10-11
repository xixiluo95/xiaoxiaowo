#!/usr/bin/env bash
# 小小我 · 构建脚本（鲁班）：构建 H5 前端产物 web/dist。
# 后端为 Python，无需构建；依赖安装在 api/.venv-stt（含 FunASR STT）。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT/web"
if [ ! -d node_modules ]; then
  echo "[build] node_modules 缺失，执行 npm ci"
  npm ci
fi
echo "[build] npm run build"
npm run build
echo "[build] 完成：web/dist"
