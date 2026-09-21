#!/bin/bash
# uso: ./_render.sh archivo.html ancho alto salida.png
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
D="$(cd "$(dirname "$1")" && pwd -W)"
F="$(basename "$1")"
"$CHROME" --headless --disable-gpu --hide-scrollbars --allow-file-access-from-files \
  --force-device-scale-factor=1 --default-background-color=00000000 \
  --window-size="$2,$3" --screenshot="$D/$4" "file:///$D/$F" 2>&1 | grep -iE "error|written" | head -2
