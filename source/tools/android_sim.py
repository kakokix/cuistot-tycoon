import asyncio, sys
from playwright.async_api import async_playwright
URL = sys.argv[1]
INIT = """
window.__store = {}; window.__log = [];
window.AndroidBridge = {
  load: function(k){ window.__log.push('load'); return window.__store[k] === undefined ? null : window.__store[k]; },
  save: function(k,v){ window.__store[k] = v; window.__log.push('save'); },
  vibrate: function(ms){ window.__log.push('vib'+ms); },
  exit: function(){ window.__log.push('EXIT'); }
};
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 400, 'height': 860}, has_touch=True, is_mobile=True)
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.add_init_script(INIT)
        await pg.goto(URL); await pg.wait_for_timeout(1500)
        r = []
        r.append(await pg.evaluate("Platform.kind + ' backend=' + Store.backend() + ' canExit=' + Platform.canExit() + ' fs=' + Platform.canFullscreen()"))
        r.append(await pg.evaluate("window.onAndroidBack()"))          # title -> exit confirm
        r.append(await pg.evaluate("document.querySelectorAll('.modal').length"))
        await pg.evaluate("document.querySelectorAll('.modal .pill')[1].click()")  # OUI
        await pg.wait_for_timeout(300)
        r.append(await pg.evaluate("window.__log.indexOf('EXIT') >= 0"))
        await pg.evaluate("App.save.story.seen.prologue=1; App.save.seenTuto.mode=1; Game.enterHub(); Game.startDay(1)"); await pg.wait_for_timeout(2500)
        r.append(await pg.evaluate("window.onAndroidBack()"))          # in shift -> pause
        r.append(await pg.evaluate("document.querySelectorAll('.modal').length"))
        r.append(await pg.evaluate("window.onAndroidBack()"))          # close pause
        await pg.wait_for_timeout(300)
        r.append(await pg.evaluate("document.querySelectorAll('.modal').length"))
        await pg.tap('.station')  # touch tap first station
        await pg.wait_for_timeout(300)
        r.append(await pg.evaluate("Game.shift().stations[0].cooking.length + Game.shift().stations[0].ready"))
        await pg.evaluate("window.onAppPause()"); await pg.wait_for_timeout(200)
        r.append(await pg.evaluate("JSON.parse(window.__store['cuistot_tycoon_v1']).level"))
        r.append(await pg.evaluate("document.querySelectorAll('.modal').length"))
        await pg.evaluate("window.onAppResume()")
        # reload: data must come back from bridge
        await pg.evaluate("App.save.coins = 777; Store.save(App.save)")
        st = await pg.evaluate("window.__store")
        await pg.add_init_script("window.__store = %s;" % __import__('json').dumps(st))
        await pg.reload(); await pg.wait_for_timeout(1500)
        r.append(await pg.evaluate("App.save.coins"))
        print(r); print('errors:', errs[:5])
        await b.close()
asyncio.run(main())
