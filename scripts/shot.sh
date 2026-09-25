#!/usr/bin/env bash
# 用無頭 Chrome 截圖（看門狗：這台機器的 Chrome 常不自行結束）
# 用法：bash scripts/shot.sh <URL> <輸出.png> [寬度] [高]
set -u
URL="$1"; OUT="$2"; W="${3:-1400}"; H="${4:-2400}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p "$(dirname "$OUT")"
PROF="$(dirname "$OUT")/prof-shot-$(basename "$OUT" .png)"
rm -rf "$PROF"
"$CHROME" --headless=new --disable-gpu --no-first-run --no-default-browser-check \
  --user-data-dir="$PROF" --virtual-time-budget=12000 --window-size="$W,$H" \
  --screenshot="$OUT" "$URL" >/dev/null 2>&1 &
PID=$!
for _ in $(seq 1 60); do
  sleep 1
  if [ -s "$OUT" ] && [ "$(stat -f%z "$OUT")" -gt 12000 ]; then break; fi
  kill -0 "$PID" 2>/dev/null || break
done
kill -9 "$PID" 2>/dev/null
rm -rf "$PROF"
if [ -s "$OUT" ]; then echo "✓ 已截圖：${OUT}（$(stat -f%z "$OUT") bytes）"; else echo "✗ 截圖失敗：${OUT}"; exit 1; fi
