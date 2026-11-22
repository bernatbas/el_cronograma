#!/bin/sh
# Genera la imatge de previsualització (1200×630) d'un idioma a partir d'og.html, amb Chrome sense finestra.
#   sh _tools/og/gen_og.sh es "La web que no se hizo en un día"   ->  img/og-es.png
# img/og.png (català) es va fer amb la mateixa plantilla; per refer-la: gen_og.sh ca "La web que no es va fer en un dia".
set -e
cd "$(dirname "$0")"
LANG_CODE="$1"; LEMA="$2"
[ -n "$LANG_CODE" ] && [ -n "$LEMA" ] || { echo "ús: gen_og.sh <idioma> \"<lema>\""; exit 1; }
OUT="../../img/og-$LANG_CODE.png"; [ "$LANG_CODE" = "ca" ] && OUT="../../img/og.png"
Q=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$LEMA")
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=1200,630 --virtual-time-budget=4000 \
  --screenshot="$OUT" "file://$PWD/og.html?lema=$Q" 2>/dev/null
echo "$OUT"
