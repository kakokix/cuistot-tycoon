#!/bin/sh
# Build the Windows/Linux/Mac apps (Neutralino) from ../dist/desktop/index.html
set -e
cd "$(dirname "$0")"
GAME="${GAME:-$(cd .. && pwd)}"
mkdir -p resources/js
cp "$GAME/dist/desktop/index.html" resources/index.html
[ -f resources/js/neutralino.js ] || npx --prefix "$GAME" neu update
npx --prefix "$GAME" neu build --release --embed-resources
ls -la dist/CuistotTycoon/
