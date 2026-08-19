#!/bin/bash
# HB · Control — doble clic per arrencar el dashboard
# Atura qualsevol instancia anterior al port 7777, arrenca el servidor
# i obre el navegador. La finestra de Terminal es queda oberta; tancar-la
# atura el servidor automaticament.

DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(dirname "$DIR")"

# Atura instancia anterior (si n'hi ha)
OLD=$(lsof -ti:7777 2>/dev/null)
if [ -n "$OLD" ]; then
  echo "Aturant instancia anterior (PID $OLD)..."
  kill "$OLD" 2>/dev/null
  sleep 0.4
fi

echo "Arrencant HB · Control..."
python3 "$DIR/dash.py" &
SERVER_PID=$!

# Espera que el servidor respongui (max ~3s)
OK=0
for i in $(seq 1 10); do
  sleep 0.3
  if curl -sf http://127.0.0.1:7777/ > /dev/null 2>&1; then
    OK=1; break
  fi
done

if [ $OK -eq 0 ]; then
  echo "ERROR: el servidor no ha arrencat. Comprova que python3 esta instal·lat."
  exit 1
fi

echo "Dashboard obert a http://127.0.0.1:7777"
echo "Tanca aquesta finestra (o prem Ctrl+C) per aturar el servidor."
open http://127.0.0.1:7777

# Mantenim el script viu: quan es tanqui el Terminal, el servidor mor amb ell
wait $SERVER_PID
