"""Screenshot helper.
usage: python3 shot.py URL OUT.png WIDTH HEIGHT [WAIT_MS] [SCALE] [JS_SNIPPETS...]
Each JS snippet is evaluated in order with WAIT_MS pause after each; snippet "@shot:name.png" takes an extra screenshot.
"""
import sys, asyncio
from playwright.async_api import async_playwright

async def main():
    url, out, w, h = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
    wait = int(sys.argv[5]) if len(sys.argv) > 5 else 800
    scale = float(sys.argv[6]) if len(sys.argv) > 6 else 1
    snippets = sys.argv[7:]
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width": w, "height": h}, device_scale_factor=scale)
        logs = []
        pg.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
        pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        await pg.goto(url)
        await pg.wait_for_timeout(wait)
        for s in snippets:
            if s.startswith("@shot:"):
                await pg.screenshot(path=s[6:])
                continue
            if s.startswith("@wait:"):
                await pg.wait_for_timeout(int(s[6:]))
                continue
            if s.startswith("@click:"):
                xy = s[7:].split(",")
                await pg.mouse.click(float(xy[0]), float(xy[1]))
                await pg.wait_for_timeout(wait)
                continue
            try:
                r = await pg.evaluate(s)
                if r is not None:
                    logs.append(f"[eval] {str(r)[:500]}")
            except Exception as e:
                logs.append(f"[evalerror] {e}")
            await pg.wait_for_timeout(wait)
        await pg.screenshot(path=out, full_page=True)
        for l in logs[:60]:
            print(l)
        await b.close()

asyncio.run(main())
