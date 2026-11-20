"""Cut character sheets into transparent sprites (u2net_human_seg + white decontamination).
usage: python3 cut_chars.py SRC_DIR OUT_DIR PREVIEW.png
"""
import sys, os
import numpy as np
from PIL import Image
from rembg import remove, new_session

SRC, OUT, PREV = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)
session = new_session("u2net_human_seg")
MOODS = ["neutral", "happy", "worried", "angry"]

def cut(cell):
    """cell: RGB PIL image on white background -> RGBA, clean silhouette, no white halo"""
    import scipy.ndimage as ndi
    rgba = remove(cell, session=session)
    a = np.asarray(rgba.getchannel("A")).astype(np.float32) / 255.0
    c = np.asarray(cell.convert("RGB")).astype(np.float32)
    # near-white, weakly-opaque pixels are background
    white = c.min(axis=2) > 244
    a[white & (a < 0.65)] = 0
    # keep only the main body (and big parts attached to it)
    core = a > 0.5
    lab, n = ndi.label(core)
    if n > 1:
        sizes = ndi.sum(core, lab, range(1, n + 1))
        big = sizes.max()
        keep = np.isin(lab, [i + 1 for i, sz in enumerate(sizes) if sz > big * 0.03])
    else:
        keep = core
    keep = ndi.binary_fill_holes(keep)
    body = ndi.binary_dilation(keep, iterations=5)
    a = a * body
    a = np.clip((a - 0.05) / 0.9, 0, 1)
    # colour bleed: edge pixels take the colour of the nearest solid pixel (removes white fringes)
    solid = a >= 0.92
    if solid.any():
        idx = ndi.distance_transform_edt(~solid, return_distances=False, return_indices=True)
        bleed = c[idx[0], idx[1]]
        w = np.clip((a - 0.55) / 0.37, 0, 1)[..., None]
        f = c * w + bleed * (1 - w)
    else:
        f = c
    out = np.dstack([np.clip(f, 0, 255), a * 255.0]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def cut_native(cell_rgba):
    """cell already has a real alpha channel: clean it, remove stray low-alpha pixels, bleed edge colours"""
    import scipy.ndimage as ndi
    arr = np.asarray(cell_rgba.convert("RGBA")).astype(np.float32)
    c = arr[..., :3]
    a = np.clip(arr[..., 3] / 250.0, 0, 1)
    a[a < 0.035] = 0
    core = a > 0.5
    lab, n = ndi.label(core)
    if n > 1:
        sizes = ndi.sum(core, lab, range(1, n + 1))
        big = sizes.max()
        keep = np.isin(lab, [i + 1 for i, sz in enumerate(sizes) if sz > big * 0.03])
    else:
        keep = core
    body = ndi.binary_dilation(ndi.binary_fill_holes(keep), iterations=4)
    a = a * body
    solid = a >= 0.9
    if solid.any():
        idx = ndi.distance_transform_edt(~solid, return_distances=False, return_indices=True)
        bleed = c[idx[0], idx[1]]
        w = np.clip((a - 0.5) / 0.4, 0, 1)[..., None]
        c = c * w + bleed * (1 - w)
    out = np.dstack([np.clip(c, 0, 255), a * 255.0]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")

def side_fade(im, width_frac=0.05, from_y=0.45):
    """soften hard vertical cuts at the left/right edges in the lower part (shoulders cut by the cell)"""
    arr = np.asarray(im).astype(np.float32)
    h, w = arr.shape[:2]
    fw = max(2, int(w * width_frac))
    ramp = np.linspace(0, 1, fw)
    ys = np.linspace(0, 1, h)
    yw = np.clip((ys - from_y) / 0.15, 0, 1)[:, None]
    m = np.ones((h, w), np.float32)
    m[:, :fw] = np.minimum(m[:, :fw], 1 - yw * (1 - ramp[None, :]))
    m[:, -fw:] = np.minimum(m[:, -fw:], 1 - yw * (1 - ramp[None, ::-1]))
    arr[..., 3] *= m
    # bottom fade (the counter hides it anyway, avoids a hard line)
    bh = int(h * 0.06)
    arr[h - bh:, :, 3] *= np.linspace(1, 0.0, bh)[:, None]
    return Image.fromarray(arr.astype(np.uint8), "RGBA")

def save(im, name, size, q=82):
    im = im.resize(size, Image.LANCZOS)
    im.save(os.path.join(OUT, name + ".webp"), "WEBP", quality=q, method=6)
    return im

made = []
# customers: 4x2 sheets of 384x512 cells, rows = customers, cols = moods
SHEETS = {
    "c_tourist_grandma.png": ["touriste", "mamie"],
    "c_boy_business.png": ["garcon", "affaires"],
    "c_surfer_critic.png": ["surfeur", "critique"],
    "c_grandpa_photo.png": ["papi", "photographe"],
    "c_captain_guide.png": ["capitaine", "guide"],
    "c_nina_rival.png": ["nina", "rival"],
}
ONLY = os.environ.get("ONLY_SHEETS")
if ONLY:
    SHEETS = {k: v for k, v in SHEETS.items() if k in ONLY.split(",")}
CU_SIZE = (384, 512)
for f, names in SHEETS.items():
    sheet = Image.open(os.path.join(SRC, f)).convert("RGBA")
    for r, who in enumerate(names):
        for c, mood in enumerate(MOODS):
            cell = sheet.crop((c * 384, r * 512, c * 384 + 384, r * 512 + 512))
            im = side_fade(cut_native(cell))
            made.append((who + "_" + mood, save(im, "cu_%s_%s" % (who, mood), CU_SIZE)))
    print("done", f)

if ONLY:
    pv = Image.new("RGBA", (8 * 150, ((len(made) + 7) // 8) * 200), (70, 110, 60, 255))
    for i, (n, im) in enumerate(made):
        t = im.copy(); t.thumbnail((150, 200))
        pv.alpha_composite(t, ((i % 8) * 150 + (150 - t.width) // 2, (i // 8) * 200 + (200 - t.height)))
    pv.convert("RGB").save(PREV)
    print(len(made), "sprites (new sheets only)")
    sys.exit(0)
# explorer: 2x2 sheet of 512x512 cells (neutral, happy / worried, angry) -> scaled to match the 384x512 framing
ex = Image.open(os.path.join(SRC, "c_explorer.jpg")).convert("RGB")
for i, mood in enumerate(MOODS):
    cx, cy = (i % 2) * 512, (i // 2) * 512
    cell = ex.crop((cx, cy, cx + 512, cy + 512))
    im = cut(cell)
    im = im.resize((436, 436), Image.LANCZOS).crop((26, 0, 410, 436))
    canvas = Image.new("RGBA", (384, 512), (0, 0, 0, 0))
    canvas.alpha_composite(im, (0, 76))
    im = side_fade(canvas, from_y=0.55)
    made.append(("explorateur_" + mood, save(im, "cu_explorateur_%s" % mood, CU_SIZE)))
print("done explorer")

# staff: 3x2 sheet of 512x512 cells
st = Image.open(os.path.join(SRC, "staff.png")).convert("RGBA")
STAFF = [("chef_happy", 0, 0, (512, 512)), ("chef_focus", 1, 0, (512, 512)), ("chef_worried", 2, 0, (512, 512)),
         ("commis_happy", 0, 1, (480, 480)), ("commis_focus", 1, 1, (480, 480)), ("waiter_happy", 2, 1, (480, 480))]
for name, c, r, size in STAFF:
    cell = st.crop((c * 512, r * 512, c * 512 + 512, r * 512 + 512))
    im = side_fade(cut_native(cell), width_frac=0.04, from_y=0.6)
    made.append((name, save(im, name, size)))
print("done staff")

# preview sheet on a mid-tone background
cols = 8
cw, ch = 150, 200
rows = (len(made) + cols - 1) // cols
pv = Image.new("RGBA", (cols * cw, rows * ch), (70, 110, 60, 255))
for i, (n, im) in enumerate(made):
    t = im.copy(); t.thumbnail((cw, ch))
    pv.alpha_composite(t, ((i % cols) * cw + (cw - t.width) // 2, (i // cols) * ch + (ch - t.height)))
pv.convert("RGB").save(PREV)
tot = sum(os.path.getsize(os.path.join(OUT, x)) for x in os.listdir(OUT))
print(len(made), "sprites", round(tot / 1024), "KB")
