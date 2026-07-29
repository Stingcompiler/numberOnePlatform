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

    # لا رابط لصفحة تسجيل الدخول: مسارها غير معلن ومخصص للطاقم فقط
    parts.append('<nav><a href="/register">تسجيل طالب جديد</a></nav>')
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
# 1.b سياسة الخصوصية — إلزامية لنشر التطبيق على Google Play
# ─────────────────────────────────────────────────────────────────────────────
# تُقدَّم كصفحة مستقلة مُصيَّرة من الخادم بالكامل (لا تعتمد على JavaScript)،
# لأن مراجعي Google والزواحف يجب أن يصلوا إليها دائماً وبلا تسجيل دخول.
# محتواها مبنيّ على ما يجمعه النظام فعلياً، ويجب أن يطابق نموذج Data Safety.

PRIVACY_SECTIONS = [
    ("البيانات التي نجمعها", [
        ("بيانات الحساب",
         "الاسم الكامل، اسم المستخدم، رقم الهاتف، والصورة الشخصية للحساب إن رُفعت."),
        ("بيانات ولي الأمر",
         "اسم ولي الأمر ورقم هاتفه وعنوان السكن، لأغراض التواصل الإداري."),
        ("مستندات التسجيل",
         "عند التقديم للتسجيل: صورة الرقم الوطني للطالب والأب والأم، شهادة الميلاد، "
         "آخر نتيجة دراسية، صورة شخصية، وإيصال سداد الرسوم. تُستخدم للتحقق من الهوية "
         "واستكمال إجراءات القبول فقط."),
        ("معرّف الجهاز",
         "معرّف الجهاز الذي يوفّره نظام أندرويد، ويُستخدم حصراً لربط حساب الطالب بجهاز "
         "واحد منعاً لمشاركة الحسابات. لا نجمع رقم الهاتف التسلسلي ولا موقع الجهاز."),
        ("بيانات الاستخدام الأكاديمي",
         "المحاضرات المُشاهَدة، حالة إكمالها، إجابات التمارين، ومحاولات الاختبارات ودرجاتها."),
        ("البيانات المالية",
         "سجلات الرسوم والدفعات المسجَّلة من الإدارة. لا نجمع بيانات بطاقات بنكية "
         "ولا تتم أي عملية دفع داخل التطبيق."),
        ("رموز الإشعارات",
         "رمز الإشعارات الذي تصدره خدمة Expo، لإرسال تنبيهات المحاضرات والنتائج."),
    ]),
    ("كيف نستخدم البيانات", [
        ("", "تقديم الخدمة التعليمية: عرض المقررات والمحاضرات والاختبارات وتسجيل التقدّم."),
        ("", "التحقق من الهوية واستكمال إجراءات التسجيل والقبول."),
        ("", "حماية الحساب عبر ربطه بجهاز واحد ومنع الاستخدام غير المصرّح به."),
        ("", "إرسال إشعارات متعلقة بالدراسة والنتائج والرسوم."),
        ("", "التواصل الإداري مع الطالب أو ولي أمره عند الحاجة."),
    ]),
    ("ما لا نفعله", [
        ("", "لا نبيع بياناتك الشخصية لأي جهة."),
        ("", "لا نشارك بياناتك مع معلنين ولا نعرض إعلانات داخل التطبيق."),
        ("", "لا نجمع موقعك الجغرافي ولا جهات اتصالك ولا رسائلك."),
        ("", "لا نصل إلى الكاميرا أو الميكروفون."),
    ]),
    ("مشاركة البيانات", [
        ("", "تُشارَك البيانات داخلياً مع الكادر الإداري والمشرفين والمعلمين المخوّلين "
             "بالقدر اللازم لأداء عملهم فقط."),
        ("", "نستعين بمزوّدي خدمة تقنيين لتشغيل المنصة: استضافة الخوادم وقاعدة البيانات، "
             "وخدمة الإشعارات (Expo)، وخدمة استضافة الفيديو التعليمي."),
        ("", "قد نُفصح عن البيانات إذا ألزمنا القانون بذلك."),
    ]),
    ("حماية البيانات", [
        ("", "الاتصال بالخادم مشفَّر عبر HTTPS."),
        ("", "تُخزَّن رموز الدخول في التخزين الآمن للنظام (Keystore / Keychain)."),
        ("", "مستندات التسجيل محمية ولا تُتاح إلا لحسابات الإدارة المخوّلة."),
        ("", "كلمات المرور مُخزَّنة مُجزَّأة (hashed) ولا يمكن استرجاعها كنص."),
    ]),
    ("الاحتفاظ بالبيانات", [
        ("", "نحتفظ ببيانات الطالب طوال مدة ارتباطه بالمؤسسة، وبالسجلات الأكاديمية "
             "والمالية للمدة التي تقتضيها الأنظمة الإدارية والقانونية."),
    ]),
    ("حقوقك", [
        ("", "طلب الاطلاع على بياناتك أو تصحيحها."),
        ("", "طلب حذف حسابك وبياناتك، ضمن ما تسمح به الالتزامات الإدارية والقانونية."),
        ("", "سحب موافقتك على الإشعارات في أي وقت من إعدادات الجهاز."),
        ("", "لممارسة أي من هذه الحقوق تواصل معنا عبر البيانات أدناه."),
    ]),
    ("خصوصية القاصرين", [
        ("", "المنصة موجّهة لطلاب المؤسسة، وقد يكون بعضهم قاصراً. يتم التسجيل عبر "
             "المؤسسة وبعلم ولي الأمر الذي تُجمع بياناته ضمن استمارة التسجيل. "
             "لولي الأمر حق الاطلاع على بيانات ابنه أو طلب حذفها بالتواصل مع الإدارة."),
    ]),
]


def privacy_policy(request):
    """GET /privacy — صفحة سياسة الخصوصية (عامة، بلا تسجيل دخول، بلا JavaScript)."""
    try:
        s = SiteSettings.get_settings()
        name = _txt(getattr(s, "institution_name", ""), "مدارس ومعاهد نمبر ون")
        email = _txt(getattr(s, "primary_email", ""))
        phone = _txt(getattr(s, "primary_phone", ""))
        address = _txt(getattr(s, "address_text", ""))
    except Exception:
        name, email, phone, address = "مدارس ومعاهد نمبر ون", "", "", ""

    body = []
    for title, items in PRIVACY_SECTIONS:
        body.append(f"<h2>{escape(title)}</h2>")
        simple = all(not sub for sub, _ in items)
        if simple:
            body.append("<ul>")
            for _sub, text in items:
                body.append(f"<li>{escape(text)}</li>")
            body.append("</ul>")
        else:
            for sub, text in items:
                if sub:
                    body.append(f"<h3>{escape(sub)}</h3>")
                body.append(f"<p>{escape(text)}</p>")

    contact = ["<h2>التواصل معنا</h2>", "<ul>"]
    if email:
        contact.append(f'<li>البريد الإلكتروني: <a href="mailto:{escape(email)}">{escape(email)}</a></li>')
    if phone:
        contact.append(f"<li>الهاتف: {escape(phone)}</li>")
    if address:
        contact.append(f"<li>العنوان: {escape(address)}</li>")
    contact.append("</ul>")
    if not (email or phone):
        contact.append("<p>يرجى التواصل مع إدارة المؤسسة.</p>")

    canonical = request.build_absolute_uri("/privacy")
    html = f"""<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>سياسة الخصوصية — {escape(name)}</title>
<meta name="description" content="سياسة الخصوصية الخاصة بمنصة {escape(name)}: البيانات التي نجمعها وكيفية استخدامها وحمايتها وحقوقك." />
<link rel="canonical" href="{escape(canonical)}" />
<meta name="robots" content="index, follow" />
<style>
  :root {{ color-scheme: dark; }}
  body {{ margin:0; padding:0; background:#070B14; color:#E6EAF2;
         font-family:'Tajawal','Segoe UI',system-ui,sans-serif; line-height:1.9; }}
  .wrap {{ max-width:860px; margin:0 auto; padding:40px 20px 80px; }}
  header {{ border-bottom:1px solid rgba(255,255,255,.1); padding-bottom:24px; margin-bottom:32px; }}
  h1 {{ font-size:1.9rem; margin:0 0 8px; color:#fff; }}
  .sub {{ color:#94A3B8; font-size:.95rem; margin:0; }}
  h2 {{ font-size:1.25rem; color:#fff; margin:36px 0 12px;
        border-right:3px solid #1A56DB; padding-right:12px; }}
  h3 {{ font-size:1rem; color:#2563EB; margin:20px 0 6px; }}
  p, li {{ color:#CBD5E1; font-size:.98rem; }}
  ul {{ padding-right:22px; }}
  li {{ margin-bottom:8px; }}
  a {{ color:#2563EB; }}
  footer {{ margin-top:48px; padding-top:24px; border-top:1px solid rgba(255,255,255,.1);
            color:#64748B; font-size:.85rem; }}
  .home {{ display:inline-block; margin-top:12px; color:#2563EB; text-decoration:none; }}
  @media (max-width:600px) {{ h1 {{ font-size:1.5rem; }} .wrap {{ padding:24px 16px 60px; }} }}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>سياسة الخصوصية</h1>
    <p class="sub">{escape(name)}</p>
  </header>
  <p>توضّح هذه السياسة البيانات التي نجمعها عبر منصة {escape(name)} وتطبيقها على الهاتف،
     وكيفية استخدامها وحمايتها، وحقوقك تجاهها.</p>
  {''.join(body)}
  {''.join(contact)}
  <footer>
    <p>قد نُحدِّث هذه السياسة عند تغيّر خدماتنا، وسيظهر أي تحديث على هذه الصفحة.</p>
    <a class="home" href="/">← العودة للصفحة الرئيسية</a>
  </footer>
</div>
</body>
</html>"""
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
        "Disallow: /np-access",
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

    # صفحة تسجيل الدخول مستبعدة عمداً: مسارها غير معلن ولا يُراد فهرسته
    pages = [("/", "1.0"), ("/register", "0.8"), ("/privacy", "0.6")]
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
