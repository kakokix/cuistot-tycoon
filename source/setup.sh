#!/bin/sh
# Prepare a fresh checkout so that `python3 tools/build.py` works.
# Run from the source/ folder of the repository.
set -e
cd "$(dirname "$0")"
npm install --silent
mkdir -p build/vendor build/chars
cp vendor/three_entry.js build/vendor/three_entry.js
npx esbuild build/vendor/three_entry.js --bundle --minify --format=iife --target=es2017 --legal-comments=none --outfile=build/vendor/three.min.js
python3 tools/extract_assets.py ../update/game.html build/assets
cp icons/*.png build/
echo "setup ok"
