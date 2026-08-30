#!/bin/bash
# HB · Control — doble clic per arrencar el dashboard
# Atura qualsevol instancia anterior al port 7777, arrenca el servidor
# i obre el navegador. En aturar-lo (boto Atura o Ctrl+C) es tanca tambe
# aquesta finestra de Terminal.

DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(dirname "$DIR")"
TTY_MEU="$(tty)"

# En sortir, tanca NOMES la finestra de Terminal que executa aquest script:
# la busquem pel seu tty, que es l'unic identificador que no depen de quina
# finestra estigui al davant. Si el terminal no es el Terminal.app (iTerm,
# VS Code...), l'osascript no troba res i no passa res: el servidor ja es mort.
tanca_finestra() {
  [ -n "$TTY_MEU" ] || return 0
  osascript >/dev/null 2>&1 <<EOF &
tell application "Terminal"
  repeat with w in windows
    try
      repeat with t in tabs of w
        if tty of t is "$TTY_MEU" then
          close w
          return
        end if
      end repeat
    end try
  end repeat
end tell
EOF
}
trap tanca_finestra EXIT

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
echo "Prem Atura al dashboard (o Ctrl+C aqui) per aturar-lo i tancar aquesta finestra."
open http://127.0.0.1:7777

# Mantenim el script viu: quan es tanqui el Terminal, el servidor mor amb ell
wait $SERVER_PID
