#!/usr/bin/env bash
# 小小我 H5 四情绪循环素材处理脚本（SHIY-382）
# 输入：源目录下 9 个 MP4（只读）；输出：本目录下 <key>-loop.mp4 与 <key>-poster.jpg
# 依赖：本机 ffmpeg 6.x（chromakey / despill / overlay）
set -euo pipefail

SRC="${SRC:-/home/xixil/下载/黑客松/ui/背景人物动画视频}"
OUT="$(cd "$(dirname "$0")" && pwd)"

# 业务键|背景文件|角色文件|chromakey similarity|blend
# calm 采用 calm_character.mp4（30fps、比例一致、发光眼睛版本）
ITEMS=(
  "calm|calm_background.mp4|calm_character.mp4|0.22|0.06"
  "joy|joy-background.mp4|joy-character.mp4|0.30|0.06"
  "anger|anger-background.mp4|anger-character.mp4|0.25|0.08"
  "sadness|sad-background.mp4|sad-character.mp4|0.22|0.06"
)

for item in "${ITEMS[@]}"; do
  IFS='|' read -r key bg char sim blend <<<"$item"
  echo "== ${key}: ${bg} + ${char} (sim=${sim} blend=${blend})"
  ffmpeg -v error -y \
    -i "$SRC/$bg" -i "$SRC/$char" -filter_complex \
    "[1:v]format=rgba,chromakey=0x00FF00:${sim}:${blend},despill=type=green[ck];[0:v][ck]overlay=0:0:shortest=1,fps=30,format=yuv420p[out]" \
    -map "[out]" -an -t 4 \
    -c:v libx264 -crf 23 -preset slow -pix_fmt yuv420p -movflags +faststart \
    "$OUT/${key}-loop.mp4"
  ffmpeg -v error -y -ss 2 -i "$OUT/${key}-loop.mp4" -frames:v 1 -q:v 2 \
    "$OUT/${key}-poster.jpg"
done

echo "== done =="
for item in "${ITEMS[@]}"; do
  IFS='|' read -r key _ _ _ _ <<<"$item"
  ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height,r_frame_rate,pix_fmt,duration,nb_frames \
    -of default=nw=1 "$OUT/${key}-loop.mp4" | sed "s/^/${key} /"
done
