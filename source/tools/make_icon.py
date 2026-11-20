"""Build the app icons from the realistic chef render.
usage: python3 tools/make_icon.py STAFF_SHEET.png
outputs build/icon_full.png, icon_fg.png, icon_bg.png, icon64.png, icon256.png
"""
import sys, os, asyncio, base64, random
import numpy as np
import scipy.ndimage as ndi
from PIL import Image, ImageDraw, ImageFilter
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, "build")
sheet = Image.open(sys.argv[1]).convert("RGBA")

# --- chef cut at full resolution (top-left cell of the staff sheet) ---
cell = np.asarray(sheet.crop((0, 0, 512, 512))).astype(np.float32)
c, a = cell[..., :3], np.clip(cell[..., 3] / 250.0, 0, 1)
a[a < 0.035] = 0
core = a > 0.5
lab, n = ndi.label(core)
if n > 1:
    sizes = ndi.sum(core, lab, range(1, n + 1))
    core = lab == (int(np.argmax(sizes)) + 1)
a *= ndi.binary_dilation(ndi.binary_fill_holes(core), iterations=4)
solid = a >= 0.9
idx = ndi.distance_transform_edt(~solid, return_distances=False, return_indices=True)
w = np.clip((a - 0.5) / 0.4, 0, 1)[..., None]
c = c * w + c[idx[0], idx[1]] * (1 - w)
chef = Image.fromarray(np.dstack([np.clip(c, 0, 255), a * 255]).astype(np.uint8), "RGBA")
bb = chef.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
chef = chef.crop(bb)
# keep hat -> chest (top 72 %), fade the cut edge
chef = chef.crop((0, 0, chef.width, int(chef.height * 0.72)))



# --- coin rendered from the game's SVG ---
async def render_coin():
    art = open(os.path.join(ROOT, "src", "js", "art.js"), encoding="utf-8").read()
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()
        await pg.set_content("<html><body><canvas id=c width=400 height=400></canvas><script>" + art + "</script></body></html>")
        data = await pg.evaluate("""() => new Promise(r => { const im = new Image(); im.onload = () => {
            const x = document.getElementById('c').getContext('2d'); x.drawImage(im, 0, 0, 400, 400);
            r(document.getElementById('c').toDataURL('image/png')); }; im.src = Art.coin(); })""")
        await b.close()
    return Image.open(__import__("io").BytesIO(base64.b64decode(data.split(",")[1]))).convert("RGBA")

coin = asyncio.run(render_coin())


def background(size, rounded):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    grad = Image.new("RGBA", (size, size))
    g = np.zeros((size, size, 4), np.uint8)
    t = np.linspace(0, 1, size)[:, None]
    top, bot = np.array([127, 208, 59]), np.array([46, 128, 26])
    g[..., :3] = (top * (1 - t) + bot * t)[:, None, :].repeat(size, 1).reshape(size, size, 3) if False else (top[None, None, :] * (1 - t[..., None]) + bot[None, None, :] * t[..., None]).astype(np.uint8)
    g[..., 3] = 255
    grad = Image.fromarray(g, "RGBA")
    # warm glow behind the chef
    glow = Image.new("L", (size, size), 0)
    ImageDraw.Draw(glow).ellipse((size * 0.12, size * 0.08, size * 0.88, size * 0.84), fill=150)
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.09))
    grad = Image.composite(Image.new("RGBA", (size, size), (255, 248, 190, 255)), grad, glow)
    # sparkles
    rnd = random.Random(4)
    sp = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(sp)
    for _ in range(int(size * 0.12)):
        x, y, r = rnd.random() * size, rnd.random() * size, 1.5 + rnd.random() * size * 0.005
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, int(70 + rnd.random() * 90)))
    grad.alpha_composite(sp)
    if not rounded:
        return grad
    mask_outer = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask_outer).rounded_rectangle((24, 24, size - 24, size - 24), radius=210, fill=255)
    img.paste(Image.new("RGBA", (size, size), (253, 246, 220, 255)), (0, 0), mask_outer)
    mask_inner = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask_inner).rounded_rectangle((70, 70, size - 70, size - 70), radius=170, fill=255)
    img.paste(grad, (0, 0), mask_inner)
    return img, mask_inner


def place(base, sprite, height, cx, bottom, clip=None):
    s = sprite.resize((int(sprite.width * height / sprite.height), height), Image.LANCZOS)
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    layer.alpha_composite(s, (int(cx - s.width / 2), int(bottom - s.height)))
    if clip is not None:
        la = np.asarray(layer).copy()
        la[..., 3] = (la[..., 3].astype(np.float32) * (np.asarray(clip) / 255.0)).astype(np.uint8)
        layer = Image.fromarray(la, "RGBA")
    base.alpha_composite(layer)


S = 1024
full, inner = background(S, True)
place(full, chef, 860, S / 2, S - 30, clip=inner)
place(full, coin, 250, 800, 905, clip=inner)
full.save(os.path.join(B, "icon_full.png"))

fg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
place(fg, chef, 760, S / 2, S + 10)
place(fg, coin, 160, 742, 828)
fg.save(os.path.join(B, "icon_fg.png"))
background(S, False).save(os.path.join(B, "icon_bg.png"))

full.resize((64, 64), Image.LANCZOS).save(os.path.join(B, "icon64.png"))
full.resize((256, 256), Image.LANCZOS).save(os.path.join(B, "icon256.png"))

# preview: full icon + adaptive (circle mask) side by side
pv = Image.new("RGBA", (660, 320), (60, 60, 70, 255))
pv.alpha_composite(full.resize((300, 300), Image.LANCZOS), (10, 10))
ad = background(S, False).copy(); ad.alpha_composite(fg)
m = Image.new("L", (S, S), 0); ImageDraw.Draw(m).ellipse((0, 0, S - 1, S - 1), fill=255)
circ = Image.new("RGBA", (S, S), (0, 0, 0, 0)); circ.paste(ad, (0, 0), m)
pv.alpha_composite(circ.resize((300, 300), Image.LANCZOS), (350, 10))
pv.save("/home/claude/sheets/icons2.png")
print("icons ok", chef.size)
