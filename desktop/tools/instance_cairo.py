"""
Cut three static instances out of the variable Cairo.

Google ships Cairo as a variable font only — google/fonts and the upstream
Gue3bara/Cairo repo both carry Cairo[slnt,wght].ttf and no statics, and the
fonts.google.com download endpoint now answers with HTML rather than a ZIP.

MAUI cannot use the variable axis: a Label exposes FontAttributes (None / Bold),
not a numeric weight, so a variable file would give 400 and a synthesised bold
and nothing at 500 — the weight the v2 design leans on hardest for row titles,
pill labels and section actions.

So the three weights the design names are instantiated here and registered as
three separate families. slnt is pinned to 0: the design never slants, and
leaving the axis in would keep the file variable for no benefit.

Licence is unaffected — the OFL explicitly permits modified and derivative
versions, and OFL.txt ships beside the fonts.
"""

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

# name IDs in the OpenType 'name' table
FAMILY, SUBFAMILY, UNIQUE, FULL, POSTSCRIPT = 1, 2, 3, 4, 6
TYPO_FAMILY, TYPO_SUBFAMILY = 16, 17

WEIGHTS = [
    (400, "Cairo", "Regular", "Cairo-Regular"),
    (500, "Cairo Medium", "Regular", "CairoMedium-Regular"),
    (700, "Cairo", "Bold", "Cairo-Bold"),
]


def build(weight: int, family: str, subfamily: str, postscript: str) -> str:
    font = TTFont("Cairo-VF.ttf")

    # Pin both axes: wght to the target, slnt upright.
    instancer.instantiateVariableFont(font, {"wght": weight, "slnt": 0}, inplace=True)

    name = font["name"]
    full = family if subfamily == "Regular" else f"{family} {subfamily}"

    for platform in ((3, 1, 0x409), (1, 0, 0)):
        plat_id, enc_id, lang_id = platform
        for name_id, value in (
            (FAMILY, family),
            (SUBFAMILY, subfamily),
            (UNIQUE, f"{full}; instanced from Cairo variable"),
            (FULL, full),
            (POSTSCRIPT, postscript),
        ):
            name.setName(value, name_id, plat_id, enc_id, lang_id)

        # Typographic names would otherwise still advertise the variable family,
        # which is what Windows font enumeration actually reads first.
        for name_id in (TYPO_FAMILY, TYPO_SUBFAMILY):
            record = name.getName(name_id, plat_id, enc_id, lang_id)
            if record is not None:
                name.removeNames(name_id, plat_id, enc_id, lang_id)

    # usWeightClass drives DirectWrite's own weight matching; leaving every
    # instance at 400 makes Windows treat all three as the same face.
    font["OS/2"].usWeightClass = weight

    # fsSelection / macStyle must agree with the subfamily, or the bold face is
    # synthesised on top of an already-bold outline.
    #
    # The bits are not adjacent: ITALIC is bit 0, BOLD is bit 5 and REGULAR is
    # bit 6, and BOLD and REGULAR are mutually exclusive. In macStyle, bit 0 is
    # bold and bit 1 is italic.
    ITALIC, BOLD, REGULAR = 1 << 0, 1 << 5, 1 << 6

    bold = subfamily == "Bold"

    selection = font["OS/2"].fsSelection & ~(ITALIC | BOLD | REGULAR)
    font["OS/2"].fsSelection = selection | (BOLD if bold else REGULAR)

    font["head"].macStyle = (font["head"].macStyle & ~0b11) | (0b1 if bold else 0)

    out = f"{postscript}.ttf"
    font.save(out)
    return out


for weight, family, subfamily, postscript in WEIGHTS:
    path = build(weight, family, subfamily, postscript)
    print(f"{path:28} wght={weight}  family={family!r} subfamily={subfamily!r}")
