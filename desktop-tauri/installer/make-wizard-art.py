"""Draws the two images the NSIS wizard shows.

GENERATED OUTPUT. Re-run this rather than editing the .bmp files:

    python installer/make-wizard-art.py

Ported from desktop/installer/make-wizard-art.py so the two installers look
like the same product. The drawing is the same; only the sizes differ, because
NSIS takes ONE image per slot at a fixed size while Inno takes a set and picks
by display scaling.

Both come from the app's own palette rather than an invented one — the deep
navy the app sets its text in, the blue it uses as its accent, and the school's
red logo as the one warm thing on the panel.

THE PANEL CARRIES NO LETTERING. Pillow draws glyphs one at a time with no
shaping, so Arabic set here would come out as disconnected letters in the wrong
order. Every word in the wizard is drawn by Windows instead, where it shapes
correctly; the artwork stays typographic-free and the logo carries the name.

Everything is drawn once at the largest size and resampled down, so the small
variants stay clean instead of being redrawn with rounding errors at each size.
"""

import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
LOGO = os.path.join(HERE, "..", "src", "assets", "logo.jpg")

# From Tokens.xaml, by way of index.css: --ink, and --accent.
NAVY = (15, 23, 42)
BLUE = (26, 86, 219)

# What NSIS asks for. One each, unlike Inno's set.
SIDEBAR = (164, 314)  # welcome and finish pages
HEADER = (150, 57)  # the strip across every other page


def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def circular_logo(size):
    """The mark, cropped to its circle so the panel shows no white corners."""
    logo = Image.open(LOGO).convert("RGB").resize((size, size), Image.LANCZOS)

    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    logo.putalpha(mask.resize((size, size), Image.LANCZOS))
    return logo


def panel():
    """The tall strip beside the welcome and finished pages."""
    W, H = 328, 628
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)

    # Night sky, not a flat fill: lighter at the top where the mark sits, so
    # the eye is taken to it rather than to the middle of the strip.
    for y in range(H):
        d.line([(0, y), (W, y)], fill=mix(mix(NAVY, BLUE, 0.34), NAVY, y / H))

    # Ruled lines, the one nod to school stationery. Kept under the mark and
    # barely above the ground — a motif, not a pattern.
    over = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(over)
    for i in range(9):
        y = int(H * 0.60) + i * 22
        od.line([(int(W * 0.16), y), (int(W * 0.84), y)], fill=(255, 255, 255, 16), width=2)

    # One accent rule, brighter, to stop the ruling reading as noise.
    od.line(
        [(int(W * 0.16), int(H * 0.60) - 26), (int(W * 0.42), int(H * 0.60) - 26)],
        fill=(120, 160, 255, 150),
        width=3,
    )
    img = Image.alpha_composite(img.convert("RGBA"), over).convert("RGB")

    mark = circular_logo(int(W * 0.52))
    img.paste(mark, ((W - mark.width) // 2, int(H * 0.20)), mark)
    return img


def header():
    """The wide strip across the top of every other page.

    NSIS's header is LANDSCAPE — 150x57 — where Inno's is a square mark, so
    this cannot be the same drawing resized. The mark sits at the trailing
    (left) end because the wizard is right-to-left and the leading edge is
    where the page's own heading goes.
    """
    W, H = HEADER
    scale = 4
    img = Image.new("RGB", (W * scale, H * scale), (255, 255, 255))

    mark = circular_logo(int(H * scale * 0.82))
    inset = int(H * scale * 0.09)
    img.paste(mark, (inset, (H * scale - mark.height) // 2), mark)

    return img.resize((W, H), Image.LANCZOS)


def save(image, size, name):
    # Fit rather than stretch: a stretched logo is the first thing anyone
    # notices. BMP because NSIS reads nothing else here.
    out = os.path.join(HERE, name)
    image.resize(size, Image.LANCZOS).save(out, "BMP")
    print(f"  {name}  {size[0]}x{size[1]}")


print("wizard art:")
save(panel(), SIDEBAR, "wizard-sidebar.bmp")
save(header(), HEADER, "wizard-header.bmp")
