"""Resize/convert the jungle UI pack PNGs into compact WebP files used by the game.
usage: python3 -I prep_assets.py PACK_PNG_DIR PSD_EXTRACT_DIR OUT_DIR
"""
import sys, os, json
from PIL import Image

src, psd, out = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(out, exist_ok=True)

# name: (path relative to pack PNG dir or psd dir, target width in px)
M = {
    "bg_jungle": ("menu/bg.png", 1080),
    "bg_sky": ("bubble/bg.png", 720),
    "leaf": ("@leaf_blank.png", 700),
    "tex_wood": ("@logo_texture_wood.png", 900),
    "board_a": ("pause/bg.png", 900),
    "board_b": ("you_win/bg.png", 820),
    "board_c": ("shop/bg.png", 1000),
    "board_d": ("upgrade/bg.png", 980),
    "paper_a": ("pause/table.png", 760),
    "paper_b": ("you_win/table.png", 720),
    "paper_c": ("shop/table.png", 1000),
    "paper_d": ("upgrade/table.png", 960),
    "card": ("shop/4.png", 300),
    "pill_green": ("shop/btn.png", 308),
    "btn_red": ("upgrade/btn.png", 220),
    "btn_round": ("bubble/btn_1.png", 130),
    "btn_close": ("shop/close_2.png", 120),
    "big_play": ("menu/play.png", 330),
    "big_about": ("menu/about.png", 180),
    "big_leader": ("menu/leader.png", 180),
    "big_prize": ("menu/prize.png", 180),
    "big_setting": ("menu/setting.png", 180),
    "slider_track": ("settings/93.png", 700),
    "slider_fill": ("settings/94.png", 457),
    "tog_off": ("settings/95.png", 200),
    "tog_on": ("settings/96.png", 200),
    "plus": ("settings/97.png", 93),
    "minus": ("settings/98.png", 93),
    "pip_off": ("upgrade/a.png", 37),
    "pip_on": ("upgrade/b.png", 37),
    "dot_red": ("upgrade/dot.png", 68),
    "heart": ("upgrade/heart.png", 140),
    "luck": ("upgrade/luck.png", 140),
    "star": ("upgrade/star.png", 102),
    "time": ("upgrade/time.png", 140),
    "bolt": ("shop/ico1.png", 90),
    "tile": ("level_select/table.png", 200),
    "lock": ("level_select/lock.png", 80),
    "lstar1": ("level_select/star_1.png", 200),
    "lstar2": ("level_select/star_2.png", 200),
    "lstar3": ("level_select/star_3.png", 200),
    "lstar4": ("level_select/star_4.png", 200),
    "dot_a": ("level_select/dot_a.png", 50),
    "dot_d": ("level_select/dot_d.png", 50),
    "wstar1": ("you_win/star_1.png", 520),
    "wstar2": ("you_win/star_2.png", 520),
    "wstar3": ("you_win/star_3.png", 520),
    "wstar4": ("you_win/star_4.png", 520),
    "bar_bg": ("bubble/bgload.png", 574),
    "bar_fill": ("bubble/load.png", 367),
    "bar_stripe": ("match3/load.png", 700),
    "bar_bg2": ("match3/bgload.png", 900),
    "lb_bg": ("load_bar/bg.png", 900),
    "lb_cyan": ("load_bar/1.png", 600),
    "lb_green": ("load_bar/2.png", 600),
    "lb_yellow": ("load_bar/3.png", 600),
    "clock": ("bubble/clock.png", 82),
    "pill_brown": ("bubble/table.png", 224),
    "hud_top": ("bubble/up.png", 1080),
    "hud_bot": ("bubble/down.png", 1080),
    "btn_pause": ("bubble/pause.png", 123),
    "sstar1": ("bubble/star_1.png", 50),
    "sstar2": ("bubble/star_2.png", 68),
    "sstar3": ("bubble/star_3.png", 91),
    "bubble1": ("clouds/1.png", 260),
    "bubble2": ("clouds/2.png", 260),
    "bubble3": ("clouds/3.png", 260),
    "bubble4": ("clouds/4.png", 260),
    "plank1": ("match3/table_1.png", 473),
    "plank2": ("match3/table_2.png", 365),
    "scroll": ("upgrade/scroll.png", 41),
}
for b in ["about", "close", "faq", "leader", "menu", "misic", "music_off", "next", "ok", "pause",
          "play", "prew", "prize", "restart", "settings", "shop", "sound", "sound_off", "upgrade"]:
    M["b_" + b] = ("btn/%s.png" % b, 150)

manifest = {}
total = 0
for name, (rel, w) in M.items():
    p = os.path.join(psd, rel[1:]) if rel.startswith("@") else os.path.join(src, rel)
    im = Image.open(p).convert("RGBA")
    # trim fully transparent borders
    bbox = im.getchannel("A").getbbox()
    if bbox:
        im = im.crop(bbox)
    if im.width > w:
        h = round(im.height * w / im.width)
        im = im.resize((w, h), Image.LANCZOS)
    o = os.path.join(out, name + ".webp")
    im.save(o, "WEBP", quality=84, method=6)
    sz = os.path.getsize(o)
    total += sz
    manifest[name] = [im.width, im.height]
json.dump(manifest, open(os.path.join(out, "manifest.json"), "w"), indent=0)
print(len(M), "assets,", round(total / 1024), "KB")
