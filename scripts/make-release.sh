#!/usr/bin/env bash
# 建立 GitHub Release（給沒有 gh CLI 的環境用）
#
# 用途：把 docs/releases/<tag>.md 當 Release 說明，對已推送的 tag 建立 Release。
# 權杖來源：macOS 鑰匙圈（git 推送用的 github.com 憑證），不寫進任何檔案。
#
# 用法：
#   scripts/make-release.sh v0.11.0                 # 說明用 docs/releases/v0.11.0.md
#   scripts/make-release.sh v0.11.0 notes.md        # 指定說明檔
#   REPO=owner/name scripts/make-release.sh v0.11.0 # 指定倉庫（預設猜 origin）
set -euo pipefail

TAG="${1:?用法: scripts/make-release.sh <tag> [說明檔]}"
NOTES="${2:-docs/releases/${TAG}.md}"
REPO="${REPO:-$(git config --get remote.origin.url | sed -E 's#.*github.com[:/]([^/]+/[^/.]+)(\.git)?#\1#')}"

[ -f "$NOTES" ] || { echo "找不到說明檔：$NOTES" >&2; exit 1; }

TOKEN="$(security find-internet-password -s github.com -w)"
if [ -z "$TOKEN" ]; then echo "鑰匙圈找不到 github.com 憑證" >&2; exit 1; fi

# 以檔案組 JSON，避免說明內文（引號、換行、中文）破壞 JSON 結構
BODY_FILE="$(mktemp -t release-body)"
python3 - "$TAG" "$NOTES" > "$BODY_FILE" <<'PY'
import json, sys
tag, notes = sys.argv[1], sys.argv[2]
body = open(notes, encoding='utf-8').read()
json.dump({'tag_name': tag, 'name': tag, 'body': body, 'draft': False, 'prerelease': False}, sys.stdout, ensure_ascii=False)
PY

echo "建立 Release：${REPO} ${TAG}（說明 ${NOTES}）"
HTTP="$(curl -sS -o /tmp/release-resp.json -w '%{http_code}' \
  -X POST -H "Authorization: Bearer ${TOKEN}" \
  -H 'Accept: application/vnd.github+json' \
  -H 'Content-Type: application/json' \
  --data-binary @"$BODY_FILE" \
  "https://api.github.com/repos/${REPO}/releases")"
rm -f "$BODY_FILE"

if [ "$HTTP" = "201" ]; then
  python3 -c "import json;d=json.load(open('/tmp/release-resp.json'));print('✓',d['tag_name'],d['html_url'])"
else
  echo "✗ HTTP ${HTTP}" >&2
  head -c 600 /tmp/release-resp.json >&2; echo >&2
  exit 1
fi
