import asyncio, sys, json
from playwright.async_api import async_playwright
URL = sys.argv[1]; OUT = sys.argv[2]
KIT = open('tools/testkit.js').read()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 405, 'height': 860})
        errs = []
        pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto(URL); await pg.wait_for_timeout(1500)
        await pg.evaluate(KIT)
        MODE = sys.argv[3] if len(sys.argv) > 3 else 'detente'
        await pg.evaluate("App.save.seenTuto.basic=1; App.save.seenTuto.mode=1; App.save.story.seen.prologue=1; App.save.mode='%s'; Game.enterHub()" % MODE)
        stories = []
        log = []
        for day in range(1, 16):
            await pg.evaluate("Game.startDay(App.save.unlocked)")
            await pg.wait_for_timeout(2300)
            # use some boosters mid-day
            r = await pg.evaluate("""(function(){ var out=[]; T.ff(20,true);
                ['turbo','coeur','temps','chance'].forEach(function(id){ Game.useBooster(id); });
                out.push(T.ff(200,true)); return out.join(' '); })()""")
            await pg.wait_for_timeout(2600)
            info = await pg.evaluate("""(function(){var sh=Game.shift(); return {day: sh.day, win: sh.win, stars: sh.stars, earned: Math.round(sh.earned), goal: sh.goal, served: sh.served, lost: sh.lost, modals: document.querySelectorAll('.modal').length}})()""")
            # click through results + level ups -> hub
            for k in range(14):
                st = await pg.evaluate("Story.active() ? 'story' : document.querySelectorAll('.modal').length ? 'modal' : ''")
                if not st: break
                if st == 'story':
                    stories.append(await pg.evaluate("document.querySelector('.st-card .sub') ? document.querySelector('.st-card .sub').textContent : '?'"))
                    await pg.evaluate("Story.skip()")
                else:
                    await pg.evaluate("""(function(){var m=document.querySelectorAll('.modal'); var top=m[m.length-1];
                        var b=top.querySelector('.sq')||top.querySelector('.pill'); if(b) b.click();})()""")
                await pg.wait_for_timeout(450)
            # shop: buy cheapest affordable things through the UI
            bought = await pg.evaluate("""(function(){ var c=0;
                for (var i=0;i<30;i++){ var o=Progress.offers(App.save).filter(function(x){return !x.maxed&&!x.locked&&x.kind!=='booster'&&App.save.coins>=x.cost;});
                  if(!o.length)break; o.sort(function(a,b){return a.cost-b.cost;}); Progress.buy(App.save,o[0].kind,o[0].id); c++; }
                Scene.setMode('hub'); return c; })()""")
            await pg.evaluate("UI.shop('staff')"); await pg.wait_for_timeout(300)
            await pg.evaluate("UI.closeAll(); UI.levels()"); await pg.wait_for_timeout(300)
            await pg.evaluate("UI.closeAll()")
            lv = await pg.evaluate("App.save.level")
            log.append((info, bought, lv))
        await pg.screenshot(path=OUT)
        for l in log: print(l)
        print('chapters played:', stories)
        print('journal unread:', await pg.evaluate("Story.unreadCount()"), 'friends:', await pg.evaluate("JSON.stringify(App.save.friends)"), 'book:', await pg.evaluate("!!App.save.flags.livre"))
        print('errors:', errs[:10])
        await b.close()
asyncio.run(main())
