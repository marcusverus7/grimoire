"""
generate_textures.py — Procedurally generate license-free parchment textures
for Grimoire. No stock images, no downloads — fully bespoke in the house
palette so a paid App Store app carries zero licensing claim.

Outputs (to apps/mobile/assets/textures/):
  parchment-bg.png     full-screen aged parchment, warm grain + vignette
  parchment-panel.png  lighter cream panel for cards (near-uniform, tiles/stretches well)

Run:  python3 apps/mobile/scripts/generate_textures.py
"""
from PIL import Image, ImageFilter, ImageChops, ImageDraw
from pathlib import Path
import random

random.seed(7)
OUT = Path(__file__).resolve().parents[1] / "assets" / "textures"
OUT.mkdir(parents=True, exist_ok=True)


def grain_layer(w, h, sigma, blur=0.0):
    n = Image.effect_noise((w, h), sigma).convert("L")
    if blur:
        n = n.filter(ImageFilter.GaussianBlur(blur))
    return n


def coarse_variation(w, h, scale=8, blur=14):
    """Large soft blotches as a near-white multiply map (subtle aged unevenness)."""
    small = Image.effect_noise((max(1, w // scale), max(1, h // scale)), 60).convert("L")
    big = small.resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(blur))
    # keep multiply factor in ~0.90–1.0 so it barely darkens the base
    return big.point(lambda v: 232 + v // 14)


def vignette_mask(w, h, strength=0.55):
    """White centre → black edges, for darkening the burnt border."""
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    inset_x, inset_y = int(w * 0.02), int(h * 0.015)
    d.ellipse([inset_x, inset_y, w - inset_x, h - inset_y], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(min(w, h) * 0.12))
    return m


def build_parchment(w, h, base, edge, light, panel=False):
    img = Image.new("RGB", (w, h), base)

    # coarse aged unevenness (subtle near-white multiply map)
    cv = coarse_variation(w, h, scale=10, blur=18)
    img = ImageChops.multiply(img, Image.merge("RGB", (cv, cv, cv)))

    # fine paper fibre grain (very subtle brown speckle). NOTE: ImageChops.subtract
    # divides the whole result by `scale` — keep scale=1.0 and make the grain small.
    g = grain_layer(w, h, 16 if not panel else 9)
    grain_rgb = Image.merge("RGB", (
        g.point(lambda v: max(0, (v - 128)) // 6),
        g.point(lambda v: max(0, (v - 128)) // 7),
        g.point(lambda v: max(0, (v - 128)) // 10),
    ))
    img = ImageChops.subtract(img, grain_rgb)

    if not panel:
        # faint horizontal creases
        d = ImageDraw.Draw(img, "RGBA")
        for _ in range(4):
            y = random.randint(int(h * 0.12), int(h * 0.9))
            d.line([(0, y), (w, y)], fill=(90, 66, 34, 26), width=2)
        img = img.filter(ImageFilter.GaussianBlur(0.4))

        # burnt vignette: blend toward edge colour using vignette mask
        edge_img = Image.new("RGB", (w, h), edge)
        img = Image.composite(img, edge_img, vignette_mask(w, h))

    img.save(OUT / ("parchment-panel.png" if panel else "parchment-bg.png"))
    print("wrote", (OUT / ("parchment-panel.png" if panel else "parchment-bg.png")).name,
          f"{w}x{h}")


# Full-screen background: warm aged, darker burnt edges
build_parchment(800, 1600, base=(231, 213, 173), edge=(150, 116, 64), light=(243, 230, 200))
# Card panel: lighter cream, near-uniform so it stretches cleanly under content
build_parchment(400, 400, base=(242, 230, 202), edge=(0, 0, 0), light=(248, 240, 218), panel=True)
print("done")
