"""Draw the app icons and the link-preview image. Run: python tools/make_icons.py"""
import json, re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "icons"
ICONS.mkdir(exist_ok=True)
BG, SAND, INK, BLUE = (31, 28, 24), (235, 104, 52), (246, 242, 234), (57, 135, 229)

data = json.loads(re.search(r"window\.DATA = (.*);", (ROOT / "data.js").read_text("utf-8")).group(1))
vals = [p["ofPop"] for p in data["pres"]]


def dashed(d, x0, x1, y, w, dash, gap, fill):
    x = x0
    while x < x1:
        d.line([(x, y), (min(x + dash, x1), y)], fill=fill, width=w)
        x += dash + gap


def icon(size, pad_frac):
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)
    pad = size * pad_frac
    top, base = pad + size * 0.08, size - pad - size * 0.06
    picks = [0.32, 0.39, 0.42, 0.33, 0.30, 0.34, 0.32]  # bars, all under the line
    bw = (size - 2 * pad) / len(picks)
    for i, v in enumerate(picks):
        h = (base - top) * v / 0.5 * 0.5
        x = pad + i * bw
        d.rounded_rectangle([x + bw * 0.14, base - h, x + bw * 0.86, base], radius=bw * 0.12, fill=SAND)
    y50 = base - (base - top) * 0.5 / 0.5 * 0.5 - size * 0.12
    dashed(d, pad, size - pad, y50, max(2, size // 48), size // 18, size // 30, INK)
    return img


icon(192, 0.10).save(ICONS / "icon-192.png")
icon(512, 0.10).save(ICONS / "icon-512.png")
icon(512, 0.20).save(ICONS / "icon-maskable-512.png")
icon(180, 0.10).save(ICONS / "apple-touch-icon.png")

# Link preview 1200x630
W, H = 1200, 630
img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)
serif = lambda s: ImageFont.truetype("C:/Windows/Fonts/georgiab.ttf", s)
sans = lambda s: ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", s)
d.text((70, 60), "Built on Sand", font=serif(96), fill=INK)
d.text((72, 180), "No U.S. president has ever won a majority", font=sans(38), fill=(195, 194, 183))
d.text((72, 228), "of voting-age adults. Not once in 60 elections.", font=sans(38), fill=(195, 194, 183))
x0, x1, base, top = 70, W - 70, H - 60, 300
y = lambda v: base - (base - top) * v / 0.6
bw = (x1 - x0) / len(vals)
for i, v in enumerate(vals):
    x = x0 + i * bw
    d.rounded_rectangle([x + 2, y(v), x + bw - 2, base], radius=3, fill=SAND)
dashed(d, x0, x1, y(0.5), 3, 14, 9, INK)
d.text((x1, y(0.5) - 40), "Majority · 50%", font=sans(28), fill=INK, anchor="ra")
img.save(ICONS / "og-image.png")
print("icons written to", ICONS)
