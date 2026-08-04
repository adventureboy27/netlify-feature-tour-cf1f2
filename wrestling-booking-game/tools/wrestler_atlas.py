"""
wrestler_atlas.py — modular 16-bit wrestler sprite atlas.

Outputs INDEXED sheets. Every pixel is a palette index, not a color, so the
game recolors at load time. Shape and color are independent axes.

INDEX PALETTE (fixed, never changes)
  0  transparent
  1  skin highlight     2  skin base     3  skin shadow    4  skin deep shadow
  5  outline
  6  mat1 highlight     7  mat1 base     8  mat1 shadow     9  mat1 deep shadow
 10  mat2 highlight    11  mat2 base    12  mat2 shadow    13  mat2 deep shadow
 14  white (eyes, teeth)
 15  dark detail (pupils)

mat1 = the main material of that slot (hair, shirt, trunks, boots)
mat2 = trim/secondary (mask piping, knee pads, laces, waistband)
"""
from PIL import Image, ImageDraw
import numpy as np, json, os

W, H = 64, 96
CX = 32
# Writes straight into the sheets the app imports, so regenerating is
# `python tools/wrestler_atlas.py` followed by `npm run test` — the manifest
# test is what catches a regenerated atlas whose cells no longer match the
# names the renderer maps traits onto.
_HERE = os.path.dirname(os.path.abspath(__file__))
OUTDIR = os.path.join(_HERE, "..", "src", "ui", "paperdoll", "atlas", "sheets")
# Human-readable RGBA versions for eyeballing the art. Not shipped — the game
# only ever reads the indexed sheets.
PREVIEWDIR = os.path.join(_HERE, "preview")

# ---------------------------------------------------------------- raster utils
def _draw(shapes):
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    for kind, args in shapes:
        getattr(d, kind)(args, fill=255)
    return np.array(m) > 0

def poly(pts):   return _draw([("polygon", pts)])
def ell(box):    return _draw([("ellipse", box)])
def rect(box):   return _draw([("rectangle", box)])

def capsule(x0, y0, x1, y1):
    r = (x1 - x0) / 2
    shapes = [("ellipse", [x0, y0, x1, y0 + 2*r]),
              ("ellipse", [x0, y1 - 2*r, x1, y1])]
    if y1 - r >= y0 + r:
        shapes.append(("rectangle", [x0, y0 + r, x1, y1 - r]))
    return _draw(shapes)

def mirror(m):
    return m | m[:, ::-1]

def dilate(m, n=1):
    out = m.copy()
    for _ in range(n):
        p = np.zeros((H+2, W+2), bool); p[1:-1, 1:-1] = out
        out = (p[:-2,1:-1] | p[2:,1:-1] | p[1:-1,:-2] | p[1:-1,2:] |
               p[:-2,:-2] | p[:-2,2:] | p[2:,:-2] | p[2:,2:] | out)
    return out

def blank(): return np.zeros((H, W), np.uint8)

def shade(dst, msk, ramp, light=0.22, dark=0.26):
    """Cel-shade a part into an index buffer. ramp = first index of a 4-tone run."""
    hi, base, sh, sh2 = ramp, ramp+1, ramp+2, ramp+3
    for y in range(H):
        xs = np.where(msk[y])[0]
        if not len(xs): continue
        runs, start = [], xs[0]
        for i in range(1, len(xs)):
            if xs[i] != xs[i-1] + 1:
                runs.append((start, xs[i-1])); start = xs[i]
        runs.append((start, xs[-1]))
        for a, b in runs:
            span = max(b - a, 1)
            for x in range(a, b+1):
                t = (x - a) / span
                dst[y, x] = hi if t < light else (
                    sh2 if t > 1 - dark*0.42 else (sh if t > 1 - dark else base))
    return dst

def marks(dst, msk, cells, idx):
    for (y, x) in cells:
        if 0 <= y < H and 0 <= x < W and msk[y, x]:
            dst[y, x] = idx

def outline(dst):
    a = dst > 0
    p = np.zeros((H+2, W+2), bool); p[1:-1, 1:-1] = a
    grow = (p[:-2,1:-1] | p[2:,1:-1] | p[1:-1,:-2] | p[1:-1,2:] |
            p[:-2,:-2] | p[:-2,2:] | p[2:,:-2] | p[2:,2:])
    dst[grow & ~a] = 5
    return dst

def over(dst, src):
    a = src > 0
    dst[a] = src[a]
    return dst

SKIN, MAT1, MAT2 = 1, 6, 10

# ---------------------------------------------------------------- body frames
def build_frame(kind):
    """Landmarks + base masks. All parts of one frame share these; frames don't mix."""
    F = {"kind": kind}
    if kind == "masc":
        F.update(
            skull=[25,2,39,18], jaw=[27,8,37,21], neck=[29,19,35,28],
            eyes=(28,13,34,13), brow=11, nose=(31,15), mouth=(30,18,34),
            traps=[(27,24),(37,24),(42,30),(22,30)],
            delt=[18,27,28,39],
            torso=[(22,29),(42,29),(43,35),(40,45),(38,53),(26,53),(24,45),(21,35)],
            uarm=(14,34,22,54), farm=(15,50,22,66), hand=[13,63,22,73],
            pelvis=[(23,50),(41,50),(42,58),(38,64),(26,64),(22,58)],
            leg=[(22,50),(31,50),(31,70),(30,74),(30,90),(25,90),(24,74),(23,63)],
            foot_w=(21,32), ankle=(23,32), knee_y=72, hip_y=50, waist_y=48,
        )
    else:  # fem — narrower shoulders and waist, wider hips, lighter limbs
        F.update(
            skull=[26,2,38,18], jaw=[28,9,36,21], neck=[30,19,34,27],
            eyes=(28,13,34,13), brow=11, nose=(31,15), mouth=(30,18,34),
            traps=[(28,25),(36,25),(40,30),(24,30)],
            delt=[21,28,30,38],
            torso=[(24,29),(40,29),(41,34),(37,42),(36,47),(28,47),(27,42),(23,34)],
            uarm=(17,33,24,52), farm=(18,48,24,64), hand=[16,61,25,70],
            pelvis=[(23,46),(41,46),(43,55),(39,64),(25,64),(21,55)],
            leg=[(23,50),(31,50),(31,70),(30,74),(30,90),(25,90),(24,74),(23,63)],
            foot_w=(22,32), ankle=(24,32), knee_y=72, hip_y=48, waist_y=45,
        )
    F["m_skull"] = ell(F["skull"]) | ell(F["jaw"])
    F["m_neck"]  = rect(F["neck"])
    F["m_torso"] = poly(F["torso"]) | poly(F["traps"]) | mirror(ell(F["delt"]))
    F["m_uarm"]  = mirror(capsule(*F["uarm"]))
    F["m_farm"]  = mirror(capsule(*F["farm"]))
    F["m_arm"]   = F["m_uarm"] | F["m_farm"]
    F["m_hand"]  = mirror(ell(F["hand"]))
    F["m_pelvis"] = poly(F["pelvis"])
    F["m_leg"]   = mirror(poly(F["leg"])) & ~rect([32, F["hip_y"]+8, 32, 96])
    return F

FRAMES = {k: build_frame(k) for k in ("masc", "fem")}

# ---------------------------------------------------------------- HEAD slot
HEADS = ["short", "buzz", "mohawk", "long", "ponytail", "afro", "mask", "bald_beard"]

def head(F, style):
    L = blank()
    shade(L, F["m_neck"], SKIN, light=0.18, dark=0.42); outline(L)
    sk = blank(); shade(sk, F["m_skull"], SKIN, light=0.20, dark=0.24); over(L, outline(sk))

    sx0, sy0, sx1, sy1 = F["skull"]
    hair = np.zeros((H, W), bool)
    if style == "short":
        hair = ell([sx0-1, sy0-1, sx1+1, sy0+13]) & ~ell([sx0+1, sy0+5, sx1-1, sy1+8])
        hair |= mirror(rect([sx0, sy0+4, sx0+2, sy0+11])) & F["m_skull"]
    elif style == "buzz":
        hair = ell([sx0, sy0, sx1, sy0+11]) & ~ell([sx0+1, sy0+4, sx1-1, sy1+6])
    elif style == "mohawk":
        hair = rect([CX-3, sy0-2, CX+2, sy0+7]) | ell([CX-3, sy0-3, CX+2, sy0+3])
        hair &= ~ell([sx0+2, sy0+6, sx1-2, sy1+6])
        hair |= rect([CX-3, sy0, CX+2, sy0+6])
    elif style == "long":
        hair = ell([sx0-2, sy0-1, sx1+2, sy0+14]) & ~ell([sx0+1, sy0+5, sx1-1, sy1+8])
        hair |= mirror(rect([sx0-2, sy0+5, sx0+2, 30]))
    elif style == "ponytail":
        hair = ell([sx0-1, sy0-1, sx1+1, sy0+12]) & ~ell([sx0+1, sy0+5, sx1-1, sy1+8])
        hair |= capsule(sx0-5, sy0+6, sx0-1, sy0+22) | ell([sx0-4, sy0+2, sx0+1, sy0+8])
    elif style == "afro":
        hair = ell([sx0-4, sy0-4, sx1+4, sy0+16]) & ~ell([sx0+1, sy0+6, sx1-1, sy1+8])
    elif style == "mask":
        hair = F["m_skull"] | ell([sx0-1, sy0-1, sx1+1, sy0+12])
    elif style == "bald_beard":
        hair = (ell([sx0, sy0+7, sx1, sy1+2]) & ~ell([sx0+1, sy0+5, sx1-1, sy1-2]))
        hair &= F["m_skull"]

    hm = blank(); shade(hm, hair, MAT1, light=0.28, dark=0.26); over(L, hm)

    ex0, ey, ex1, _ = F["eyes"]
    if style == "mask":
        # eye holes + center piping
        for x0 in (ex0-1, ex1-2):
            hole = ell([x0, ey-2, x0+4, ey+3])
            L[hole] = 5
            L[ell([x0+1, ey-1, x0+3, ey+2])] = 14
            L[ell([x0+1, ey, x0+2, ey+2])] = 15
        L[rect([CX-1, sy0, CX, sy1-1]) & F["m_skull"]] = 11
        L[rect([CX-1, sy0, CX-1, sy1-1]) & F["m_skull"]] = 10
        L[rect([CX-4, sy1-4, CX+3, sy1-3]) & F["m_skull"]] = 11
    else:
        for x0 in (ex0, ex1):
            L[rect([x0, ey, x0+2, ey+2])] = 14
            L[rect([x0+1, ey+1, x0+2, ey+2])] = 15
            L[rect([x0, F["brow"], x0+2, F["brow"]+1])] = 8
        nx, ny = F["nose"]
        L[rect([nx, ny, nx+1, ny+2])] = 3
        mx, my, mx1 = F["mouth"]
        if style != "bald_beard":
            L[rect([mx, my, mx1, my])] = 4
        L[mirror(rect([sx0+2, ey+3, sx0+3, ey+4])) & F["m_skull"]] = 3
    return L

# ---------------------------------------------------------------- UPPER slot
UPPERS = ["bare", "singlet", "tank", "tee", "longsleeve", "vest"]

def upper(F, style):
    L = blank()
    arm = blank(); shade(arm, F["m_arm"], SKIN, light=0.24, dark=0.30); over(L, outline(arm))
    hand = blank(); shade(hand, F["m_hand"], SKIN, light=0.26, dark=0.30); over(L, outline(hand))

    body = F["m_torso"]
    tb = blank(); shade(tb, body, SKIN, light=0.19, dark=0.24)
    ys = np.where(body.any(1))[0]; top, bot = ys.min(), ys.max()
    mid = (top + bot) // 2
    if F["kind"] == "masc":
        marks(tb, body, [(y, x) for y in range(top+5, top+9) for x in (CX-1, CX)], 3)
        marks(tb, body, [(y, x) for y in range(mid, bot-1) for x in (CX-1, CX)], 3)
        marks(tb, body, [(mid, x) for x in range(CX-5, CX+6)], 3)
        marks(tb, body, [(mid+6, x) for x in range(CX-4, CX+5)], 3)
        marks(tb, body, [(top+8, x) for x in range(CX-6, CX+7)], 4)
    else:
        bust = mirror(ell([CX-8, top+4, CX-1, top+12])) & body
        marks(tb, bust, [(y, x) for y in range(H) for x in range(W) if bust[y, x] and x in (CX-7, CX+6)], 3)
        marks(tb, body, [(top+12, x) for x in range(CX-7, CX+8)], 4)
        marks(tb, body, [(y, x) for y in range(mid+2, bot-1) for x in (CX-1, CX)], 3)
    marks(tb, body, [(y, x) for y in range(top+1, top+11) for x in (CX-6, CX-5, CX+4, CX+5)], 3)
    marks(tb, body, [(y, x) for y in (bot-1, bot) for x in range(CX-6, CX+7)], 4)
    over(L, outline(tb))

    if style == "bare" and F["kind"] == "fem":
        style = "croptop"
    if style == "bare":
        return L

    g = np.zeros((H, W), bool)
    if style == "croptop":
        g = body & rect([0, top+4, W, top+13])
        g |= mirror(rect([CX-8, top+1, CX-6, top+5])) & body
    elif style == "singlet":
        g = body & rect([0, top+4, W, bot])
        g &= ~mirror(rect([0, top+4, CX-7, top+12]))
        g |= body & mirror(rect([CX-6, top+2, CX-3, top+6]))
    elif style == "tank":
        g = body & rect([0, top+3, W, bot])
        g &= ~mirror(rect([0, top+3, CX-9, top+9]))
    elif style == "tee":
        g = (body | (F["m_uarm"] & rect([0, 0, W, top+11]))) & rect([0, top+1, W, bot])
    elif style == "longsleeve":
        g = (body | F["m_arm"]) & rect([0, top+1, W, bot])
    elif style == "vest":
        g = (body | (F["m_uarm"] & rect([0, 0, W, top+14]))) & rect([0, top+1, W, bot])
        g &= ~rect([CX-4, top+4, CX+3, bot])

    g = dilate(g, 1) & ~F["m_hand"]
    gm = blank(); shade(gm, g, MAT1, light=0.22, dark=0.28)
    if style in ("singlet", "tank", "croptop"):
        marks(gm, g, [(top+2, x) for x in range(W)], 6)
    if style in ("tee", "longsleeve", "vest"):
        marks(gm, g, [(y, x) for y in (bot, bot+1) for x in range(W)], 9)
    over(L, outline(gm))
    return L

# ---------------------------------------------------------------- LOWER slot
LOWERS = ["trunks", "trunks_pads", "tights", "shorts", "jeans", "skirt"]

def lower(F, style):
    L = blank()
    body = F["m_leg"] | F["m_pelvis"]
    lb = blank(); shade(lb, body, SKIN, light=0.22, dark=0.28)
    ky = F["knee_y"]
    marks(lb, F["m_leg"], [(y, x) for y in (ky-1, ky) for x in range(W)], 4)
    marks(lb, F["m_leg"], [(ky+1, x) for x in range(W)], 1)
    marks(lb, F["m_leg"], [(y, x) for y in range(86, 90) for x in range(W)], 4)
    over(L, outline(lb))

    hy = F["hip_y"]
    g = np.zeros((H, W), bool)
    if style in ("trunks", "trunks_pads"):
        g = (F["m_pelvis"] | F["m_leg"]) & rect([0, hy-3, W, hy+13])
        g &= ~mirror(poly([(0, hy+7), (CX-5, hy+7), (CX-11, hy+15), (0, hy+15)]))
    elif style == "tights":
        g = (F["m_pelvis"] | F["m_leg"]) & rect([0, hy-3, W, 91])
    elif style == "shorts":
        g = (F["m_pelvis"] | F["m_leg"]) & rect([0, hy-3, W, hy+20])
    elif style == "jeans":
        g = (F["m_pelvis"] | F["m_leg"]) & rect([0, hy-3, W, 91])
    elif style == "skirt":
        g = F["m_pelvis"] & rect([0, hy-4, W, hy+10])
        g |= dilate(F["m_pelvis"] & rect([0, hy+6, W, hy+16]), 2) & rect([0, hy+6, W, hy+16])

    gap = rect([31, hy+12, 32, 96])
    g = dilate(g, 1) & ~gap
    gm = blank(); shade(gm, g, MAT1, light=0.22, dark=0.28)
    marks(gm, g, [(y, x) for y in (hy-4, hy-3) for x in range(W)], 6)
    marks(gm, g, [(hy-2, x) for x in range(W)], 8)
    if style == "jeans":
        marks(gm, g, [(y, x) for y in range(88, 92) for x in range(W)], 8)
    over(L, outline(gm))

    marks(gm, g, [(y, x) for y in range(hy+12, 92) for x in (30, 33)], 8)
    if style == "trunks_pads":
        pads = dilate(F["m_leg"] & rect([0, ky-5, W, ky+3]), 1)
        pm = blank(); shade(pm, pads, MAT2, light=0.24, dark=0.28)
        over(L, outline(pm))
    return L

# ---------------------------------------------------------------- FEET slot
FEET = ["boots_mid", "boots_high", "boots_low", "sneakers", "barefoot"]

def feet(F, style):
    L = blank()
    a0, a1 = F["ankle"]
    tops = {"boots_mid": 78, "boots_high": 66, "boots_low": 84, "sneakers": 86, "barefoot": 88}
    top = tops[style]
    shaft = mirror(capsule(a0, top, a1, 92)) & ~rect([32, 60, 32, 96])
    foot = mirror(_draw([("rectangle", [F["foot_w"][0], 87, F["foot_w"][1], 94]),
                         ("ellipse", [F["foot_w"][0]-1, 86, F["foot_w"][0]+7, 95])]))
    foot &= ~rect([32, 80, 32, 96])
    shape = shaft | foot
    ramp = SKIN if style == "barefoot" else MAT1
    fm = blank(); shade(fm, shape, ramp, light=0.24, dark=0.28)
    marks(fm, shape, [(y, x) for y in (92, 93, 94) for x in range(W)],
          4 if style == "barefoot" else 9)
    over(L, outline(fm))
    if style != "barefoot":
        trim = shaft & rect([0, top, W, top+2])
        tm = blank(); shade(tm, trim, MAT2, light=0.3, dark=0.24)
        over(L, tm)
    if style == "sneakers":
        laces = shaft & rect([0, 86, W, 88])
        L[laces] = 11
    if style == "barefoot":
        tape = mirror(rect([a0, 84, a1, 87])) & shape
        tm = blank(); shade(tm, tape, MAT2, light=0.3, dark=0.24)
        over(L, outline(tm))
    return L

# ---------------------------------------------------------------- sheets
SLOTS = [("head", HEADS, head), ("upper", UPPERS, upper),
         ("lower", LOWERS, lower), ("feet", FEET, feet)]

DEFAULT_PALETTE = {
    0:(0,0,0,0),
    1:(247,203,161,255), 2:(224,162,116,255), 3:(178,114,73,255), 4:(132,76,46,255),
    5:(24,15,36,255),
    6:(102,78,102,255), 7:(60,42,60,255), 8:(38,26,40,255), 9:(24,16,26,255),
    10:(255,253,247,255), 11:(230,222,208,255), 12:(170,160,148,255), 13:(120,112,104,255),
    14:(244,240,230,255), 15:(36,24,44,255),
}

SLOT_PREVIEW = {
    "head": {6:(102,78,102,255), 7:(60,42,60,255), 8:(38,26,40,255), 9:(24,16,26,255),
             10:(226,64,86,255), 11:(190,34,58,255), 12:(132,18,40,255), 13:(92,10,28,255)},
    "upper":{6:(240,98,112,255), 7:(206,40,64,255), 8:(138,20,44,255), 9:(96,12,34,255),
             10:(255,253,247,255), 11:(230,222,208,255), 12:(170,160,148,255), 13:(120,112,104,255)},
    "lower":{6:(96,150,236,255), 7:(46,98,196,255), 8:(28,58,134,255), 9:(18,38,92,255),
             10:(255,253,247,255), 11:(230,222,208,255), 12:(170,160,148,255), 13:(120,112,104,255)},
    "feet": {6:(88,84,116,255), 7:(40,38,58,255), 8:(24,22,38,255), 9:(15,13,26,255),
             10:(255,253,247,255), 11:(230,222,208,255), 12:(170,160,148,255), 13:(120,112,104,255)},
}

def to_rgba(idx, pal=DEFAULT_PALETTE):
    out = np.zeros((*idx.shape, 4), np.uint8)
    for k, v in pal.items():
        out[idx == k] = v
    return out

def save_indexed(idx, path):
    """8-bit indexed PNG. Index values ARE the palette slots documented above."""
    im = Image.fromarray(idx, mode="P")
    flat = []
    for i in range(256):
        r, g, b, _ = DEFAULT_PALETTE.get(i, (255, 0, 255, 255))
        flat += [r, g, b]
    im.putpalette(flat)
    im.info["transparency"] = 0
    im.save(path, transparency=0)

def build_all():
    os.makedirs(OUTDIR, exist_ok=True)
    os.makedirs(PREVIEWDIR, exist_ok=True)
    manifest = {"frame": {"w": W, "h": H}, "anchor": "top-left, all cells share origin",
                "drawOrder": ["head", "upper", "lower", "feet"],
                "palette": {str(k): "rgba" for k in DEFAULT_PALETTE},
                "frames": {}}
    for fk, F in FRAMES.items():
        manifest["frames"][fk] = {}
        for slot, names, fn in SLOTS:
            cells = [fn(F, n) for n in names]
            sheet = np.zeros((H, W*len(cells)), np.uint8)
            for i, c in enumerate(cells):
                sheet[:, i*W:(i+1)*W] = c
            save_indexed(sheet, f"{OUTDIR}/{fk}_{slot}.png")
            pal = dict(DEFAULT_PALETTE); pal.update(SLOT_PREVIEW[slot])
            Image.fromarray(to_rgba(sheet, pal)).save(f"{PREVIEWDIR}/preview_{fk}_{slot}.png")
            manifest["frames"][fk][slot] = {"file": f"{fk}_{slot}.png",
                                            "cells": names, "count": len(names)}
    with open(f"{OUTDIR}/atlas.json", "w") as f:
        json.dump(manifest, f, indent=2)
    return manifest

if __name__ == "__main__":
    m = build_all()
    total = 1
    for slot in m["frames"]["masc"].values():
        total *= slot["count"]
    print("cells per frame:", {k: v["count"] for k, v in m["frames"]["masc"].items()})
    print("shape combos per frame:", total)
