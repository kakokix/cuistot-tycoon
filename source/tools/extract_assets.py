"""Recover the image assets (webp) from a built game (update/game.html).
The graphics are only published inside the built game, never as separate files.
usage: python3 tools/extract_assets.py ../update/game.html build/assets
"""
import sys, os, json, base64

src, out = sys.argv[1], sys.argv[2]
html = open(src, encoding="utf-8").read()
i = html.index("var ASSETS=") + len("var ASSETS=")
j = html.index(";\n", i)
assets = json.loads(html[i:j])
os.makedirs(out, exist_ok=True)
n = 0
for k, uri in assets.items():
    head, data = uri.split(",", 1)
    if not head.startswith("data:image/webp;base64"):
        continue
    open(os.path.join(out, k + ".webp"), "wb").write(base64.b64decode(data))
    n += 1
print(n, "assets extracted to", out)
