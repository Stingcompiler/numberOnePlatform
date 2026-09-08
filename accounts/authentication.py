"""
================================================================================
accounts/authentication.py
================================================================================
CookieJWTAuthentication — مصادقة JWT مزدوجة المسار:

  • الويب  : التوكن من HttpOnly Cookie (يمنع سرقته عبر XSS) + فرض CSRF.
  • الموبايل: التوكن من ترويسة Authorization: Bearer (تطبيق native) — بلا CSRF
             (لا يعتمد على الكوكيز، والـ CSRF لا ينطبق على عملاء غير المتصفح).

التمييز يتم بترويسة Authorization: إن وُجدت ⇒ مسار Bearer (الموبايل)، وإلا
⇒ مسار الكوكي (الويب) مع تطبيق فحص CSRF على الطرق غير الآمنة
(POST/PUT/PATCH/DELETE). الطرق الآمنة (GET/HEAD/OPTIONS) مُعفاة تلقائياً.
================================================================================
"""

from django.conf import settings
from rest_framework import exceptions
from rest_framework.authentication import CSRFCheck
from rest_framework_simplejwt.authentication import JWTAuthentication


class CookieJWTAuthentication(JWTAuthentication):
    """
    يُوسّع JWTAuthentication الافتراضي:
    1. إن وُجدت ترويسة Authorization (الموبايل) ⇒ مصادقة Bearer الاعتيادية بلا CSRF.
    2. وإلا يقرأ Access Token من HttpOnly Cookie (الويب) ويفرض فحص CSRF.
    """

    def authenticate(self, request):
        # ── 1. مسار الموبايل: ترويسة Authorization: Bearer موجودة ⇒ بلا CSRF ──
        # الموبايل يرسل التوكن في الترويسة دائماً؛ الـ CSRF لا يمسّه إطلاقاً
        # حتى لو حمل الطلب كوكيز.
        if self.get_header(request) is not None:
            return super().authenticate(request)

        # ── 2. مسار الويب: التوكن من الكوكي ──────────────────────────────────
        access_token_name = getattr(
            settings, "SIMPLE_JWT", {}
        ).get("AUTH_COOKIE_ACCESS", "access_token")

        raw_token = request.COOKIES.get(access_token_name)
        if raw_token is None:
            # لا ترويسة ولا كوكي ⇒ زائر (يتكفّل به فحص الصلاحيات لاحقاً)
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
        except Exception:
            # توكن غير صالح/منتهٍ ⇒ لا مصادقة (ولا CSRF على زائر)
            return None

        user = self.get_user(validated_token)

        # فرض CSRF لطلبات الويب المصادَق عليها بالكوكي (يُعفي الطرق الآمنة)
        self.enforce_csrf(request)

        return user, validated_token

    def enforce_csrf(self, request):
        """
        يطبّق فحص Django CSRF (نفس أسلوب DRF SessionAuthentication).
        CsrfViewMiddleware يتخطّى الطرق الآمنة (GET/HEAD/OPTIONS/TRACE) تلقائياً،
        فلا تتأثر عمليات القراءة.
        """
        def dummy_get_response(request):  # pragma: no cover
            return None

        check = CSRFCheck(dummy_get_response)
        check.process_request(request)
        reason = check.process_view(request, None, (), {})
        if reason:
            raise exceptions.PermissionDenied(f"CSRF Failed: {reason}")
