"""
Turn Lucide's SVGs into the PathGeometry entries Icons.xaml holds.

Lucide draws with <circle>, <rect>, <line> and <polyline> as well as <path>,
and XAML's Geometry takes only path mini-language — so every other element has
to be rewritten as one. A circle becomes two half-arcs, a rounded rect becomes
four lines and four arcs, and the rest are straight M/L runs.

Everything is emitted as a single Figures string per icon, because a Path takes
one Geometry and the app's IconPath style scales it from the 24x24 grid.
"""

import re
import urllib.request

RAW = "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/{}.svg"

# our key -> lucide name
ICONS = {
    "IconHome": "house",
    "IconCourses": "book-open",
    "IconLecture": "square-play",
    "IconLive": "radio",
    "IconExams": "pencil",
    "IconResults": "award",
    "IconBell": "bell",
    "IconUser": "user",
    "IconSignOut": "log-out",
    "IconSun": "sun",
    "IconMoon": "moon",
    "IconChevronRight": "chevron-right",
    "IconChevronLeft": "chevron-left",
    "IconChevronDown": "chevron-down",
    "IconMenu": "menu",
    "IconSearch": "search",
    "IconMonitor": "monitor",
    "IconRefresh": "refresh-cw",
    "IconClock": "clock",
    "IconAlertCircle": "circle-alert",
    "IconAlertTriangle": "triangle-alert",
    "IconCheck": "check",
    "IconShield": "shield-check",
    "IconEye": "eye",
    "IconCopy": "copy",
    "IconPhone": "phone",
    "IconDownload": "download",
    "IconExternal": "external-link",
    "IconLock": "lock",
    "IconPhoneDevice": "smartphone",
    "IconWifi": "wifi",
    "IconWifiOff": "wifi-off",
    "IconLink": "link",
    "IconPause": "pause",
    "IconPlay": "play",
    "IconVolume": "volume-2",
    "IconVolumeOff": "volume-x",
    "IconExpand": "maximize",
    "IconShrink": "minimize",
    "IconSkipBack": "chevrons-left",
    "IconSkipForward": "chevrons-right",
}


def num(value):
    """Trim trailing zeros so the emitted geometry stays readable."""
    f = float(value)
    return str(int(f)) if f == int(f) else str(round(f, 3))


def attrs(tag):
    return dict(re.findall(r'(\w[\w-]*)="([^"]*)"', tag))


def circle(a):
    cx, cy, r = float(a["cx"]), float(a["cy"]), float(a["r"])
    return (f"M{num(cx - r)} {num(cy)}"
            f"a{num(r)} {num(r)} 0 1 0 {num(2 * r)} 0"
            f"a{num(r)} {num(r)} 0 1 0 {num(-2 * r)} 0")


def ellipse(a):
    cx, cy = float(a["cx"]), float(a["cy"])
    rx, ry = float(a["rx"]), float(a["ry"])
    return (f"M{num(cx - rx)} {num(cy)}"
            f"a{num(rx)} {num(ry)} 0 1 0 {num(2 * rx)} 0"
            f"a{num(rx)} {num(ry)} 0 1 0 {num(-2 * rx)} 0")


def rect(a):
    x, y = float(a.get("x", 0)), float(a.get("y", 0))
    w, h = float(a["width"]), float(a["height"])
    rx = float(a.get("rx", a.get("ry", 0)))
    ry = float(a.get("ry", rx))

    if rx <= 0:
        return f"M{num(x)} {num(y)}H{num(x + w)}V{num(y + h)}H{num(x)}Z"

    return (
        f"M{num(x + rx)} {num(y)}"
        f"H{num(x + w - rx)}"
        f"a{num(rx)} {num(ry)} 0 0 1 {num(rx)} {num(ry)}"
        f"V{num(y + h - ry)}"
        f"a{num(rx)} {num(ry)} 0 0 1 {num(-rx)} {num(ry)}"
        f"H{num(x + rx)}"
        f"a{num(rx)} {num(ry)} 0 0 1 {num(-rx)} {num(-ry)}"
        f"V{num(y + ry)}"
        f"a{num(rx)} {num(ry)} 0 0 1 {num(rx)} {num(-ry)}Z"
    )


def line(a):
    return f"M{num(a['x1'])} {num(a['y1'])}L{num(a['x2'])} {num(a['y2'])}"


def points(a, close):
    pairs = re.findall(r"(-?[\d.]+)[ ,]+(-?[\d.]+)", a["points"])
    run = "M" + "L".join(f"{num(x)} {num(y)}" for x, y in pairs)
    return run + ("Z" if close else "")


def absolute_start(d):
    """
    Make a path's opening moveto absolute WITHOUT changing what follows it.

    SVG treats a leading relative "m" as absolute, because each <path> starts
    fresh at the origin. Concatenating paths into one geometry breaks that: the
    next path's "m" becomes relative to wherever the previous one ended.

    Simply uppercasing the m is not the fix, and is worse than the bug. The
    command letter also decides how the IMPLICIT pairs after it are read: after
    "m" they are relative linetos, after "M" they are absolute ones. So
    "m11 17-5-5" (a chevron at x=11) turned into "M11 17-5-5" draws a line to
    (-5,-5) — off the canvas entirely.

    The first pair therefore becomes an absolute M, and the remainder is given
    the explicit "l" it was relying on implicitly.
    """
    d = d.strip()
    if d[:1] != "m":
        return d

    rest = d[1:].lstrip()

    # The opening coordinate pair, however it is separated.
    pair = re.match(r"(-?[\d.]+)\s*,?\s*(-?[\d.]+)", rest)
    if not pair:
        return "M" + rest

    x, y = pair.group(1), pair.group(2)
    tail = rest[pair.end():].lstrip()

    # A tail that already names its command keeps it; a bare number was an
    # implicit relative lineto and has to say so now.
    if tail and not tail[0].isalpha():
        tail = "l" + tail

    return f"M{x} {y}" + (" " + tail if tail else "")


# Pins every icon to the full 24x24 grid.
#
# A Path with Aspect="Uniform" scales the geometry's OWN bounding box to fill
# its slot, and Lucide icons do not fill the grid equally - a bell is 13 units
# tall, a graduation cap is 19. Rendered straight, each was blown up by a
# different factor: 138% between the largest and smallest in one row of tiles,
# and the stroke scales with it, so weights drifted from 1.46 to 2.02 against a
# style asking for 1.75. The shared grid is what makes a set look like a set,
# and self-scaling threw it away.
#
# Two empty figures at opposite corners fix the bounds at 0,0-24,24 for every
# icon, so they all take the same scale factor. A figure with no segments draws
# nothing.
#
# Each one is CLOSED. Two bare moves in a row are two BeginFigure calls with no
# EndFigure between them, and Win2D throws ArgumentException on the second -
# "the figure was already begun" - which took the app down on every screen that
# drew an icon.
#
# It goes LAST: leading with it would leave a following relative command
# measured from 24,24 rather than from the origin.
GRID_ANCHOR = "M 0 0 Z M 24 24 Z"


ARGC = {"M":2,"L":2,"H":1,"V":1,"C":6,"S":4,"Q":4,"T":2,"A":7,"Z":0}
NUM = re.compile(r"[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?")


def _fmt(v):
    s = f"{v:.4f}".rstrip("0").rstrip(".")
    return "0" if s in ("", "-0") else s


def canonical(d):
    """Rewrite SVG path data in the explicit form MAUI's PathBuilder accepts.

    Lucide emits the compact SVG a browser is happy with, and MAUI is not a
    browser. Three shorthands break it, each silently - the parse stops and the
    rest of the icon is dropped, so it renders as a fragment rather than as
    nothing:

      * arc flags packed against the next number, "A2 2 0 0022 17", which is
        large-arc 0, sweep 0, x 22 and not the number 22;
      * a number whose separator is its own decimal point, "7.54.54";
      * extra coordinate pairs riding on an M, "M20 6 9 17", where everything
        after the first pair is a lineto and not another move.

    The output says all of it out loud: one command letter per argument group,
    every number spaced, arc flags standing alone. Same curves, same
    coordinates, no shorthand.
    """
    i, n = 0, len(d)
    out = []
    cmd = None

    def read_number():
        nonlocal i
        while i < n and d[i] in ", \t\r\n":
            i += 1
        m = NUM.match(d, i)
        if not m:
            raise ValueError(f"expected number at {i}: {d[i:i+20]!r}")
        i = m.end()
        return float(m.group())

    def read_flag():
        # An arc flag is exactly one character, which is what lets SVG write
        # "0022" and mean three separate values.
        nonlocal i
        while i < n and d[i] in ", \t\r\n":
            i += 1
        if i >= n or d[i] not in "01":
            raise ValueError(f"expected arc flag at {i}: {d[i:i+20]!r}")
        i += 1
        return d[i - 1]

    while i < n:
        c = d[i]
        if c in ", \t\r\n":
            i += 1
            continue

        if c.isalpha():
            cmd = c
            i += 1
        elif cmd is None:
            raise ValueError(f"data does not start with a command: {d[:20]!r}")
        else:
            # An implicit repeat: the previous command runs again. After an M
            # the repeat is a lineto, per the SVG grammar.
            if cmd in "Mm":
                cmd = "L" if cmd == "M" else "l"

        up = cmd.upper()
        if up == "Z":
            out.append(cmd)
            continue

        k = ARGC[up]
        if up == "A":
            a = [read_number(), read_number(), read_number()]
            f1, f2 = read_flag(), read_flag()
            a += [read_number(), read_number()]
            out.append(f"{cmd} {_fmt(a[0])} {_fmt(a[1])} {_fmt(a[2])} {f1} {f2} {_fmt(a[3])} {_fmt(a[4])}")
        else:
            a = [read_number() for _ in range(k)]
            out.append(cmd + " " + " ".join(_fmt(v) for v in a))

    return " ".join(out)


def convert(svg):
    parts = []

    for match in re.finditer(r"<(path|circle|ellipse|rect|line|polyline|polygon)\b([^>]*)>", svg):
        kind, body = match.group(1), match.group(0)
        a = attrs(body)

        if kind == "path":
            parts.append(absolute_start(a["d"]))
        elif kind == "circle":
            parts.append(circle(a))
        elif kind == "ellipse":
            parts.append(ellipse(a))
        elif kind == "rect":
            parts.append(rect(a))
        elif kind == "line":
            parts.append(line(a))
        elif kind == "polyline":
            parts.append(points(a, close=False))
        elif kind == "polygon":
            parts.append(points(a, close=True))

    body = " ".join(p.strip().replace("\n", " ") for p in parts)

    return f"{canonical(body)} {GRID_ANCHOR}" if body else body


def main():
    out = []

    for key, name in ICONS.items():
        try:
            with urllib.request.urlopen(RAW.format(name), timeout=40) as response:
                svg = response.read().decode("utf-8")
        except Exception as e:
            print(f"{key:22} {name:18} MISSING ({e})")
            continue

        figures = convert(svg)
        if not figures:
            raise SystemExit(f"{name}: nothing converted")

        out.append((key, name, figures))
        print(f"{key:22} {name:18} {len(figures):5} chars")

    with open("icons.generated.txt", "w", encoding="utf-8") as f:
        for key, name, figures in out:
            f.write(f'    <!-- lucide: {name} -->\n')
            f.write(f'    <PathGeometry x:Key="{key}"\n')
            f.write(f'                  Figures="{figures}" />\n\n')


main()
