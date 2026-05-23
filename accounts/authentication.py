"""
================================================================================
accounts/authentication.py
================================================================================
CookieJWTAuthentication — مصادقة JWT من HttpOnly Cookies

يُستبدل الـ Header العادي (Authorization: Bearer ...) بقراءة الـ Token
مباشرةً من الـ Cookie المشفّر HttpOnly لمنع XSS.
================================================================================
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from django.conf import settings


class CookieJWTAuthentication(JWTAuthentication):
    """
    يُوسّع JWTAuthentication الافتراضي ليقرأ الـ Access Token من HttpOnly Cookie
    بدلاً من Authorization Header.

    الترتيب:
    1. يحاول قراءة التوكن من الـ Cookie.
    2. إن لم يجد، يتراجع للـ Header الاعتيادي (للتوافق مع الموبايل إذا لزم).
    """

    def authenticate(self, request):
        # 1. قراءة التوكن من Cookie
        access_token_name = getattr(
            settings, "SIMPLE_JWT", {}
        ).get("AUTH_COOKIE_ACCESS", "access_token")

        raw_token = request.COOKIES.get(access_token_name)

        if raw_token is None:
            # تراجع للـ Header للموبايل
            return super().authenticate(request)

        try:
            validated_token = self.get_validated_token(raw_token)
            return self.get_user(validated_token), validated_token
        except Exception:
            return None
