"""
================================================================================
config/urls.py — الـ Router الرئيسي لنظام "مدارس ومعاهد نمبر ون"
================================================================================

خريطة الـ API:

  /api/auth/          ← accounts (تسجيل دخول/خروج/تجديد/تعديل)
  /api/students/      ← accounts (إدارة الطلاب)
  /api/teachers/      ← accounts (إدارة الأساتذة)
  /api/supervisors/   ← accounts (إدارة المشرفات)

  /api/academic/      ← academic (المراحل، الفصول، الكورسات، المحاضرات، التمارين)

  /api/finance/       ← finance (الملفات المالية، الدفعات، سعر الصرف، التقارير)

  /api/public/        ← site_settings (صفحة الهبوط — بدون مصادقة)
  /api/admin/         ← site_settings (لوحة التحكم — الإدارة فقط)

  /api/admin-panel/   ← Django built-in admin

  /assets/*           ← React built assets (JS/CSS chunks)
  /*                  ← React SPA catch-all → index.html
================================================================================
"""

from pathlib import Path

from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from django.views.static import serve

# ── استيراد الـ URL patterns المقسّمة من site_settings ──────────────────────
from site_settings.urls import public_urlpatterns, admin_urlpatterns
from site_settings.seo_views import landing_ssr, robots_txt, sitemap_xml, privacy_policy
from store.urls import (
    public_urlpatterns as store_public_urlpatterns,
    admin_urlpatterns as store_admin_urlpatterns,
)

# ─────────────────────────────────────────────────────────────────────────────
# دوال مساعدة — خدمة ملفات React المبنية (frontend/dist/)
# ─────────────────────────────────────────────────────────────────────────────

DIST_DIR   = Path(settings.BASE_DIR) / "frontend" / "dist"
ASSETS_DIR = DIST_DIR / "assets"


def serve_protected_media(request, path):
    """
    يخدم ملفات /media/ مع حماية مجلد registrations/ الحسّاس.

    مجلد registrations/ يحوي وثائق شخصية للطلاب (هوية، شهادة ميلاد، إيصال دفع)
    وكان مكشوفاً للعموم. الآن يُقصر على مدير/مدير النظام فقط عبر كوكي JWT.
    بقية الوسائط (شعار الموقع، الصور العامة، الأفاتار، الصور المصغّرة...) تُخدَّم
    كما كانت دون أي تغيير في السلوك.
    """
    normalized = path.replace("\\", "/").lstrip("/")
    if normalized.startswith("registrations/"):
        from accounts.authentication import CookieJWTAuthentication
        from accounts.models import CustomUser
        from django.http import HttpResponseForbidden

        user = None
        try:
            result = CookieJWTAuthentication().authenticate(request)
            if result is not None:
                user = result[0]
        except Exception:
            user = None

        allowed = bool(
            user
            and getattr(user, "is_authenticated", False)
            and getattr(user, "role", None) in (CustomUser.Roles.ADMIN, CustomUser.Roles.MANAGER)
        )
        if not allowed:
            return HttpResponseForbidden("Forbidden")

    return serve(request, path, document_root=str(settings.MEDIA_ROOT))


def serve_frontend_assets(request, path):
    """يخدم ملفات JS/CSS/Images من frontend/dist/assets/"""
    return serve(request, path, document_root=str(ASSETS_DIR))


def serve_frontend_static(request, path):
    """يخدم ملفات جذر dist مثل vite.svg, favicon.ico"""
    return serve(request, path, document_root=str(DIST_DIR))


urlpatterns = [
    # ── Django Admin ──────────────────────────────────────────────────────────
    path("admin/", admin.site.urls),

    # ── Accounts: Auth + Students + Teachers + Supervisors ───────────────────
    path("api/", include("accounts.urls")),

    # ── Academic: الهيكل الأكاديمي + واجهات الطالب ───────────────────────────
    path("api/academic/", include("academic.urls")),

    # ── Exams: إدارة الاختبارات + مراجعة المحاولات ────────────────────────────
    path("api/exams/", include("exams.urls")),

    # ── Finance: الملفات المالية + الدفعات + التقارير ─────────────────────────
    path("api/finance/", include("finance.urls")),

    # ── Backups: النسخ الاحتياطي والاستعادة ─────────────────────────────────
    path("api/backups/", include("backups.urls")),

    # ── Notifications: إشعارات الدفع والتنبيهات ──────────────────────────────────
    path("api/notifications/", include("notifications.urls")),

    # ── Live: نظام البث المباشر (Rooms & Sessions) ────────────────────────────
    path("api/live/", include("live.urls")),

    # ── Public: صفحة الهبوط (بدون مصادقة) ────────────────────────────────────
    path("api/public/", include((public_urlpatterns, "public"))),

    # ── Store: متجر التطبيقات (عام + إدارة) ──────────────────────────────────
    path("api/public/store/", include((store_public_urlpatterns, "store-public"))),
    path("api/admin/store/",  include((store_admin_urlpatterns, "store-admin"))),

    # ── Admin Site Settings: لوحة التحكم ─────────────────────────────────────
    path("api/admin/", include((admin_urlpatterns, "admin-site"))),

    # ── React SPA: خدمة ملفات Vite المبنية ───────────────────────────────────
    # JS/CSS chunks والـ assets المبنية
    re_path(r'^assets/(?P<path>.*)$', serve_frontend_assets),
    # ملفات ثابتة في جذر dist (vite.svg, favicon.ico, ...)
    re_path(r'^(?P<path>vite\.svg|favicon\.ico|logo\.png)$', serve_frontend_static),
    # ── خدمة ملفات الـ Media (الصور المرفوعة) ─────────────────────────────────
    # WhiteNoise تخدم /static/ فقط. ملفات /media/ يُخدِّمها Django مباشرةً
    # عبر django.views.static.serve في كلتا البيئتين (DEBUG=True / DEBUG=False).
    # حارسان اثنان على /media/ لأن المحميّ نوعان مختلفان:
    #
    # 1) التعبير النمطي يستثني النسخ الاحتياطية من المسار أصلاً. مجلد النسخ قد
    #    يقع داخل MEDIA_ROOT على الأقراص الدائمة (Render)، فلولا الاستثناء
    #    لأمكن تنزيل قاعدة البيانات كاملةً من الإنترنت بلا مصادقة. يُحجب مجلد
    #    ‎.backups‎ المخصص، وأي أرشيف ‎backup_*.zip‎ أينما وقع — والثاني شبكة
    #    أمان لخطأ سهل: ضبط BACKUP_STORAGE_DIR على MEDIA_ROOT نفسه.
    #    التنزيل المشروع يمرّ عبر /api/backups/<id>/download/ المحمي.
    #
    # 2) serve_protected_media يقصر مجلد registrations/ على مدير/مدير النظام،
    #    وفيه وثائق شخصية (هوية، شهادة ميلاد، إيصال دفع).
    #
    # لا يغني أحدهما عن الآخر: الأول يمنع أرشيف قاعدة البيانات، والثاني يمنع
    # بيانات الطلاب الشخصية.
    re_path(r'^media/(?!\.backups/)(?!.*backup_[^/]*\.zip$)(?P<path>.*)$',
            serve_protected_media),

    # ── SEO ───────────────────────────────────────────────────────────────────
    # يجب أن تسبق الـ catch-all، وإلا ابتلعها وأعاد index.html بدلاً منها
    # (كان robots.txt و sitemap.xml يُقدَّمان كـ text/html فعلياً).
    path('robots.txt',  robots_txt,  name='robots-txt'),
    path('sitemap.xml', sitemap_xml, name='sitemap-xml'),

    # سياسة الخصوصية — إلزامية لنشر التطبيق على Google Play.
    # يجب أن تسبق الـ catch-all كي تُقدَّم كصفحة حقيقية لا كقشرة SPA.
    path('privacy',  privacy_policy, name='privacy-policy'),
    path('privacy/', privacy_policy),

    # صفحة الهبوط مُصيَّرة من الخادم (Meta + محتوى دلالي داخل الـ HTML)
    path('', landing_ssr, name='landing-ssr'),

    # Catch-all للـ SPA — يُعيد index.html لكل مسار لا يبدأ بـ api أو admin أو static أو media
    re_path(r'^(?!api/|admin/|static/|media/).*$',
            TemplateView.as_view(template_name='index.html'),
            name='frontend'),
]
