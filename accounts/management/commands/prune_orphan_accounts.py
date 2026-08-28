"""
================================================================================
accounts/management/commands/prune_orphan_accounts.py
================================================================================
حذف حسابات المستخدمين التي فقدت ملفها الشخصي.

كان حذف طالب أو أستاذ يزيل الملف الشخصي ويترك صف CustomUser قائماً، فيختفي
الشخص من كل القوائم بينما يبقى اسم المستخدم محجوزاً — ويُرفض تسجيله من جديد
بـ "اسم المستخدم مسجّل مسبقاً".

أُصلح مصدر العلة في DestroyWithUserMixin، لكن الصفوف التي خلّفها الكود القديم
تبقى في قاعدة البيانات. هذا الأمر ينظّفها.

    python manage.py prune_orphan_accounts            # عرض فقط، لا حذف
    python manage.py prune_orphan_accounts --delete   # التنفيذ الفعلي

الافتراضي عرض بلا حذف عمداً: هذا الأمر يمسّ حسابات مستخدمين.
================================================================================
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import CustomUser


#: الدور ← اسم العلاقة العكسية للملف الشخصي
PROFILE_RELATIONS = {
    CustomUser.Roles.STUDENT:            "student_profile",
    CustomUser.Roles.TEACHER:            "teacher_profile",
    CustomUser.Roles.LECTURE_SUPERVISOR: "lecture_supervisor_profile",
}


class Command(BaseCommand):
    help = "يعرض — أو يحذف — حسابات المستخدمين التي لا ملف شخصي لها."

    def add_arguments(self, parser):
        parser.add_argument(
            "--delete",
            action="store_true",
            help="نفّذ الحذف فعلياً. بدونه يعرض الأمر ما سيحذفه ولا يمسّ شيئاً.",
        )

    def handle(self, *args, **options):
        orphans = []
        for role, relation in PROFILE_RELATIONS.items():
            qs = CustomUser.objects.filter(role=role, **{f"{relation}__isnull": True})
            orphans.extend(qs.order_by("date_joined"))

        if not orphans:
            self.stdout.write(self.style.SUCCESS("لا توجد حسابات يتيمة."))
            return

        self.stdout.write(
            self.style.WARNING(f"وُجد {len(orphans)} حساباً بلا ملف شخصي:")
        )
        for user in orphans:
            joined = user.date_joined.strftime("%Y-%m-%d")
            self.stdout.write(
                f"  · {user.username:24} {user.get_role_display():18} "
                f"انضم {joined}  {user.full_name}"
            )

        if not options["delete"]:
            self.stdout.write("")
            self.stdout.write(
                "عرض فقط — لم يُحذف شيء. أعد التشغيل مع ‎--delete‎ للتنفيذ."
            )
            return

        with transaction.atomic():
            for user in orphans:
                user.delete()

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"حُذف {len(orphans)} حساباً. أسماء المستخدمين صارت متاحة."
            )
        )
