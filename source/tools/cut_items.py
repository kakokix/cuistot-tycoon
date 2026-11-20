"""Cut dish and station sheets into transparent sprites.
usage: python3 cut_items.py DISH_SHEET STATION_SHEET OUT_DIR PREVIEW.png
"""
import sys, os
import numpy as np
import scipy.ndimage as ndi
from PIL import Image

DISH, STAT, OUT, PREV = sys.argv[1:5]
os.makedirs(OUT, exist_ok=True)
_sess = None


def alpha_of(cell):
    """return float alpha in [0,1] for the cell, using native alpha if present, else rembg"""
    global _sess
    arr = np.asarray(cell.convert("RGBA")).astype(np.float32)
    a = arr[..., 3] / 255.0
    if (a < 0.02).mean() > 0.15:
        return np.clip(a / 0.98, 0, 1), "native"
    from rembg import remove, new_session
    if _sess is None:
        _sess = new_session("isnet-general-use")
    r = remove(cell.convert("RGB"), session=_sess)
    return np.asarray(r.getchannel("A")).astype(np.float32) / 255.0, "rembg"


def clean(cell, min_frac=0.02):
    arr = np.asarray(cell.convert("RGBA")).astype(np.float32)
    c = arr[..., :3]
    a, how = alpha_of(cell)
    a[a < 0.03] = 0
    core = a > 0.35
    lab, n = ndi.label(core)
    if n > 1:
        sizes = ndi.sum(core, lab, range(1, n + 1))
        big = sizes.max()
        H, W = core.shape
        ids = []
        for i, sz in enumerate(sizes):
            if sz < big * min_frac:
                continue
            ys, xs = np.nonzero(lab == i + 1)
            touches = ys.min() == 0 or ys.max() == H - 1 or xs.min() == 0 or xs.max() == W - 1
            if touches and sz < big * 0.3:
                continue  # a piece of the neighbouring cell
            ids.append(i + 1)
        keep = np.isin(lab, ids)
    else:
        keep = core
    region = ndi.binary_dilation(ndi.binary_fill_holes(keep), iterations=10)
    a = a * region
    solid = a >= 0.85
    if solid.any():
        idx = ndi.distance_transform_edt(~solid, return_distances=False, return_indices=True)
        bleed = c[idx[0], idx[1]]
        w = np.clip((a - 0.45) / 0.4, 0, 1)[..., None]
        c = c * w + bleed * (1 - w)
    # floor shadows: the model paints them slightly transparent (alpha < ~0.98) under the object.
    # per column, erase pale pixels that lie below the lowest truly solid pixel.
    solid2 = a >= 0.982
    if solid2.any():
        H, W = a.shape
        rows = np.arange(H)[:, None]
        has = solid2.any(axis=0)
        low = np.where(has, H - 1 - np.argmax(solid2[::-1, :], axis=0), -1)
        # smooth the profile so thin gaps do not matter
        low = ndi.maximum_filter1d(low, size=9)
        below = rows > (low[None, :] + 2)
        pale = (c.min(axis=2) > 120) & (c.max(axis=2) - c.min(axis=2) < 40)
        kill = below & (pale | (a < 0.5))
        a[kill] = 0
    out = Image.fromarray(np.dstack([np.clip(c, 0, 255), a * 255.0]).astype(np.uint8), "RGBA")
    bb = Image.fromarray((a > 0.06).astype(np.uint8) * 255).getbbox()
    return out, bb, how


def fit(im, bb, box, pad=0.04):
    """crop to bbox (+pad), scale to fit inside box (w,h), keep aspect"""
    x0, y0, x1, y1 = bb
    w, h = x1 - x0, y1 - y0
    p = int(max(w, h) * pad)
    crop = im.crop((max(0, x0 - p), max(0, y0 - p), min(im.width, x1 + p), min(im.height, y1 + p)))
    crop.thumbnail(box, Image.LANCZOS)
    return crop


made = []
# dishes: 4 cols x 2 rows on 1536x1024 -> 384x512 cells
DISHES = ["burger", "frites", "jus", "pizza", "soupe", "nouilles", "sushi", "gateau"]
ds = Image.open(DISH)
cw, ch = ds.width // 4, ds.height // 2
for i, name in enumerate(DISHES):
    cx, cy = (i % 4) * cw, (i // 4) * ch
    im, bb, how = clean(ds.crop((cx, cy, cx + cw, cy + ch)))
    sq = fit(im, bb, (180, 180))
    canvas = Image.new("RGBA", (180, 180), (0, 0, 0, 0))
    canvas.alpha_composite(sq, ((180 - sq.width) // 2, (180 - sq.height) // 2))
    canvas.save(os.path.join(OUT, "dish_%s.webp" % name), "WEBP", quality=84, method=6)
    made.append(canvas)
    print("dish", name, how, bb)

# stations: 2 cols x 4 rows on 1024x1536 -> 512x384 cells
STATIONS = ["grill", "jus", "frites", "pizza", "soupe", "wok", "sushi", "gateau"]
ss = Image.open(STAT)
cw, ch = ss.width // 2, ss.height // 4
for i, name in enumerate(STATIONS):
    cx, cy = (i % 2) * cw, (i // 2) * ch
    im, bb, how = clean(ss.crop((cx, cy, cx + cw, cy + ch)))
    st = fit(im, bb, (300, 240), pad=0.02)
    st.save(os.path.join(OUT, "st_%s.webp" % name), "WEBP", quality=84, method=6)
    made.append(st)
    print("station", name, how, bb, st.size)

pv = Image.new("RGBA", (8 * 200, 2 * 250), (70, 110, 60, 255))
for i, im in enumerate(made):
    t = im.copy(); t.thumbnail((190, 240))
    pv.alpha_composite(t, ((i % 8) * 200 + (200 - t.width) // 2, (i // 8) * 250 + (250 - t.height) // 2))
pv.convert("RGB").save(PREV)
tot = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT) if f.startswith(("dish_", "st_")))
print("total", round(tot / 1024), "KB")
