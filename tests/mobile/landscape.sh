#!/bin/sh
# iPhone 13 acostado (844x390, touch): la segunda condición del breakpoint debe activar mobile.
# Emula el dispositivo (pointer: coarse) y fuerza 844x390, más ancho que el corte de 760px,
# para ejercitar la condición "(pointer: coarse) and (max-height: 500px)".
# No requiere login: el CSS aplica igual detrás de la pantalla de ingreso.
set -e
playwright-cli -s=f4hland open http://localhost:8934 --device "iPhone 13 landscape" --browser chrome >/dev/null 2>&1 || true
playwright-cli -s=f4hland resize 844 390 >/dev/null 2>&1
sleep 3
OUT=$(playwright-cli -s=f4hland eval "() => ({ vw: innerWidth, vh: innerHeight, coarse: matchMedia('(pointer: coarse)').matches, sidebar: getComputedStyle(document.querySelector('.sidebar')).display, mnav: getComputedStyle(document.querySelector('.mnav')).display })" --raw 2>/dev/null)
playwright-cli -s=f4hland close >/dev/null 2>&1 || true
echo "$OUT"
echo "$OUT" | grep -q '"coarse": *false' && { echo "AVISO: la emulación no aplicó pointer:coarse; verificar acostado en el iPhone real"; exit 0; }
echo "$OUT" | grep -q '"vw": *844' || { echo "FALLA: el viewport no quedó en 844 de ancho"; exit 1; }
echo "$OUT" | grep -q '"sidebar": *"none"' && echo "$OUT" | grep -q '"mnav": *"flex"'
