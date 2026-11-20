#!/bin/sh
# Seedup stage-1 local check: staged added lines only. Blockers stop the commit, warnings only print.
command -v node >/dev/null 2>&1 || { echo "Seedup: node가 없어 커밋 전 검사를 건너뜁니다."; exit 0; }
root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
[ -f "$root/.seedup/audit.mjs" ] || { echo "Seedup: $root/.seedup/audit.mjs가 없어 커밋 전 검사를 건너뜁니다."; exit 0; }
git -C "$root" diff --cached -U0 --no-color | node "$root/.seedup/audit.mjs"
