"""
================================================================================
config/settings.py — Django Settings لـ "مدارس ومعاهد نمبر ون"
================================================================================
يدعم بيئتين:
  • التطوير المحلي  → DEBUG=True, SQLite, CORS مفتوح للـ localhost
  • الإنتاج (Render) → DEBUG=False, PostgreSQL عبر DATABASE_URL, WhiteNoise
================================================================================
"""

import os
import dj_database_url
from pathlib import Path
from datetime import timedelta

from decouple import config, Csv

# ─────────────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent

# ─────────────────────────────────────────────────────────────────────────────
# الأمان الأساسي
# ─────────────────────────────────────────────────────────────────────────────
SECRET_KEY = config("SECRET_KEY", default="change-me-in-production-please-use-a-long-random-string")
DEBUG      = config("DEBUG", default=False, cast=bool)

# ALLOWED_HOSTS يُقرأ من متغير البيئة كقائمة مفصولة بفواصل.
# مثال للإنتاج: ALLOWED_HOSTS=yourdomain.onrender.com,api.yourdomain.com
# في التطوير المحلي: ALLOWED_HOSTS=localhost,127.0.0.1
ALLOWED_HOSTS = config(
    "ALLOWED_HOSTS",
    default="localhost,127.0.0.1",
    cast=Csv(),
)

# ─────────────────────────────────────────────────────────────────────────────
# التطبيقات المثبّتة
# ─────────────────────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # ── مكتبات خارجية ────────────────────────────────────────────────────────
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    # ── تطبيقات المشروع ──────────────────────────────────────────────────────
    "accounts",
    "academic",
    "finance",
    "site_settings",
    "exams",
    "backups",
    "notifications",
]

# ─────────────────────────────────────────────────────────────────────────────
# Middleware
# WhiteNoise يجب أن يأتي مباشرةً بعد SecurityMiddleware وقبل كل شيء آخر
# حتى يتمكن من خدمة الملفات الثابتة بكفاءة عالية.
# ─────────────────────────────────────────────────────────────────────────────
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",          # يجب أن يكون أولاً
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",      # ← WhiteNoise للملفات الثابتة
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [
            BASE_DIR / "frontend" / "dist",   # React SPA build للإنتاج
            BASE_DIR / "templates",            # قوالب Django admin وغيره
        ],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ─────────────────────────────────────────────────────────────────────────────
# قاعدة البيانات
# ─────────────────────────────────────────────────────────────────────────────
# الأولوية:
#   1. DATABASE_URL  ← Render يحقنها تلقائياً عند ربط PostgreSQL
#   2. DB_* vars     ← للإعداد اليدوي (PostgreSQL محلي أو غيره)
#   3. SQLite        ← التطوير المحلي الافتراضي

_DATABASE_URL = config("DATABASE_URL", default=None)

if _DATABASE_URL:
    # Render / PostgreSQL: parse URL مثل postgres://user:pass@host/db
    DATABASES = {
        "default": dj_database_url.parse(
            _DATABASE_URL,
            conn_max_age=600,        # إبقاء الاتصالات مفتوحة لمدة 10 دقائق
            conn_health_checks=True, # فحص صحة الاتصال قبل الاستخدام
        )
    }
else:
    # التطوير المحلي: SQLite أو PostgreSQL يدوي عبر DB_* vars
    DATABASES = {
        "default": {
            "ENGINE":   config("DB_ENGINE",   default="django.db.backends.sqlite3"),
            "NAME":     config("DB_NAME",     default=str(BASE_DIR / "db.sqlite3")),
            "USER":     config("DB_USER",     default=""),
            "PASSWORD": config("DB_PASSWORD", default=""),
            "HOST":     config("DB_HOST",     default=""),
            "PORT":     config("DB_PORT",     default=""),
        }
    }

# ─────────────────────────────────────────────────────────────────────────────
# نموذج المستخدم المخصص
# ─────────────────────────────────────────────────────────────────────────────
AUTH_USER_MODEL = "accounts.CustomUser"

# ─────────────────────────────────────────────────────────────────────────────
# Django REST Framework
# ─────────────────────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        # JWT يُقرأ من HttpOnly Cookie بواسطة Middleware مخصص
        "accounts.authentication.CookieJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS":  "accounts.pagination.StandardPagination",
    "PAGE_SIZE": 10,
}

# ─────────────────────────────────────────────────────────────────────────────
# JWT — SimpleJWT عبر HttpOnly Cookies فقط (لا LocalStorage)
# ─────────────────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME":    timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME":   timedelta(days=7),
    "ROTATE_REFRESH_TOKENS":    True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN":        True,
    "ALGORITHM":                "HS256",
    "SIGNING_KEY":              SECRET_KEY,
    "AUTH_HEADER_TYPES":        ("Bearer",),
    # أسماء الـ Cookies — تُستخدم في CookieJWTAuthentication
    "AUTH_COOKIE_ACCESS":    "access_token",
    "AUTH_COOKIE_REFRESH":   "refresh_token",
    # في الإنتاج (HTTPS): True تلقائياً. في التطوير: False
    "AUTH_COOKIE_SECURE":    config("COOKIE_SECURE", default=not DEBUG, cast=bool),
    "AUTH_COOKIE_HTTP_ONLY": True,
    "AUTH_COOKIE_SAMESITE":  "Lax",
    "AUTH_COOKIE_PATH":      "/",
}

# ─────────────────────────────────────────────────────────────────────────────
# CORS — السماح للـ React Frontend بالتواصل مع الـ API
# في الإنتاج: CORS_ALLOWED_ORIGINS=https://yourdomain.onrender.com
# في التطوير: CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
# ─────────────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:5173,http://127.0.0.1:5173",
    cast=Csv(),
)

CORS_ALLOW_CREDENTIALS = True  # ضروري لإرسال الـ Cookies مع withCredentials

# ─────────────────────────────────────────────────────────────────────────────
# CSRF Trusted Origins
# يجب أن تطابق قيم CORS_ALLOWED_ORIGINS في الإنتاج
# ─────────────────────────────────────────────────────────────────────────────
CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS",
    default="http://localhost:5173,http://127.0.0.1:5173",
    cast=Csv(),
)

# ─────────────────────────────────────────────────────────────────────────────
# إعدادات الأمان للإنتاج (تُفعَّل تلقائياً عند DEBUG=False)
# ─────────────────────────────────────────────────────────────────────────────
if not DEBUG:
    # ─────────────────────────────────────────────────────────────────────────
    # ⚠️  SECURE_SSL_REDIRECT: أوقفها إذا كان Render Load Balancer يتولى HTTPS
    # Render يُرسل X-Forwarded-Proto: https → نُخبر Django بالثقة به
    # تفعيل SSL_REDIRECT يُسبب infinite redirect loop خلف Render LB
    # ─────────────────────────────────────────────────────────────────────────
    SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=False, cast=bool)
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

    # HSTS: بعد التأكد من أن HTTPS يعمل، فعّل HSTS
    SECURE_HSTS_SECONDS            = 31_536_000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD            = True

    # حماية إضافية
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_BROWSER_XSS_FILTER   = True
    SESSION_COOKIE_SECURE        = True
    CSRF_COOKIE_SECURE           = True
    X_FRAME_OPTIONS              = "DENY"
    SECURE_REFERRER_POLICY       = "strict-origin-when-cross-origin"

# ─────────────────────────────────────────────────────────────────────────────
# Internationalization
# ─────────────────────────────────────────────────────────────────────────────
LANGUAGE_CODE = "ar"
TIME_ZONE     = "Africa/Khartoum"
USE_I18N      = True
USE_TZ        = True

# ─────────────────────────────────────────────────────────────────────────────
# الملفات الثابتة — WhiteNoise
# ─────────────────────────────────────────────────────────────────────────────
STATIC_URL  = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# مجلدات إضافية للملفات الثابتة (React assets build)
# مشروطة: إذا لم يكن المجلد موجوداً (قبل npm run build) لا يحدث خطأ
_react_assets = BASE_DIR / "frontend" / "dist" / "assets"
STATICFILES_DIRS = [_react_assets] if _react_assets.exists() else []

# WhiteNoise: ضغط Brotli/Gzip + Cache-busting hash في أسماء الملفات
STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
    # الملفات الوسائطية (الصور المرفوعة) — التخزين الافتراضي المحلي
    # ⚠️  تحذير: Render يستخدم نظام ملفات مؤقت (ephemeral).
    #    في الإنتاج الحقيقي يُنصح بـ S3 أو Cloudflare R2.
    #    اقرأ: https://render.com/docs/disks
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# ملفات الوسائط (صور مرفوعة)
# ─────────────────────────────────────────────────────────────────────────────
MEDIA_URL  = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# ─────────────────────────────────────────────────────────────────────────────
# مجلد تخزين النسخ الاحتياطية
# ─────────────────────────────────────────────────────────────────────────────
BACKUP_STORAGE_DIR = BASE_DIR / "backups_storage"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
