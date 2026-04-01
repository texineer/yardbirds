#!/usr/bin/env bash
# BleacherBox Live — stream AI-processed video to YouTube Live
#
# Usage:
#   ./stream.sh STREAM_KEY [INPUT]
#
#   STREAM_KEY  Your YouTube Live stream key (from YouTube Studio > Go Live)
#   INPUT       Camera device or video file (default: /dev/video0)
#
# Examples:
#   ./stream.sh abc123-xyz-456
#   ./stream.sh abc123-xyz-456 /dev/video1
#   ./stream.sh abc123-xyz-456 game_footage.mp4
#
# Requirements: python3, ffmpeg, all AI deps installed (pip install -r ../ai-service/requirements.txt)

set -euo pipefail

STREAM_KEY="${1:-}"
INPUT="${2:-/dev/video0}"
WIDTH=1280
HEIGHT=720
FPS=30
BITRATE=4500k
RTMP_URL="rtmp://a.rtmp.youtube.com/live2"

if [[ -z "$STREAM_KEY" ]]; then
  echo "Usage: $0 STREAM_KEY [INPUT_DEVICE_OR_FILE]" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI_DIR="$SCRIPT_DIR/../ai-service"

echo "[stream] Starting BleacherBox Live broadcast"
echo "[stream] Input: $INPUT"
echo "[stream] Resolution: ${WIDTH}x${HEIGHT} @ ${FPS}fps"
echo "[stream] Streaming to YouTube Live..."

python3 "$AI_DIR/main.py" \
  --input "$INPUT" \
  --width "$WIDTH" \
  --height "$HEIGHT" \
  --fps "$FPS" \
  | ffmpeg \
    -f rawvideo \
    -pix_fmt bgr24 \
    -s "${WIDTH}x${HEIGHT}" \
    -r "$FPS" \
    -i pipe:0 \
    -c:v libx264 \
    -preset veryfast \
    -tune zerolatency \
    -b:v "$BITRATE" \
    -maxrate "$BITRATE" \
    -bufsize 9000k \
    -pix_fmt yuv420p \
    -g $((FPS * 2)) \
    -f flv \
    "${RTMP_URL}/${STREAM_KEY}"
