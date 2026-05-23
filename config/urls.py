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

# ─────────────────────────────────────────────────────────────────────────────
# دوال مساعدة — خدمة ملفات React المبنية (frontend/dist/)
# ─────────────────────────────────────────────────────────────────────────────

DIST_DIR   = Path(settings.BASE_DIR) / "frontend" / "dist"
ASSETS_DIR = DIST_DIR / "assets"


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

    # ── Public: صفحة الهبوط (بدون مصادقة) ────────────────────────────────────
    path("api/public/", include((public_urlpatterns, "public"))),

    # ── Admin Site Settings: لوحة التحكم ─────────────────────────────────────
    path("api/admin/", include((admin_urlpatterns, "admin-site"))),

    # ── React SPA: خدمة ملفات Vite المبنية ───────────────────────────────────
    # JS/CSS chunks والـ assets المبنية
    re_path(r'^assets/(?P<path>.*)$', serve_frontend_assets),
    # ملفات ثابتة في جذر dist (vite.svg, favicon.ico, ...)
    re_path(r'^(?P<path>vite\.svg|favicon\.ico|logo\.png)$', serve_frontend_static),
    # Catch-all للـ SPA — يُعيد index.html لكل مسار لا يبدأ بـ api أو admin أو static أو media
    re_path(r'^(?!api/|admin/|static/|media/).*$',
            TemplateView.as_view(template_name='index.html'),
            name='frontend'),
]

# ── خدمة ملفات الـ Media ──────────────────────────────────────────────────────
# WhiteNoise تخدم /static/ فقط. ملفات /media/ (الصور المرفوعة) تُخدم
# بواسطة Django مباشرةً في كلتا البيئتين.
# ⚠️  في الإنتاج على Render: نظام الملفات مؤقت — استخدم Disk أو S3 للملفات الدائمة.
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
