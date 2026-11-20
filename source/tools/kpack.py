"""Convert the props of the asset pack "Kitchen & Diner 3D" (by Harning, harning.itch.io) into the small
data file the game embeds (build/kmodels.json).

usage: python3 tools/kpack.py <folder of the pack>      (the folder that contains Models/)

The pack itself must not be redistributed: its .glb files are never added to the repository. Only the
converted, quantised data ends up inside the built game, like the pictures of the interface pack.
`setup.sh` gets build/kmodels.json back from the published game when the pack is not on the machine.

For every model: node transforms are applied, the primitives are merged by material, positions are
stored on 16 bits inside the bounding box, normals on 8 bits, the baked shading (COLOR_0) on 8 bits.
Base colour textures are kept (as WebP), normal maps are dropped.
"""
import base64, glob, io, json, os, struct, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "build", "kmodels.json")
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read_glb(path):
    b = open(path, "rb").read()
    magic, ver, length = struct.unpack("<4sII", b[:12])
    assert magic == b"glTF" and ver == 2, path
    off, js, binc = 12, None, b""
    while off < length:
        clen, ctype = struct.unpack("<II", b[off:off + 8])
        data = b[off + 8:off + 8 + clen]
        off += 8 + clen
        if ctype == 0x4E4F534A:
            js = json.loads(data)
        elif ctype == 0x004E4942:
            binc = data
    return js, binc


def accessor(js, binc, i):
    a = js["accessors"][i]
    v = js["bufferViews"][a["bufferView"]]
    dt, n = np.dtype(CT[a["componentType"]]), NC[a["type"]]
    start = v.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = v.get("byteStride") or dt.itemsize * n
    if stride == dt.itemsize * n:
        arr = np.frombuffer(binc, dtype=dt, count=a["count"] * n, offset=start).reshape(a["count"], n)
    else:
        arr = np.stack([np.frombuffer(binc, dtype=dt, count=n, offset=start + k * stride) for k in range(a["count"])])
    arr = arr.astype(np.float64)
    if a.get("normalized") and dt.kind in "ui":
        arr = arr / float(np.iinfo(dt).max)
    return arr


def node_matrix(n):
    if "matrix" in n:
        return np.array(n["matrix"], dtype=np.float64).reshape(4, 4).T
    t = n.get("translation", [0, 0, 0]); q = n.get("rotation", [0, 0, 0, 1]); s = n.get("scale", [1, 1, 1])
    x, y, z, w = q
    r = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    m = np.eye(4)
    m[:3, :3] = r * np.array(s)
    m[:3, 3] = t
    return m


def b64(arr):
    return base64.b64encode(np.ascontiguousarray(arr).tobytes()).decode()


def webp(png_bytes, size=256):
    from PIL import Image
    im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    if max(im.size) > size:
        im.thumbnail((size, size))
    out = io.BytesIO()
    alpha = im.getextrema()[3][0] < 255
    (im if alpha else im.convert("RGB")).save(out, "WEBP", quality=86, method=6)
    return "data:image/webp;base64," + base64.b64encode(out.getvalue()).decode()


def convert(path):
    js, binc = read_glb(path)
    by_mat = {}

    def walk(idx, parent):
        n = js["nodes"][idx]
        m = parent @ node_matrix(n)
        if "mesh" in n:
            nm = np.linalg.inv(m[:3, :3]).T
            for pr in js["meshes"][n["mesh"]]["primitives"]:
                if pr.get("mode", 4) != 4:
                    continue
                at = pr["attributes"]
                pos = accessor(js, binc, at["POSITION"])
                pos = pos @ m[:3, :3].T + m[:3, 3]
                nor = accessor(js, binc, at["NORMAL"]) @ nm.T
                nor /= np.maximum(1e-9, np.linalg.norm(nor, axis=1, keepdims=True))
                col = accessor(js, binc, at["COLOR_0"])[:, :3] if "COLOR_0" in at else np.ones((len(pos), 3))
                uv = accessor(js, binc, at["TEXCOORD_0"]) if "TEXCOORD_0" in at else np.zeros((len(pos), 2))
                idxs = accessor(js, binc, pr["indices"]).astype(np.int64).reshape(-1) if "indices" in pr else np.arange(len(pos))
                if np.linalg.det(m[:3, :3]) < 0:            # mirrored node: keep the faces outside
                    idxs = idxs.reshape(-1, 3)[:, ::-1].reshape(-1)
                g = by_mat.setdefault(pr.get("material", -1), {"pos": [], "nor": [], "col": [], "uv": [], "idx": [], "n": 0})
                g["pos"].append(pos); g["nor"].append(nor); g["col"].append(col); g["uv"].append(uv)
                g["idx"].append(idxs + g["n"]); g["n"] += len(pos)
        for c in n.get("children", []):
            walk(c, m)

    for r in js["scenes"][js.get("scene", 0)]["nodes"]:
        walk(r, np.eye(4))
    allpos = np.concatenate([np.concatenate(g["pos"]) for g in by_mat.values()])
    lo, hi = allpos.min(axis=0), allpos.max(axis=0)
    span = np.maximum(hi - lo, 1e-6)
    parts = []
    for mi, g in sorted(by_mat.items()):
        mat = js["materials"][mi] if mi >= 0 else {}
        pbr = mat.get("pbrMetallicRoughness", {})
        pos, nor, col, uv, idx = (np.concatenate(g[k]) for k in ("pos", "nor", "col", "uv", "idx"))
        assert len(pos) < 65536, path
        part = {
            "c": [round(float(x), 4) for x in pbr.get("baseColorFactor", [1, 1, 1, 1])],
            "m": round(float(pbr.get("metallicFactor", 1)), 3), "r": round(float(pbr.get("roughnessFactor", 1)), 3),
            "p": b64(np.round((pos - lo) / span * 65535).astype("<u2")),
            "n": b64(np.round(nor * 127).astype(np.int8)),
            "v": b64(np.round(np.clip(col, 0, 1) * 255).astype(np.uint8)),
            "i": b64(idx.astype("<u2")),
        }
        if mat.get("alphaMode") == "BLEND":
            part["a"] = 1
        if mat.get("doubleSided"):
            part["d"] = 1
        em = mat.get("emissiveFactor")
        if em and max(em) > 0:
            part["e"] = [round(float(x), 3) for x in em]
        tex = pbr.get("baseColorTexture")
        if tex is not None:
            src = js["images"][js["textures"][tex["index"]]["source"]]
            v = js["bufferViews"][src["bufferView"]]
            part["t"] = webp(binc[v.get("byteOffset", 0):v.get("byteOffset", 0) + v["byteLength"]])
            part["u"] = b64(uv.astype("<f4"))
        parts.append(part)
    return {"b": [round(float(x), 5) for x in list(lo) + list(hi)], "p": parts}


def main():
    if len(sys.argv) < 2 or not os.path.isdir(os.path.join(sys.argv[1], "Models")):
        sys.exit("usage: python3 tools/kpack.py <folder of the pack (with Models/)>")
    models = {}
    for p in sorted(glob.glob(os.path.join(sys.argv[1], "Models", "*", "*.glb"))):
        name = os.path.basename(p)[:-4]
        models[name] = convert(p)
        b = models[name]["b"]
        print("%-15s %d parts  size %.2f x %.2f x %.2f m" % (name, len(models[name]["p"]), b[3] - b[0], b[4] - b[1], b[5] - b[2]))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({"v": 1, "by": "Kitchen & Diner 3D by Harning", "m": models}, open(OUT, "w"), separators=(",", ":"), sort_keys=True)
    print("wrote", OUT, round(os.path.getsize(OUT) / 1024), "KB")


if __name__ == "__main__":
    main()
