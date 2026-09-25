#!/usr/bin/env bash
# 用無頭 Chrome 傾印 DOM 並檢查片段（看門狗版：這台機器的 Chrome 常不自行結束）
set -u
URL="$1"; OUT="$2"; shift 2
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROF="$(dirname "$OUT")/prof-$(basename "$OUT" .html)"
rm -rf "$PROF"
"$CHROME" --headless=new --disable-gpu --no-first-run --no-default-browser-check \
  --user-data-dir="$PROF" --virtual-time-budget=9000 --window-size=1440,1600 \
  --dump-dom "$URL" > "$OUT" 2>/dev/null &
PID=$!
for _ in $(seq 1 40); do sleep 1; kill -0 "$PID" 2>/dev/null || break; done
kill -9 "$PID" 2>/dev/null
echo "檔案大小：$(wc -c < "$OUT") bytes"
for pat in "$@"; do
  if grep -q -- "$pat" "$OUT"; then echo "  ✓ 有：$pat"; else echo "  ✗ 沒有：$pat"; fi
done
