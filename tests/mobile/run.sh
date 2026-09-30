#!/bin/sh
# Uso: sh tests/mobile/run.sh <mobile|desktop> <grupo> [grupo...]
# Requiere: `node tests/mobile/serve.js` corriendo y la sesión playwright `f4h`
# abierta en http://localhost:8934 con login hecho (ver CLAUDE.md → Mobile).
set -e
VP=$1; shift
case "$VP" in
  mobile)  W=390;  H=844 ;;
  desktop) W=1440; H=900 ;;
  *) echo "viewport: mobile | desktop"; exit 2 ;;
esac
DIR=$(dirname "$0")
GRUPOS=$(node -e 'console.log(JSON.stringify(process.argv.slice(1)))' "$@")
FN=$(cat "$DIR/checks.js")
playwright-cli -s=f4h resize $W $H >/dev/null 2>&1
playwright-cli -s=f4h reload >/dev/null 2>&1
sleep 5
OUT=$(playwright-cli -s=f4h eval "async () => (${FN})(${GRUPOS})" --raw 2>/dev/null)
echo "$OUT"
echo "$OUT" | grep -q '"ok": *true'
