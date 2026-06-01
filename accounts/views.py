"""
================================================================================
accounts/views.py
================================================================================
Views الكاملة لإدارة المستخدمين، المصادقة، الطلاب، الأساتذة، والمشرفات.

نقاط نهاية المصادقة (Auth Endpoints):
  POST /api/auth/login/       — تسجيل الدخول + ضبط HttpOnly Cookies
  POST /api/auth/logout/      — تسجيل الخروج + مسح الـ Cookies
  POST /api/auth/refresh/     — تجديد الـ Access Token من Refresh Cookie
  GET  /api/auth/me/          — بيانات المستخدم الحالي
  POST /api/auth/change-password/ — تغيير كلمة المرور
================================================================================
"""

from django.conf import settings
from django.utils.translation import gettext_lazy as _
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from rest_framework_simplejwt.tokens import RefreshToken

from .models import CustomUser, StudentProfile, TeacherProfile, Supervisor, StudentRequest, NewStudentRegistration, RegistrationCondition, LectureSupervisorProfile
from .permissions import IsAdmin, IsAdminOrManager
from .serializers import (
    AdminResetPasswordSerializer,
    ChangePasswordSerializer,
    LoginSerializer,
    StudentCreateSerializer,
    StudentProfileSerializer,
    StudentUnbindDeviceSerializer,
    SupervisorSerializer,
    TeacherCreateSerializer,
    TeacherProfileSerializer,
    UserDetailSerializer,
    StudentRequestSerializer,
    NewStudentRegistrationSerializer,
    RegistrationConditionSerializer,
    LectureSupervisorProfileSerializer,
    LectureSupervisorCreateSerializer,
)


# ─────────────────────────────────────────────────────────────────────────────
# دوال مساعدة — إدارة الـ Cookies
# ─────────────────────────────────────────────────────────────────────────────

JWT_SETTINGS = getattr(settings, "SIMPLE_JWT", {})


def _set_auth_cookies(response: Response, refresh_token) -> None:
    """
    يضع Access Token و Refresh Token في HttpOnly Cookies.
    يُستدعى بعد أي عملية تسجيل دخول أو تجديد توكن.
    """
    access_token = refresh_token.access_token

    response.set_cookie(
        key      = JWT_SETTINGS.get("AUTH_COOKIE_ACCESS", "access_token"),
        value    = str(access_token),
        max_age  = int(JWT_SETTINGS.get("ACCESS_TOKEN_LIFETIME").total_seconds()),
        secure   = JWT_SETTINGS.get("AUTH_COOKIE_SECURE", False),
        httponly = True,
        samesite = JWT_SETTINGS.get("AUTH_COOKIE_SAMESITE", "Lax"),
        path     = JWT_SETTINGS.get("AUTH_COOKIE_PATH", "/"),
    )
    response.set_cookie(
        key      = JWT_SETTINGS.get("AUTH_COOKIE_REFRESH", "refresh_token"),
        value    = str(refresh_token),
        max_age  = int(JWT_SETTINGS.get("REFRESH_TOKEN_LIFETIME").total_seconds()),
        secure   = JWT_SETTINGS.get("AUTH_COOKIE_SECURE", False),
        httponly = True,
        samesite = JWT_SETTINGS.get("AUTH_COOKIE_SAMESITE", "Lax"),
        path     = JWT_SETTINGS.get("AUTH_COOKIE_PATH", "/"),
    )


def _clear_auth_cookies(response: Response) -> None:
    """يمسح كلا الـ Cookies عند تسجيل الخروج."""
    response.delete_cookie(
        JWT_SETTINGS.get("AUTH_COOKIE_ACCESS", "access_token"),
        path=JWT_SETTINGS.get("AUTH_COOKIE_PATH", "/"),
    )
    response.delete_cookie(
        JWT_SETTINGS.get("AUTH_COOKIE_REFRESH", "refresh_token"),
        path=JWT_SETTINGS.get("AUTH_COOKIE_PATH", "/"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 1. تسجيل الدخول
# ─────────────────────────────────────────────────────────────────────────────

class LoginView(APIView):
    """POST /api/auth/login/"""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        user          = serializer.validated_data["user"]
        refresh_token = RefreshToken.for_user(user)
        user_data     = UserDetailSerializer(user).data

        response = Response(
            {"detail": _("تم تسجيل الدخول بنجاح."), "user": user_data},
            status=status.HTTP_200_OK,
        )
        _set_auth_cookies(response, refresh_token)
        return response


# ─────────────────────────────────────────────────────────────────────────────
# 2. تسجيل الخروج
# ─────────────────────────────────────────────────────────────────────────────

class LogoutView(APIView):
    """POST /api/auth/logout/"""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_cookie_name = JWT_SETTINGS.get("AUTH_COOKIE_REFRESH", "refresh_token")
        raw_refresh = request.COOKIES.get(refresh_cookie_name)

        response = Response(
            {"detail": _("تم تسجيل الخروج بنجاح.")},
            status=status.HTTP_200_OK,
        )
        _clear_auth_cookies(response)

        if raw_refresh:
            try:
                RefreshToken(raw_refresh).blacklist()
            except (TokenError, InvalidToken):
                pass

        return response


# ─────────────────────────────────────────────────────────────────────────────
# 3. تجديد الـ Access Token
# ─────────────────────────────────────────────────────────────────────────────

class TokenRefreshCookieView(APIView):
    """
    POST /api/auth/refresh/
    يُستدعى بواسطة Axios Interceptor في React عند انتهاء صلاحية الـ Access Token.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        refresh_cookie_name = JWT_SETTINGS.get("AUTH_COOKIE_REFRESH", "refresh_token")
        raw_refresh = request.COOKIES.get(refresh_cookie_name)

        if not raw_refresh:
            return Response(
                {"detail": _("لا يوجد Refresh Token. يجب تسجيل الدخول من جديد.")},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        try:
            refresh_token = RefreshToken(raw_refresh)
            user = CustomUser.objects.get(id=refresh_token["user_id"])
            user_data = UserDetailSerializer(user).data
        except (TokenError, InvalidToken, CustomUser.DoesNotExist):
            response = Response(
                {"detail": _("انتهت الجلسة. يرجى تسجيل الدخول من جديد.")},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            _clear_auth_cookies(response)
            return response

        response = Response(
            {"detail": _("تم تجديد التوكن."), "user": user_data},
            status=status.HTTP_200_OK,
        )
        _set_auth_cookies(response, refresh_token)
        return response


# ─────────────────────────────────────────────────────────────────────────────
# 4. بيانات المستخدم الحالي
# ─────────────────────────────────────────────────────────────────────────────

class MeView(APIView):
    """GET / PATCH /api/auth/me/"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserDetailSerializer(request.user).data)

    def patch(self, request):
        serializer = UserDetailSerializer(
            request.user, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ─────────────────────────────────────────────────────────────────────────────
# 5. تغيير كلمة المرور
# ─────────────────────────────────────────────────────────────────────────────

class ChangePasswordView(APIView):
    """POST /api/auth/change-password/"""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": _("تم تغيير كلمة المرور بنجاح.")})


class AdminResetPasswordView(APIView):
    """
    POST /api/admin/reset-password/
    إعادة تعيين كلمة المرور لمستخدم (طالب أو مشرف كورسات) من قبل مدير النظام.
    لا يتطلب كلمة المرور القديمة.
    """

    permission_classes = [IsAdminOrManager]

    def post(self, request):
        serializer = AdminResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_user = serializer.save()
        return Response({
            "detail": _("تم إعادة تعيين كلمة المرور بنجاح."),
            "user_id": str(target_user.pk),
            "full_name": target_user.full_name,
        })


# ─────────────────────────────────────────────────────────────────────────────
# 6. إدارة الطلاب
# ─────────────────────────────────────────────────────────────────────────────

class StudentListCreateView(generics.ListCreateAPIView):
    """GET /api/students/ | POST /api/students/"""

    permission_classes = [IsAdminOrManager]
    queryset = StudentProfile.objects.select_related(
        "user", "supervisor", "enrolled_grade", "enrolled_grade__level"
    ).order_by("-registered_at")

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        
        search = params.get('search')
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(user__full_name__icontains=search) |
                Q(user__phone__icontains=search) |
                Q(user__username__icontains=search)
            )
            
        grade = params.get('grade')
        if grade:
            qs = qs.filter(enrolled_grade_id=grade)
            
        level = params.get('level')
        if level:
            qs = qs.filter(enrolled_grade__level_id=level)

        system_type = params.get('system_type')
        if system_type:
            qs = qs.filter(system_type=system_type)
            
        return qs

    def get_serializer_class(self):
        if self.request.method == "POST":
            return StudentCreateSerializer
        return StudentProfileSerializer

    def create(self, request, *args, **kwargs):
        serializer = StudentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user    = serializer.save()
        profile = user.student_profile
        return Response(
            StudentProfileSerializer(profile).data,
            status=status.HTTP_201_CREATED,
        )


class StudentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET / PATCH / DELETE /api/students/<id>/"""

    permission_classes = [IsAdminOrManager]
    queryset = StudentProfile.objects.select_related("user", "supervisor", "enrolled_grade")
    serializer_class = StudentProfileSerializer

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        partial  = kwargs.pop("partial", False)
        instance = self.get_object()

        user_data = request.data.pop("user", None)
        if user_data:
            user_ser = UserDetailSerializer(
                instance.user, data=user_data, partial=True
            )
            user_ser.is_valid(raise_exception=True)
            user_ser.save()

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class StudentUnbindDeviceView(APIView):
    """POST /api/students/<id>/unbind-device/ — للمدير فقط"""

    permission_classes = [IsAdminOrManager]

    def post(self, request, pk):
        try:
            profile = StudentProfile.objects.get(pk=pk)
        except StudentProfile.DoesNotExist:
            return Response(
                {"detail": _("الطالب غير موجود.")},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = StudentUnbindDeviceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if not profile.device_id:
            return Response(
                {"detail": _("هذا الطالب لا يمتلك جهازاً مربوطاً.")},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile.unbind_device()
        return Response({"detail": _("تم فك ارتباط الجهاز بنجاح.")})


# ─────────────────────────────────────────────────────────────────────────────
# 7. إدارة الأساتذة
# ─────────────────────────────────────────────────────────────────────────────

class TeacherListCreateView(generics.ListCreateAPIView):
    """GET /api/teachers/ | POST /api/teachers/"""

    permission_classes = [IsAdminOrManager]
    queryset = TeacherProfile.objects.select_related("user").order_by("display_order")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return TeacherCreateSerializer
        return TeacherProfileSerializer

    def create(self, request, *args, **kwargs):
        serializer = TeacherCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user    = serializer.save()
        profile = user.teacher_profile
        return Response(
            TeacherProfileSerializer(profile).data,
            status=status.HTTP_201_CREATED,
        )


class TeacherDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET / PATCH / DELETE /api/teachers/<id>/"""

    permission_classes = [IsAdminOrManager]
    queryset = TeacherProfile.objects.select_related("user")
    serializer_class = TeacherProfileSerializer

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


# ─────────────────────────────────────────────────────────────────────────────
# 8. إدارة المشرفات
# ─────────────────────────────────────────────────────────────────────────────

class SupervisorListCreateView(generics.ListCreateAPIView):
    """GET /api/supervisors/ | POST /api/supervisors/"""

    permission_classes = [IsAdminOrManager]
    queryset = Supervisor.objects.order_by("name")
    serializer_class = SupervisorSerializer


class SupervisorDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET / PATCH / DELETE /api/supervisors/<id>/"""

    permission_classes = [IsAdminOrManager]
    queryset = Supervisor.objects.all()
    serializer_class = SupervisorSerializer

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


def _apply_date_filters(qs, params):
    """
    Helper: apply date filters on a queryset filtered by registered_at.
    Supported params:
      - filter_type: monthly | yearly | day | range
      - year: YYYY
      - month: 1-12
      - day: YYYY-MM-DD
      - date_from: YYYY-MM-DD
      - date_to:   YYYY-MM-DD
    """
    from django.utils.dateparse import parse_date
    import datetime

    filter_type = params.get('filter_type')

    if filter_type == 'yearly':
        year = params.get('year')
        if year:
            qs = qs.filter(registered_at__year=int(year))

    elif filter_type == 'monthly':
        year  = params.get('year')
        month = params.get('month')
        if year:
            qs = qs.filter(registered_at__year=int(year))
        if month:
            qs = qs.filter(registered_at__month=int(month))

    elif filter_type == 'day':
        day_str = params.get('day')
        if day_str:
            day = parse_date(day_str)
            if day:
                qs = qs.filter(
                    registered_at__date=day
                )

    elif filter_type == 'range':
        date_from = params.get('date_from')
        date_to   = params.get('date_to')
        if date_from:
            d = parse_date(date_from)
            if d:
                qs = qs.filter(registered_at__date__gte=d)
        if date_to:
            d = parse_date(date_to)
            if d:
                qs = qs.filter(registered_at__date__lte=d)

    return qs


def _paginate(data, params, default_size=20):
    """
    Simple list-level pagination.
    Returns (page_data, total, page, page_size, total_pages).
    Supports query params: page (default 1), page_size (default 20, max 100).
    """
    try:
        page      = max(1, int(params.get('page', 1)))
        page_size = min(100, max(1, int(params.get('page_size', default_size))))
    except (ValueError, TypeError):
        page, page_size = 1, default_size

    total       = len(data)
    total_pages = max(1, -(-total // page_size))   # ceiling division
    start       = (page - 1) * page_size
    end         = start + page_size
    return data[start:end], total, page, page_size, total_pages


class SupervisorStudentReportView(APIView):
    """
    GET /api/supervisors/<id>/report/
    تقرير الطلاب المسجّلين تحت مشرفة معينة مع فلترة زمنية.

    Query params:
      filter_type: monthly | yearly | day | range (default: all)
      year, month, day, date_from, date_to
    """

    permission_classes = [IsAdminOrManager]

    def get(self, request, pk):
        try:
            supervisor = Supervisor.objects.get(pk=pk)
        except Supervisor.DoesNotExist:
            return Response(
                {"detail": _("المشرفة غير موجودة.")},
                status=status.HTTP_404_NOT_FOUND,
            )

        students = supervisor.students.select_related(
            "user", "enrolled_grade", "enrolled_grade__level"
        ).order_by("registered_at")

        students = _apply_date_filters(students, request.query_params)

        data = [
            {
                "student_name":   s.user.full_name,
                "phone":          s.user.phone or "—",
                "enrolled_grade": str(s.enrolled_grade) if s.enrolled_grade else "—",
                "enrolled_grade_level": str(s.enrolled_grade.level) if s.enrolled_grade and s.enrolled_grade.level else "—",
                "system_type":    s.get_system_type_display(),
                "registered_at":  s.registered_at.strftime("%Y-%m-%d"),
                "supervisor_name": supervisor.name,
            }
            for s in students
        ]

        page_data, total, page, page_size, total_pages = _paginate(data, request.query_params)

        return Response(
            {
                "supervisor": SupervisorSerializer(supervisor).data,
                "students":   page_data,
                "total":      total,
                "page":       page,
                "page_size":  page_size,
                "total_pages": total_pages,
            }
        )


class AllSupervisorsReportView(APIView):
    """
    GET /api/supervisors/report/all/
    تقرير شامل لجميع الطلاب المسجّلين تحت جميع المشرفات مع فلترة زمنية.
    """

    permission_classes = [IsAdminOrManager]

    def get(self, request):
        students = StudentProfile.objects.select_related(
            "user", "supervisor", "enrolled_grade", "enrolled_grade__level"
        ).filter(supervisor__isnull=False).order_by("supervisor__name", "registered_at")

        students = _apply_date_filters(students, request.query_params)

        # Optional: filter by supervisor
        supervisor_id = request.query_params.get('supervisor')
        if supervisor_id:
            students = students.filter(supervisor_id=supervisor_id)

        data = [
            {
                "student_name":   s.user.full_name,
                "phone":          s.user.phone or "—",
                "enrolled_grade": str(s.enrolled_grade) if s.enrolled_grade else "—",
                "enrolled_grade_level": str(s.enrolled_grade.level) if s.enrolled_grade and s.enrolled_grade.level else "—",
                "system_type":    s.get_system_type_display(),
                "registered_at":  s.registered_at.strftime("%Y-%m-%d"),
                "supervisor_name": s.supervisor.name,
                "supervisor_id":   s.supervisor.id,
            }
            for s in students
        ]

        # Per-supervisor summary computed over FULL result set (before pagination)
        summary = {}
        for row in data:
            sid = row["supervisor_id"]
            if sid not in summary:
                summary[sid] = {"name": row["supervisor_name"], "count": 0}
            summary[sid]["count"] += 1

        page_data, total, page, page_size, total_pages = _paginate(data, request.query_params)

        return Response(
            {
                "students":    page_data,
                "total":       total,
                "page":        page,
                "page_size":   page_size,
                "total_pages": total_pages,
                "summary":     list(summary.values()),
            }
        )


# ─────────────────────────────────────────────────────────────────────────────
# 9. طلبات تسجيل الطلاب (من النافذة العامة)
# ─────────────────────────────────────────────────────────────────────────────

class PublicStudentRequestCreateView(generics.CreateAPIView):
    """POST /api/student-requests/public/ — تقديم طلب جديد من الزوار"""
    permission_classes = [AllowAny]
    serializer_class = StudentRequestSerializer


class AdminStudentRequestListView(generics.ListAPIView):
    """GET /api/student-requests/ — للمديرين لعرض الطلبات مع الفلترة والبحث"""
    permission_classes = [IsAdminOrManager]
    serializer_class = StudentRequestSerializer

    def get_queryset(self):
        qs = StudentRequest.objects.all().order_by("-submitted_at")
        params = self.request.query_params

        # Search by student name or guardian phone
        search = params.get('search')
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(student_name__icontains=search) |
                Q(guardian_phone__icontains=search)
            )

        # Filter by status
        status_filter = params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        # Filter by date (simple date exact match or range can be added, let's do exact day or date_from/date_to)
        date_from = params.get('date_from')
        date_to = params.get('date_to')
        from django.utils.dateparse import parse_date
        
        if date_from:
            d = parse_date(date_from)
            if d:
                qs = qs.filter(submitted_at__date__gte=d)
        if date_to:
            d = parse_date(date_to)
            if d:
                qs = qs.filter(submitted_at__date__lte=d)
                
        date_exact = params.get('date')
        if date_exact:
            d = parse_date(date_exact)
            if d:
                qs = qs.filter(submitted_at__date=d)

        return qs


class AdminStudentRequestDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET / PATCH / DELETE /api/student-requests/<id>/ — إدارة طلب محدد"""
    permission_classes = [IsAdminOrManager]
    queryset = StudentRequest.objects.all()
    serializer_class = StudentRequestSerializer

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


# ─────────────────────────────────────────────────────────────────────────────
# 10. طلبات التسجيل الجديدة (NewStudentRegistration)
# ─────────────────────────────────────────────────────────────────────────────

class PublicNewRegistrationCreateView(generics.CreateAPIView):
    """POST /api/student-registration/public/ — تقديم طلب تسجيل جديد من الزوار"""
    permission_classes = [AllowAny]
    serializer_class = NewStudentRegistrationSerializer


class AdminNewRegistrationListView(generics.ListAPIView):
    """GET /api/student-registration/ — قائمة طلبات التسجيل الجديدة للإدارة"""
    permission_classes = [IsAdminOrManager]
    serializer_class = NewStudentRegistrationSerializer

    def get_queryset(self):
        qs = NewStudentRegistration.objects.select_related("supervisor").order_by("-submitted_at")
        params = self.request.query_params

        search = params.get('search')
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(student_full_name__icontains=search) |
                Q(national_id__icontains=search) |
                Q(guardian_phone__icontains=search) |
                Q(guardian_name__icontains=search)
            )

        status_filter = params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        level_filter = params.get('level')
        if level_filter:
            qs = qs.filter(level=level_filter)

        grade_filter = params.get('grade')
        if grade_filter:
            qs = qs.filter(grade=grade_filter)

        gender_filter = params.get('gender')
        if gender_filter:
            qs = qs.filter(gender=gender_filter)

        date_exact = params.get('date')
        if date_exact:
            from django.utils.dateparse import parse_date
            d = parse_date(date_exact)
            if d:
                qs = qs.filter(submitted_at__date=d)

        return qs


class AdminNewRegistrationDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET / PATCH / DELETE /api/student-registration/<id>/ — إدارة طلب محدد"""
    permission_classes = [IsAdminOrManager]
    queryset = NewStudentRegistration.objects.select_related("supervisor")
    serializer_class = NewStudentRegistrationSerializer

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


# ─────────────────────────────────────────────────────────────────────────────
# 11. شروط التسجيل (RegistrationCondition)
# ─────────────────────────────────────────────────────────────────────────────

class PublicRegistrationConditionsView(generics.ListAPIView):
    """GET /api/registration-conditions/public/ — شروط التسجيل النشطة (للزوار)"""
    permission_classes = [AllowAny]
    serializer_class = RegistrationConditionSerializer
    queryset = RegistrationCondition.objects.filter(is_active=True).order_by("display_order")


class AdminRegistrationConditionsListCreateView(generics.ListCreateAPIView):
    """GET / POST /api/registration-conditions/ — إدارة شروط التسجيل"""
    permission_classes = [IsAdminOrManager]
    serializer_class = RegistrationConditionSerializer
    queryset = RegistrationCondition.objects.all().order_by("display_order")


class AdminRegistrationConditionDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET / PATCH / DELETE /api/registration-conditions/<id>/ — إدارة شرط محدد"""
    permission_classes = [IsAdminOrManager]
    queryset = RegistrationCondition.objects.all()
    serializer_class = RegistrationConditionSerializer

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


class PublicSupervisorMiniListView(generics.ListAPIView):
    """GET /api/supervisors/public/ — قائمة أسماء المشرفات للزوار"""
    permission_classes = [AllowAny]

    class MiniSupervisorSerializer(SupervisorSerializer):
        class Meta(SupervisorSerializer.Meta):
            fields = ["id", "name"]
            read_only_fields = ["id", "name"]

    serializer_class = MiniSupervisorSerializer
    queryset = Supervisor.objects.filter(is_active=True).order_by("name")


# ─────────────────────────────────────────────────────────────────────────────
# 12. إدارة مشرفي المحاضرات (Lecture Supervisors)
# ─────────────────────────────────────────────────────────────────────────────

class LectureSupervisorListCreateView(generics.ListCreateAPIView):
    """GET /api/lecture-supervisors/ | POST /api/lecture-supervisors/ — المدير فقط"""

    permission_classes = [IsAdminOrManager]
    queryset = LectureSupervisorProfile.objects.select_related("user").prefetch_related(
        "assigned_courses", "assigned_courses__grade", "assigned_courses__grade__level"
    ).order_by("-created_at")

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        search = params.get("search")
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(user__full_name__icontains=search) |
                Q(user__username__icontains=search) |
                Q(user__email__icontains=search)
            )

        is_active = params.get("is_active")
        if is_active is not None:
            qs = qs.filter(user__is_active=(is_active.lower() == "true"))

        return qs

    def get_serializer_class(self):
        if self.request.method == "POST":
            return LectureSupervisorCreateSerializer
        return LectureSupervisorProfileSerializer

    def create(self, request, *args, **kwargs):
        serializer = LectureSupervisorCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user    = serializer.save()
        profile = user.lecture_supervisor_profile
        return Response(
            LectureSupervisorProfileSerializer(profile).data,
            status=status.HTTP_201_CREATED,
        )


class LectureSupervisorDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET / PATCH / DELETE /api/lecture-supervisors/<id>/ — المدير فقط"""

    permission_classes = [IsAdminOrManager]
    queryset = LectureSupervisorProfile.objects.select_related("user").prefetch_related(
        "assigned_courses", "assigned_courses__grade"
    )
    serializer_class = LectureSupervisorProfileSerializer

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        partial  = kwargs.pop("partial", False)
        instance = self.get_object()

        # تحديث بيانات المستخدم nested
        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        user_data = data.pop("user", None)
        if user_data:
            user_ser = UserDetailSerializer(
                instance.user, data=user_data, partial=True
            )
            user_ser.is_valid(raise_exception=True)
            user_ser.save()

        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        instance.refresh_from_db()
        return Response(LectureSupervisorProfileSerializer(instance).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        user = instance.user
        instance.delete()
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class LectureSupervisorMeView(APIView):
    """GET/PATCH /api/lecture-supervisors/me/ — الملف الشخصي للمشرف المسجّل دخوله"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != CustomUser.Roles.LECTURE_SUPERVISOR:
            return Response(
                {"detail": _("هذا المسار مخصص لمشرفي المحاضرات فقط.")},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            profile = request.user.lecture_supervisor_profile
        except LectureSupervisorProfile.DoesNotExist:
            return Response(
                {"detail": _("الملف الشخصي غير موجود.")},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(LectureSupervisorProfileSerializer(profile).data)

    def patch(self, request):
        """مشرف الكورسات لا يمكنه تعديل بياناته بنفسه. فقط المدير يستطيع تحديثها."""
        if request.user.role != CustomUser.Roles.LECTURE_SUPERVISOR:
            return Response(
                {"detail": _("\u063a\u064a\u0631 \u0645\u0635\u0631\u062d \u0628\u0647\u0630\u0627 \u0627\u0644\u0625\u062c\u0631\u0627\u0621.")},
                status=status.HTTP_403_FORBIDDEN,
            )
        # Block self-editing for Courses Supervisors
        return Response(
            {"detail": _("لا يمكنك تعديل بياناتك الشخصية. تواصل مع مدير النظام لتعديل بياناتك.")},
            status=status.HTTP_403_FORBIDDEN,
        )


class LectureSupervisorToggleActiveView(APIView):
    """POST /api/lecture-supervisors/<id>/toggle-active/ — تفعيل أو تعطيل حساب مشرف"""

    permission_classes = [IsAdminOrManager]

    def post(self, request, pk):
        try:
            profile = LectureSupervisorProfile.objects.select_related("user").get(pk=pk)
        except LectureSupervisorProfile.DoesNotExist:
            return Response(
                {"detail": _("مشرف المحاضرات غير موجود.")},
                status=status.HTTP_404_NOT_FOUND,
            )
        user = profile.user
        user.is_active = not user.is_active
        user.save(update_fields=["is_active"])
        return Response({
            "detail": _("تم تفعيل الحساب.") if user.is_active else _("تم تعطيل الحساب."),
            "is_active": user.is_active,
        })
