"""Bundle the game into one self-contained HTML file (dist/index.html).
usage: python3 tools/build.py
"""
import base64, os, json, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
ASSETS = os.path.join(ROOT, "build", "assets")
CHARS = os.path.join(ROOT, "build", "chars")
OUT = os.path.join(ROOT, "dist", "index.html")
NM = os.path.join(ROOT, "node_modules", "@fontsource")

JS_ORDER = ["data.js", "sim.js", "progress.js", "util.js", "art.js", "audio.js", "scene.js", "ui.js", "story.js", "world.js", "achievements.js", "updater.js", "view3d.js", "game.js", "main.js"]


def b64(path, mime):
    return "data:%s;base64,%s" % (mime, base64.b64encode(open(path, "rb").read()).decode())


def main():
    css = open(os.path.join(SRC, "style.css"), encoding="utf-8").read()
    css = css.replace("@font_lg", b64(os.path.join(NM, "luckiest-guy/files/luckiest-guy-latin-400-normal.woff2"), "font/woff2"))
    css = css.replace("@font_fr6", b64(os.path.join(NM, "fredoka/files/fredoka-latin-600-normal.woff2"), "font/woff2"))
    css = css.replace("@font_fr7", b64(os.path.join(NM, "fredoka/files/fredoka-latin-700-normal.woff2"), "font/woff2"))

    files = {}
    for d in (ASSETS, CHARS):
        if not os.path.isdir(d):
            continue
        for f in os.listdir(d):
            if f.endswith(".webp") and not f.startswith("_"):
                files[f[:-5]] = os.path.join(d, f)
    assets = {k: b64(files[k], "image/webp") for k in sorted(files)}   # sorted: same output whatever the folders
    ver = json.load(open(os.path.join(SRC, "version.json"), encoding="utf-8"))
    js = "var APP_VERSION=%s,APP_LABEL=%s,APP_BUILD=%d,APP_NOTES=%s;\n" % (
        json.dumps(ver["version"]), json.dumps(ver["label"]), ver["build"], json.dumps(ver["notes"], ensure_ascii=False))
    js += "var ASSETS=" + json.dumps(assets, separators=(",", ":")) + ";\n"
    js += "\n// ---- three.js (MIT license, threejs.org) ----\n" + open(os.path.join(ROOT, "build", "vendor", "three.min.js"), encoding="utf-8").read() + "\n"
    for f in JS_ORDER:
        code = open(os.path.join(SRC, "js", f), encoding="utf-8").read()
        js += "\n// ---- %s ----\n" % f + code + "\n"
    assert "</script" not in js.lower(), "script terminator in JS"

    html = open(os.path.join(SRC, "index.html"), encoding="utf-8").read()
    fav = os.path.join(ROOT, "build", "icon64.png")
    html = html.replace("@favicon", b64(fav, "image/png") if os.path.exists(fav) else "data:,")
    html = html.replace("/*@CSS@*/", css).replace("/*@JS@*/", js)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, "w", encoding="utf-8").write(html.replace("<!--@PLATFORM@-->", ""))
    desk = os.path.join(ROOT, "dist", "desktop", "index.html")
    os.makedirs(os.path.dirname(desk), exist_ok=True)
    open(desk, "w", encoding="utf-8").write(html.replace("<!--@PLATFORM@-->", '<script src="/js/neutralino.js"></script>'))
    # ---- online update channel (pushed to github.com/kakokix/cuistot-tycoon) ----
    import hashlib
    upd = os.path.join(ROOT, "dist", "update")
    os.makedirs(upd, exist_ok=True)
    web_html = open(OUT, "rb").read()
    desk_html = open(desk, "rb").read()
    open(os.path.join(upd, "game.html"), "wb").write(web_html)
    open(os.path.join(upd, "desktop.html"), "wb").write(desk_html)
    base = "https://raw.githubusercontent.com/kakokix/cuistot-tycoon/main/"
    manifest = {
        "version": ver["version"], "label": ver["label"], "build": ver["build"], "notes": ver["notes"],
        "web": {"url": base + "update/game.html", "sha256": hashlib.sha256(web_html).hexdigest(), "size": len(web_html)},
        "desktop": {"url": base + "update/desktop.html", "sha256": hashlib.sha256(desk_html).hexdigest(), "size": len(desk_html),
                    "minNative": 1, "exe": base + "download/CuistotTycoon.exe"},
        "android": {"minNative": 2, "apk": base + "download/CuistotTycoon.apk"},
    }
    json.dump(manifest, open(os.path.join(upd, "version.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    open(os.path.join(ROOT, "dist", "build.txt"), "w").write(str(ver["build"]))
    print("built", OUT, round(os.path.getsize(OUT) / 1024), "KB", "| version", ver["label"], "build", ver["build"])


if __name__ == "__main__":
    main()
