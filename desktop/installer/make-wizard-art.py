"""Draws the two images the installer wizard shows.

GENERATED OUTPUT. Re-run this rather than editing the .bmp files:

    python installer/make-wizard-art.py

Both come from the app's own palette rather than an invented one - the deep
navy the app sets its text in, the blue it uses as its accent, and the school's
red logo as the one warm thing on the panel.

The panel carries no lettering. Pillow draws glyphs one at a time with no
shaping, so Arabic set here would come out as disconnected letters in the wrong
order. Every word in the wizard is drawn by Windows instead, where it shapes
correctly; the artwork stays typographic-free and the logo carries the name.

Everything is drawn once at the largest size and resampled down, so the small
variants stay clean instead of being redrawn with rounding errors at each size.
"""

from PIL import Image, ImageDraw

HERE = __file__.rsplit("\\", 1)[0].rsplit("/", 1)[0]
LOGO = HERE + "/../NumberOne.Desktop/Resources/Images/number_one_logo.jpg"

# From Tokens.xaml: TextLight, and SecondaryLight as the accent.
NAVY = (15, 23, 42)
BLUE = (26, 86, 219)

# Inno picks the variant matching the display scaling.
LARGE_SIZES = [(164, 314), (192, 386), (246, 471), (328, 628)]
SMALL_SIZES = [(55, 58), (64, 68), (92, 97), (110, 116), (138, 140)]


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
    # barely above the ground - a motif, not a pattern.
    over = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(over)
    for i in range(9):
        y = int(H * 0.60) + i * 22
        od.line([(int(W * 0.16), y), (int(W * 0.84), y)], fill=(255, 255, 255, 16), width=2)

    # One accent rule, brighter, to stop the ruling reading as noise.
    od.line([(int(W * 0.16), int(H * 0.60) - 26), (int(W * 0.42), int(H * 0.60) - 26)],
            fill=(120, 160, 255, 150), width=3)
    img = Image.alpha_composite(img.convert("RGBA"), over).convert("RGB")

    mark = circular_logo(int(W * 0.52))
    img.paste(mark, ((W - mark.width) // 2, int(H * 0.20)), mark)
    return img


def header():
    """The small mark in the corner of every other page, on the wizard's white."""
    S = 140
    img = Image.new("RGB", (S, S), (255, 255, 255))
    mark = circular_logo(int(S * 0.86))
    img.paste(mark, ((S - mark.width) // 2, (S - mark.height) // 2), mark)
    return img


def save(image, sizes, stem):
    for w, h in sizes:
        # Fit rather than stretch: the panel ratios differ slightly between
        # variants and a stretched logo is the first thing anyone notices.
        frame = image.resize((w, h), Image.LANCZOS)
        frame.save(f"{HERE}/{stem}-{w}x{h}.bmp", "BMP")
        print(f"  {stem}-{w}x{h}.bmp")


print("wizard art:")
save(panel(), LARGE_SIZES, "wizard-panel")
save(header(), SMALL_SIZES, "wizard-mark")
