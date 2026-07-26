"""
================================================================================
site_settings/seo_views.py — تصيير صفحة الهبوط من الخادم (SSR) لتحسين الـ SEO
================================================================================
المشكلة: الموقع مبني بـ React (CSR)، فالـ HTML القادم من الخادم كان قشرة فارغة
(1 كيلوبايت) تحوي <div id="root"></div> فقط — أي أن محركات البحث لا ترى محتوى.

الحل: هذه الوحدة تقرأ ملف البناء frontend/dist/index.html كما هو وتحقن فيه:
  1. Meta ديناميكية (title / description / keywords / canonical)
  2. Open Graph و Twitter Cards
  3. Structured Data — schema.org/EducationalOrganization
  4. محتوى دلالي كامل (h1/h2/h3 + صور بـ alt) داخل #root

تفصيل مهم: React يستبدل محتوى #root عند الإقلاع، لذا يرى الزائر الواجهة
التفاعلية كالمعتاد بينما يرى الزاحف المحتوى الكامل في أول استجابة. هذا يحسّن
LCP أيضاً لأن نصاً حقيقياً يُرسم قبل تحميل الـ JavaScript.

لا يمسّ هذا الملف: بناء React، لوحة التحكم، تطبيق الهاتف، أو أي واجهة API.
================================================================================
"""

import json
from pathlib import Path

from django.conf import settings
from django.http import HttpResponse
from django.utils.html import escape

from .models import SiteSettings, Announcement, StaffCard

DIST_INDEX = Path(settings.BASE_DIR) / "frontend" / "dist" / "index.html"


# ─────────────────────────────────────────────────────────────────────────────
# أدوات مساعدة
# ─────────────────────────────────────────────────────────────────────────────

def _abs(request, url: str) -> str:
    """يحوّل مساراً نسبياً إلى رابط مطلق (مطلوب لـ Open Graph و Schema)."""
    if not url:
        return ""
    if url.startswith(("http://", "https://")):
        return url
    return request.build_absolute_uri(url)


def _img(request, field) -> str:
    """رابط مطلق لحقل صورة، أو سلسلة فارغة إن لم توجد."""
    try:
        return _abs(request, field.url) if field else ""
    except (ValueError, AttributeError):
        return ""


def _txt(value: str, fallback: str = "") -> str:
    return (value or "").strip() or fallback


# ─────────────────────────────────────────────────────────────────────────────
# بناء وسوم الـ head
# ─────────────────────────────────────────────────────────────────────────────

def _build_head(request, s, logo_url) -> str:
    name = _txt(getattr(s, "institution_name", ""), "مدارس ومعاهد نمبر ون")
    desc = _txt(
        getattr(s, "meta_description", ""),
        _txt(getattr(s, "vision", ""), f"{name} — منصة تعليمية متكاملة."),
    )[:300]
    keywords = _txt(getattr(s, "meta_keywords", ""))
    canonical = request.build_absolute_uri("/")

    schema = {
        "@context": "https://schema.org",
        "@type": "EducationalOrganization",
        "name": name,
        "url": canonical,
        "description": desc,
    }
    if logo_url:
        schema["logo"] = logo_url
        schema["image"] = logo_url
    if _txt(getattr(s, "primary_email", "")):
        schema["email"] = s.primary_email
    if _txt(getattr(s, "primary_phone", "")):
        schema["telephone"] = s.primary_phone
    if _txt(getattr(s, "address_text", "")):
        schema["address"] = {
            "@type": "PostalAddress",
            "streetAddress": s.address_text,
        }

    tags = [
        f"<title>{escape(name)}</title>",
        f'<meta name="description" content="{escape(desc)}" />',
        f'<link rel="canonical" href="{escape(canonical)}" />',
        '<meta name="robots" content="index, follow, max-image-preview:large" />',
        # Open Graph
        '<meta property="og:type" content="website" />',
        f'<meta property="og:site_name" content="{escape(name)}" />',
        f'<meta property="og:title" content="{escape(name)}" />',
        f'<meta property="og:description" content="{escape(desc)}" />',
        f'<meta property="og:url" content="{escape(canonical)}" />',
        '<meta property="og:locale" content="ar_AR" />',
        # Twitter
        '<meta name="twitter:card" content="summary_large_image" />',
        f'<meta name="twitter:title" content="{escape(name)}" />',
        f'<meta name="twitter:description" content="{escape(desc)}" />',
    ]
    if keywords:
        tags.append(f'<meta name="keywords" content="{escape(keywords)}" />')
    if logo_url:
        tags.append(f'<meta property="og:image" content="{escape(logo_url)}" />')
        tags.append(f'<meta name="twitter:image" content="{escape(logo_url)}" />')

    tags.append(
        '<script type="application/ld+json">'
        + json.dumps(schema, ensure_ascii=False)
        + "</script>"
    )
    return "\n    ".join(tags)


# ─────────────────────────────────────────────────────────────────────────────
# بناء المحتوى الدلالي (يراه الزاحف؛ يستبدله React للزائر)
# ─────────────────────────────────────────────────────────────────────────────

def _build_body(request, s, logo_url, announcements, staff) -> str:
    name = _txt(getattr(s, "institution_name", ""), "مدارس ومعاهد نمبر ون")
    short = _txt(getattr(s, "short_title", ""), name)
    parts = ['<div id="seo-content">']

    # ── Hero — العنوان الرئيسي الوحيد h1 ──
    parts.append("<header>")
    if logo_url:
        parts.append(
            f'<img src="{escape(logo_url)}" width="120" height="120" '
            f'alt="شعار {escape(name)}" />'
        )
    parts.append(f"<h1>{escape(name)}</h1>")
    if short and short != name:
        parts.append(f"<p>{escape(short)}</p>")
    parts.append("</header>")

    # ── من نحن ──
    about = [
        ("الرؤية", _txt(getattr(s, "vision", ""))),
        ("الرسالة", _txt(getattr(s, "mission", ""))),
        ("أهدافنا", _txt(getattr(s, "objectives", ""))),
        ("عن المؤسسة", _txt(getattr(s, "history", ""))),
    ]
    about = [(t, b) for t, b in about if b]
    if about:
        parts.append('<section id="about"><h2>من نحن</h2>')
        for title, body in about:
            parts.append(f"<h3>{escape(title)}</h3><p>{escape(body)}</p>")
        parts.append("</section>")

    # ── الإعلانات ──
    if announcements:
        parts.append('<section id="announcements"><h2>الإعلانات</h2>')
        for a in announcements:
            parts.append(f"<article><h3>{escape(_txt(a.title))}</h3>")
            body = _txt(getattr(a, "body", ""))
            if body:
                parts.append(f"<p>{escape(body)}</p>")
            img = _img(request, getattr(a, "image", None))
            if img:
                parts.append(
                    f'<img src="{escape(img)}" loading="lazy" '
                    f'alt="{escape(_txt(a.title, "إعلان"))}" />'
                )
            parts.append("</article>")
        parts.append("</section>")

    # ── الكادر ──
    if staff:
        parts.append('<section id="staff"><h2>الكادر التعليمي والإداري</h2>')
        for m in staff:
            parts.append(f"<article><h3>{escape(_txt(m.name))}</h3>")
            role = _txt(getattr(m, "title", ""))
            if role:
                parts.append(f"<p>{escape(role)}</p>")
            bio = _txt(getattr(m, "bio", ""))
            if bio:
                parts.append(f"<p>{escape(bio)}</p>")
            photo = _img(request, getattr(m, "photo", None))
            if photo:
                parts.append(
                    f'<img src="{escape(photo)}" loading="lazy" '
                    f'alt="{escape(_txt(m.name, "عضو الكادر"))}" />'
                )
            parts.append("</article>")
        parts.append("</section>")

    # ── التواصل ──
    contact = [
        ("البريد الإلكتروني", _txt(getattr(s, "primary_email", ""))),
        ("الهاتف", _txt(getattr(s, "primary_phone", ""))),
        ("العنوان", _txt(getattr(s, "address_text", ""))),
    ]
    contact = [(t, v) for t, v in contact if v]
    if contact:
        parts.append('<section id="contact"><h2>تواصل معنا</h2><ul>')
        for label, value in contact:
            parts.append(f"<li>{escape(label)}: {escape(value)}</li>")
        parts.append("</ul></section>")

    parts.append(
        '<nav><a href="/register">تسجيل طالب جديد</a>'
        ' <a href="/login">تسجيل الدخول</a></nav>'
    )
    parts.append("</div>")
    return "".join(parts)


# ─────────────────────────────────────────────────────────────────────────────
# 1. صفحة الهبوط المُصيَّرة من الخادم
# ─────────────────────────────────────────────────────────────────────────────

def landing_ssr(request):
    """
    GET /  — نفس صفحة React تماماً، لكن مع Meta ومحتوى دلالي داخل الاستجابة.
    عند أي خطأ يعود للسلوك السابق (تقديم index.html كما هو) حتى لا تتعطل الصفحة.
    """
    try:
        html = DIST_INDEX.read_text(encoding="utf-8")
    except OSError:
        # البناء غير موجود (بيئة تطوير) — لا تُسقط الطلب
        return HttpResponse(
            "<!doctype html><html lang='ar' dir='rtl'><body>"
            "<h1>مدارس ومعاهد نمبر ون</h1></body></html>",
            content_type="text/html; charset=utf-8",
        )

    try:
        s = SiteSettings.get_settings()
        logo_url = _img(request, getattr(s, "logo", None))
        announcements = list(
            Announcement.objects.filter(is_active=True).order_by("display_order")[:10]
        )
        staff = list(
            StaffCard.objects.filter(is_active=True).order_by(
                "card_type", "display_order"
            )[:30]
        )

        head = _build_head(request, s, logo_url)
        body = _build_body(request, s, logo_url, announcements, staff)

        # إزالة الوسمين الثابتين القادمين من البناء لتفادي التكرار
        html = html.replace(
            "<title>مدارس ومعاهد نمبر ون</title>", ""
        ).replace(
            '<meta name="description" content="منصة تعليمية متكاملة — مدارس ومعاهد نمبر ون" />',
            "",
        )
        html = html.replace("</head>", f"    {head}\n  </head>", 1)
        html = html.replace('<div id="root"></div>', f'<div id="root">{body}</div>', 1)
    except Exception:
        # أي خطأ في البيانات: قدّم الصفحة الأصلية دون حقن بدل إظهار خطأ 500
        pass

    return HttpResponse(html, content_type="text/html; charset=utf-8")


# ─────────────────────────────────────────────────────────────────────────────
# 2. robots.txt — كان يُرجع HTML بسبب مسار الـ catch-all
# ─────────────────────────────────────────────────────────────────────────────

def robots_txt(request):
    sitemap = request.build_absolute_uri("/sitemap.xml")
    lines = [
        "User-agent: *",
        "Allow: /",
        "Disallow: /api/",
        "Disallow: /admin/",
        "Disallow: /dashboard/",
        "Disallow: /media/registrations/",
        "",
        f"Sitemap: {sitemap}",
    ]
    return HttpResponse("\n".join(lines), content_type="text/plain; charset=utf-8")


# ─────────────────────────────────────────────────────────────────────────────
# 3. sitemap.xml — كان يُرجع HTML أيضاً
# ─────────────────────────────────────────────────────────────────────────────

def sitemap_xml(request):
    try:
        s = SiteSettings.get_settings()
        lastmod = s.updated_at.date().isoformat() if s.updated_at else None
    except Exception:
        lastmod = None

    pages = [("/", "1.0"), ("/register", "0.8"), ("/login", "0.5")]
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path, priority in pages:
        out.append("<url>")
        out.append(f"<loc>{escape(request.build_absolute_uri(path))}</loc>")
        if lastmod:
            out.append(f"<lastmod>{lastmod}</lastmod>")
        out.append(f"<priority>{priority}</priority>")
        out.append("</url>")
    out.append("</urlset>")
    return HttpResponse("".join(out), content_type="application/xml; charset=utf-8")
