#!/bin/bash
# 以無頭 Chrome 逐頁抓取渲染後 DOM，驗證前端各分頁真的能運作（非只讀原始碼）
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT=/tmp/chrome-verif
mkdir -p "$OUT"
PORT=${1:-3311}

run() { # $1=view  $2=額外查詢字串
  local view="$1" qs="$2" tag="p_${1}"
  "$CHROME" --headless=new --disable-gpu --no-first-run --no-default-browser-check \
    --user-data-dir="$OUT/$tag" --virtual-time-budget=12000 --dump-dom \
    "http://localhost:$PORT/index.html#/$view$qs" > "$OUT/$view.html" 2>"$OUT/$view.err" &
}

run overview
run map
run analytics
run knowledge
run routes

sleep 40
pkill -f "chrome-verif/p_" 2>/dev/null
sleep 1
for v in overview map analytics knowledge routes; do
  printf '%-10s %8s bytes\n' "$v" "$(wc -c < "$OUT/$v.html" | tr -d ' ')"
done
