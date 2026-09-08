"""
create_review_account — إنشاء/تحديث حساب مراجعة متجر Google Play.

مراجعو Google يحتاجون حساباً للدخول واختبار التطبيق. حساب الطالب العادي لا
يصلح لسببين: الأول أن ربط الجهاز الواحد يمنع المراجع الثاني من الدخول، والثاني
أنه يكشف بيانات طالب حقيقي. لذا يُنشأ حساب مخصص ببيانات وهمية، ويُستثنى من
ربط الجهاز عبر متغيّر البيئة REVIEW_ACCOUNT_USERNAME.

الاستخدام على الخادم:
    python manage.py create_review_account --password "كلمة-مرور-قوية"

الأمر آمن للتكرار: إعادة تشغيله تُحدِّث الحساب القائم ولا تُنشئ نسخة ثانية.
بعد موافقة Google يُحذف الحساب ويُزال المتغيّر:
    python manage.py create_review_account --delete
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import CustomUser, StudentProfile


class Command(BaseCommand):
    help = "إنشاء أو تحديث حساب مراجعة متجر Google Play (بيانات وهمية، بلا ربط جهاز)."

    def add_arguments(self, parser):
        parser.add_argument("--username", default="play_reviewer",
                            help="اسم المستخدم (الافتراضي: play_reviewer)")
        parser.add_argument("--password", help="كلمة المرور — مطلوبة عند الإنشاء")
        parser.add_argument("--delete", action="store_true",
                            help="حذف الحساب بعد انتهاء المراجعة")

    @transaction.atomic
    def handle(self, *args, **opts):
        username = opts["username"]

        if opts["delete"]:
            deleted, _ = CustomUser.objects.filter(username=username).delete()
            if deleted:
                self.stdout.write(self.style.SUCCESS(f"تم حذف الحساب: {username}"))
                self.stdout.write("لا تنسَ إزالة REVIEW_ACCOUNT_USERNAME من متغيرات البيئة.")
            else:
                self.stdout.write(f"لا يوجد حساب بهذا الاسم: {username}")
            return

        if not opts["password"]:
            raise CommandError("--password مطلوبة. استخدم كلمة مرور قوية وسجّلها في نموذج App Access.")

        user = CustomUser.objects.filter(username=username).first()
        created = user is None
        if created:
            user = CustomUser.objects.create_user(
                username=username,
                password=opts["password"],
                role=CustomUser.Roles.STUDENT,
                full_name="Play Store Reviewer",
            )
        else:
            user.set_password(opts["password"])
            user.role = CustomUser.Roles.STUDENT
            user.is_active = True
            user.save()

        profile, _ = StudentProfile.objects.get_or_create(user=user)

        # نظام "أونلاين" يمنح الوصول لكل كورسات المرحلة تلقائياً، فلا حاجة
        # لإنشاء سجلات StudentCourseAccess يدوياً للمراجع.
        profile.system_type = "online"

        # اختيار المرحلة التي تحوي أكبر عدد من الكورسات النشطة، كي يرى المراجع
        # محتوى فعلياً لا شاشات فارغة (شاشة فارغة قد تُفسَّر كتطبيق معطّل).
        from academic.models import Course
        best, best_count = None, 0
        counts = {}
        for c in Course.objects.filter(is_active=True, system_type="online").select_related("grade"):
            if c.grade_id:
                counts[c.grade_id] = counts.get(c.grade_id, 0) + 1
        for grade_id, n in counts.items():
            if n > best_count:
                best, best_count = grade_id, n
        if best:
            profile.enrolled_grade_id = best

        # لا ربط بجهاز: الاستثناء يمنع الربط، ونُصفّره احتياطاً لو سبق ربطه
        profile.device_id = None
        profile.device_bound_at = None
        profile.save()

        self.stdout.write(self.style.SUCCESS(
            f"{'أُنشئ' if created else 'حُدِّث'} حساب المراجعة: {username}"
        ))
        self.stdout.write(f"  الدور        : student")
        self.stdout.write(f"  نوع النظام   : online")
        self.stdout.write(f"  المرحلة      : {profile.enrolled_grade or 'غير محددة'}")
        self.stdout.write(f"  كورسات مرئية : {best_count}")
        self.stdout.write(f"  مرتبط بجهاز  : لا")
        self.stdout.write("")
        if best_count == 0:
            self.stdout.write(self.style.WARNING(
                "تحذير: لا توجد كورسات online نشطة — سيرى المراجع شاشات فارغة."
            ))
        self.stdout.write(self.style.WARNING(
            f"الخطوة الأخيرة: اضبط REVIEW_ACCOUNT_USERNAME={username} في متغيرات البيئة، "
            "وإلا بقي الحساب خاضعاً لربط الجهاز."
        ))
