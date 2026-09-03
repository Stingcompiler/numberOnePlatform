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


def convert(svg):
    parts = []

    for tag in re.findall(r"<(path|circle|ellipse|rect|line|polyline|polygon)\b[^>]*>", svg):
        pass  # placeholder; real loop below

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

    return " ".join(p.strip().replace("\n", " ") for p in parts)


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
