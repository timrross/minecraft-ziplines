#!/usr/bin/env python3
"""
Generates pixel-art PNGs for the zipline add-on.

Outputs (all written into zipline_RP/textures/items/):
  - zipline_handle.png  16x16  inventory icon (J-hook + grip bar)
  - zipline_wrench.png  16x16  inventory icon (adjustable wrench)
  - zipline_placer.png  16x16  inventory icon (surveyor stake / placer wand)
  - zipline_cable.png   32x32  atlas consumed by geometry.zipline.handle

Run from anywhere; paths are resolved relative to this file.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "zipline_RP" / "textures" / "items"

# ---------- palette ----------
T   = (0, 0, 0, 0)        # transparent
OUT = (24, 22, 28, 255)   # outline (near-black, slight cool tint)

# Metal (hook / wrench / trolley body)
M_HL = (210, 214, 220, 255)
M_LT = (170, 174, 182, 255)
M_MD = (128, 132, 140, 255)
M_DK = (78, 82, 92, 255)
M_SH = (46, 48, 56, 255)

# Wood / leather grip
W_HL = (158, 110, 68, 255)
W_MD = (118, 78, 44, 255)
W_DK = (78, 50, 28, 255)
W_SH = (46, 30, 16, 255)

# Brass / gold (placer)
G_HL = (248, 220, 110, 255)
G_MD = (210, 170, 56, 255)
G_DK = (148, 110, 30, 255)
G_SH = (92, 64, 14, 255)

# Rope / cable yellow (kept close to the old cable color so other particle textures
# stay in family, but with shading instead of flat fill)
R_HL = (228, 200, 110, 255)
R_MD = (188, 160, 78, 255)
R_DK = (132, 108, 48, 255)


def new_img(w, h):
    return Image.new("RGBA", (w, h), T)


def px(img, x, y, c):
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), c)


def hline(img, x, y, w, c):
    for i in range(w):
        px(img, x + i, y, c)


def vline(img, x, y, h, c):
    for i in range(h):
        px(img, x, y + i, c)


def rect(img, x, y, w, h, c):
    for j in range(h):
        for i in range(w):
            px(img, x + i, y + j, c)


# =====================================================================
# 1) Inventory icon: J-hook + grip bar  (16x16)
# =====================================================================
def make_handle_icon():
    img = new_img(16, 16)

    # ----- HOOK (top half, J curve opening to the right) -----
    # Outline first, then fill, then highlights.
    # Coordinates designed to read clearly at 16x16.

    # Top curve outline (the "cap" that sits over the cable)
    hook_outline = [
        (6, 0), (7, 0), (8, 0), (9, 0),
        (5, 1), (10, 1),
        (4, 2), (10, 2),
        (4, 3), (10, 3),
        (4, 4),
        (4, 5),
        (4, 6),         # left post going down
        (4, 7),
        (5, 7), (6, 7), # bottom of J
        (7, 7),
        (8, 7),         # short return up on inside
        (8, 6),
        (8, 5),
        (9, 4),         # diagonal back up to the cap
        (10, 4),
    ]
    for p in hook_outline:
        px(img, *p, OUT)

    # Fill metal inside the hook
    hook_fill = [
        (6, 1), (7, 1), (8, 1), (9, 1),
        (5, 2), (6, 2), (7, 2), (8, 2), (9, 2),
        (5, 3), (6, 3), (7, 3), (8, 3), (9, 3),
        (5, 4), (6, 4), (7, 4), (8, 4),
        (5, 5), (6, 5), (7, 5),
        (5, 6), (6, 6), (7, 6),
    ]
    for p in hook_fill:
        px(img, *p, M_MD)

    # Light & shade on hook
    # top highlight band
    for p in [(6, 1), (7, 1), (8, 1)]:
        px(img, *p, M_HL)
    px(img, 5, 2, M_LT)
    px(img, 9, 2, M_LT)
    # left edge highlight on the descending post
    for y in (3, 4, 5, 6):
        px(img, 5, y, M_LT)
    # inner-right shadow
    for y in (2, 3, 4):
        px(img, 9, y, M_DK)
    for y in (5, 6):
        px(img, 7, y, M_DK)

    # ----- CONNECTING POST between hook and grip -----
    # Two-pixel wide post centered on x=7..8
    vline(img, 6, 8, 2, OUT)
    vline(img, 9, 8, 2, OUT)
    px(img, 7, 8, M_HL)
    px(img, 8, 8, M_DK)
    px(img, 7, 9, M_LT)
    px(img, 8, 9, M_MD)

    # Small mounting collar where post meets grip
    rect(img, 5, 10, 6, 1, OUT)

    # ----- GRIP BAR (wood/leather wrap, bottom) -----
    # Body 12 wide, 4 tall, centered horizontally
    grip_x, grip_y, grip_w, grip_h = 2, 11, 12, 4

    # Outline
    rect(img, grip_x, grip_y, grip_w, 1, OUT)             # top
    rect(img, grip_x, grip_y + grip_h - 1, grip_w, 1, OUT)  # bottom
    vline(img, grip_x, grip_y, grip_h, OUT)
    vline(img, grip_x + grip_w - 1, grip_y, grip_h, OUT)

    # Fill
    for j in range(1, grip_h - 1):
        hline(img, grip_x + 1, grip_y + j, grip_w - 2, W_MD)

    # Highlight top row of grip fill
    hline(img, grip_x + 1, grip_y + 1, grip_w - 2, W_HL)
    # Shadow on bottom row of grip fill
    hline(img, grip_x + 1, grip_y + grip_h - 2, grip_w - 2, W_DK)

    # Wrap lines (vertical darker stripes across the grip — leather binding feel)
    for wx in (grip_x + 3, grip_x + 6, grip_x + 9):
        px(img, wx, grip_y + 1, W_DK)
        px(img, wx, grip_y + 2, W_SH)

    # End caps — metal bolts at each grip terminus
    px(img, grip_x, grip_y + 1, M_LT)
    px(img, grip_x, grip_y + 2, M_DK)
    px(img, grip_x + grip_w - 1, grip_y + 1, M_LT)
    px(img, grip_x + grip_w - 1, grip_y + 2, M_DK)

    return img


# =====================================================================
# 2) Inventory icon: adjustable wrench (16x16)
# =====================================================================
def make_wrench_icon():
    img = new_img(16, 16)

    # Diagonal wrench: head top-left, handle running down-right.
    # We draw an open-jaw spanner.

    # ----- HEAD (top-left) -----
    # Outer outline of the open box
    head_outline = [
        (3, 0), (4, 0), (5, 0), (6, 0),
        (2, 1), (7, 1),
        (1, 2), (7, 2),
        (1, 3),
        (1, 4),         (5, 4), (6, 4), (7, 4),
        (2, 5),         (5, 5),
        (3, 6), (4, 6), (5, 6),
    ]
    for p in head_outline:
        px(img, *p, OUT)

    # Head fill
    head_fill = [
        (3, 1), (4, 1), (5, 1), (6, 1),
        (2, 2), (3, 2), (4, 2), (5, 2), (6, 2),
        (2, 3), (3, 3), (4, 3),
        (2, 4), (3, 4), (4, 4),
        (3, 5), (4, 5),
    ]
    for p in head_fill:
        px(img, *p, M_MD)

    # Highlights & shadows on head
    for p in [(3, 1), (4, 1), (5, 1)]:
        px(img, *p, M_HL)
    px(img, 2, 2, M_LT)
    px(img, 2, 3, M_LT)
    px(img, 6, 2, M_DK)
    px(img, 4, 4, M_DK)
    px(img, 3, 5, M_DK)

    # ----- HANDLE running diagonally to bottom-right -----
    # Outline along both sides of a 2-wide bar going (5,6) -> (14,15)
    handle_pts = [
        (5, 7), (6, 7),
        (6, 8), (7, 8),
        (7, 9), (8, 9),
        (8, 10), (9, 10),
        (9, 11), (10, 11),
        (10, 12), (11, 12),
        (11, 13), (12, 13),
        (12, 14), (13, 14),
        (13, 15), (14, 15),
    ]
    for p in handle_pts:
        px(img, *p, M_MD)

    # Upper-left highlight edge on handle
    hl_edge = [(5, 7), (6, 8), (7, 9), (8, 10), (9, 11), (10, 12), (11, 13), (12, 14), (13, 15)]
    for p in hl_edge:
        px(img, *p, M_LT)

    # Lower-right shadow edge on handle (outline)
    sh_edge = [(7, 8), (8, 9), (9, 10), (10, 11), (11, 12), (12, 13), (13, 14), (14, 15)]
    for p in sh_edge:
        px(img, *p, OUT)

    # Outline along the top of handle to close gap to head
    px(img, 5, 6, OUT)  # was M_DK; outline closes the silhouette neatly
    px(img, 6, 6, OUT)
    px(img, 4, 7, OUT)
    px(img, 5, 8, OUT)
    px(img, 6, 9, OUT)
    px(img, 7, 10, OUT)
    px(img, 8, 11, OUT)
    px(img, 9, 12, OUT)
    px(img, 10, 13, OUT)
    px(img, 11, 14, OUT)
    px(img, 12, 15, OUT)

    # Handle wrap dots (rubber grip dots)
    for p in [(8, 10), (10, 12), (12, 14)]:
        px(img, *p, M_SH)

    return img


# =====================================================================
# 3) Inventory icon: placer (surveyor stake — brass topper on a shaft) 16x16
# =====================================================================
def make_placer_icon():
    img = new_img(16, 16)

    # Vertical stake down the center (x=7,8), brass cap at top, point at bottom.

    # ----- TOP CAP (brass orb/flag) -----
    # A small triangular brass flag on the right of the staff
    cap_pts = [
        (7, 0), (8, 0),
        (6, 1), (7, 1), (8, 1), (9, 1),
        (6, 2), (7, 2), (8, 2), (9, 2),
        (7, 3), (8, 3),
    ]
    for p in cap_pts:
        px(img, *p, G_MD)
    # outline
    for p in [(7, 0), (8, 0)]:
        # leave top
        pass
    # Outline edges
    px(img, 6, 0, OUT); px(img, 9, 0, OUT)
    px(img, 5, 1, OUT); px(img, 10, 1, OUT)
    px(img, 5, 2, OUT); px(img, 10, 2, OUT)
    px(img, 6, 3, OUT); px(img, 9, 3, OUT)
    # Highlights on cap
    px(img, 7, 0, G_HL); px(img, 8, 0, G_HL)
    px(img, 6, 1, G_HL); px(img, 7, 1, G_HL)
    # Shadows
    px(img, 9, 2, G_DK); px(img, 8, 3, G_DK)
    px(img, 9, 1, G_DK)

    # ----- COLLAR (small metal band under the cap) -----
    rect(img, 6, 4, 4, 1, OUT)
    px(img, 6, 4, M_LT); px(img, 7, 4, M_HL); px(img, 8, 4, M_MD); px(img, 9, 4, M_DK)

    # ----- SHAFT -----
    shaft_top = 5
    shaft_bot = 13
    for y in range(shaft_top, shaft_bot + 1):
        px(img, 6, y, OUT)
        px(img, 7, y, W_HL)
        px(img, 8, y, W_MD)
        px(img, 9, y, OUT)

    # Wrap rings on shaft
    for ry in (7, 10):
        px(img, 7, ry, W_DK); px(img, 8, ry, W_SH)

    # ----- POINT (tapered tip at bottom) -----
    px(img, 7, 14, OUT)
    px(img, 8, 14, OUT)
    px(img, 7, 15, OUT)  # single-pixel tip would feel lopsided; use 1 pixel centered
    # Recenter tip
    img.putpixel((7, 15), T)
    img.putpixel((8, 15), T)
    img.putpixel((7, 14), W_MD)
    img.putpixel((8, 14), W_MD)
    px(img, 7, 15, OUT)

    return img


# =====================================================================
# 4) 3D-model atlas used by geometry.zipline.handle  (32x32)
# =====================================================================
def make_handle_atlas():
    """
    Layout matches the UV references in zipline_handle.geo.json:

      (0,0)-(16,2)   : east face wrap of vertical grip bar (16x2 strip)
      (0,2)-(16,4)   : west face wrap of vertical grip bar
      (0,4)-(2,20)   : up face of grip bar (2x16)
      (2,4)-(4,20)   : down face of grip bar (2x16)
      (16,4)-(18,6)  : north end of grip bar
      (16,6)-(18,8)  : south end of grip bar
      (24,0)-(32,7)  : trolley/mount block side wrap  (8x7)
      (32,0)-(24,7) up/down face uses same region inverted
      (24,5)-(26,7)  : small top knob (2x2)
      (26,5)-(32,7) up/down for knob
      (31,0)-(32,1)  : hook segment color (1x1 — sampled by every curved cube)
    """
    img = new_img(32, 32)

    # ---- vertical grip bar wraps (treated as leather-wrapped wood) ----
    # 16x2 strip at y=0..1 = east wrap; y=2..3 = west wrap.
    for strip_y, base, hl, sh in [
        (0, W_MD, W_HL, W_DK),
        (2, W_MD, W_HL, W_DK),
    ]:
        for x in range(16):
            px(img, x, strip_y,     hl if x % 4 == 1 else base)
            px(img, x, strip_y + 1, sh if x % 4 == 0 else base)
        # darker wraps every 4 px to simulate leather binding
        for x in range(0, 16, 4):
            px(img, x, strip_y,     W_SH)
            px(img, x, strip_y + 1, W_SH)

    # Top (up) face of grip bar — 2x16, with brighter highlight column
    for y in range(4, 20):
        px(img, 0, y, W_HL)
        px(img, 1, y, W_MD)
    # Bottom (down) face — slightly darker
    for y in range(4, 20):
        px(img, 2, y, W_MD)
        px(img, 3, y, W_DK)

    # North/south end caps of grip (2x2 each)
    for (cx, cy) in [(16, 4), (16, 6)]:
        px(img, cx,     cy,     M_LT)
        px(img, cx + 1, cy,     M_MD)
        px(img, cx,     cy + 1, M_MD)
        px(img, cx + 1, cy + 1, M_DK)

    # ---- trolley / mount block (8x7 panel at 24,0 → 32,7) ----
    # Metal box with rivets at corners.
    for j in range(7):
        for i in range(8):
            base = M_MD
            # gradient top→bottom
            if j == 0: base = M_HL
            elif j == 1: base = M_LT
            elif j >= 5: base = M_DK
            px(img, 24 + i, j, base)
    # rivets
    for (rx, ry) in [(25, 1), (30, 1), (25, 5), (30, 5)]:
        px(img, rx, ry, M_SH)
        px(img, rx, ry - 1 if ry > 0 else ry, M_HL)
    # outline ring
    for i in range(8):
        # top and bottom rows already light/dark; add side outline
        pass
    for j in range(7):
        px(img, 24, j, OUT)
        px(img, 31, j, OUT)
    for i in range(8):
        px(img, 24 + i, 0, OUT)
        px(img, 24 + i, 6, OUT)
    # restore interior shading after outline pass
    for j in range(1, 6):
        for i in range(1, 7):
            base = M_MD
            if j == 1: base = M_LT
            elif j >= 5: base = M_DK
            px(img, 24 + i, j, base)
    # rivets again on top
    for (rx, ry) in [(26, 2), (29, 2), (26, 4), (29, 4)]:
        px(img, rx, ry, M_SH)

    # Small top knob region (24,5)-(26,7) — reuse metal palette
    # Note: this region overlaps the trolley block above. The geo samples
    # (24,5)-(26,7) for the knob's *side* faces (small 2x2). We paint a tidy
    # 2x2 chrome cell here so the knob reads as polished metal.
    px(img, 24, 5, M_LT)
    px(img, 25, 5, M_HL)
    px(img, 24, 6, M_DK)
    px(img, 25, 6, M_MD)

    # ---- hook segment color (sampled by all hook curve cubes) ----
    # The geo samples uv (31,0) size 1x1 for every curved hook piece.
    # Paint a mid-metal pixel and a single highlight neighbor so any future
    # uv tweak still lands on a sensible color.
    px(img, 31, 0, M_LT)

    return img


def main():
    ROOT.mkdir(parents=True, exist_ok=True)

    targets = {
        "zipline_handle.png": make_handle_icon(),
        "zipline_wrench.png": make_wrench_icon(),
        "zipline_placer.png": make_placer_icon(),
        "zipline_cable.png":  make_handle_atlas(),
    }
    for name, img in targets.items():
        out = ROOT / name
        img.save(out)
        print(f"wrote {out}  ({img.width}x{img.height})")


if __name__ == "__main__":
    main()
