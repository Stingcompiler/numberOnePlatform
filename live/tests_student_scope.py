"""
================================================================================
live/tests_student_scope.py
================================================================================
ما يراه الطالب من غرف البث — النظام والفصل معاً.

كان الفلتر بالنظام وحده (room_type)، فيرى طالب الصف الأول الأونلاين بثّ كل
الصفوف الأونلاين. أُضيف الفصل إلى الغرفة، والفلتر يشترط الاثنين. غرفة بلا
فصل بثّ عام لنظامها، تُرى من كل فصوله.

يحرس أيضاً حذف المواعيد: لا scheduled_start/scheduled_end في أي استجابة.
================================================================================
"""

from django.test import TestCase
from rest_framework.test import APIClient

from academic.models import Grade, Level
from accounts.models import CustomUser, StudentProfile
from live.models import LiveRoom, LiveSession


def _grade(level, name, system_type):
    return Grade.objects.create(level=level, name=name, system_type=system_type)


def _student(username, system_type, grade=None):
    user = CustomUser.objects.create_user(
        username=username, password="pass12345",
        full_name=f"طالب {username}", role=CustomUser.Roles.STUDENT,
    )
    return StudentProfile.objects.create(
        user=user, system_type=system_type, enrolled_grade=grade,
    )


def _room(name, room_type, grade=None, active=True):
    return LiveRoom.objects.create(
        room_name=name, room_type=room_type, grade=grade, is_active=active,
    )


class StudentLiveScopeTests(TestCase):

    def setUp(self):
        online = Level.objects.create(name="ثانوي أونلاين", system_type="online")
        flash  = Level.objects.create(name="ثانوي فلاش",   system_type="flash")
        self.g1     = _grade(online, "الصف الأول",  "online")
        self.g2     = _grade(online, "الصف الثاني", "online")
        self.gflash = _grade(flash,  "فلاش أ",      "flash")

        self.room_g1      = _room("بث الصف الأول",   "online", self.g1)
        self.room_g2      = _room("بث الصف الثاني",  "online", self.g2)
        self.room_general = _room("بث عام أونلاين",  "online", None)
        self.room_flash   = _room("بث فلاش",         "flash",  self.gflash)
        self.room_off     = _room("غرفة معطّلة",     "online", self.g1, active=False)

        self.student_g1 = _student("s_g1", "online", self.g1)

    def _rooms_for(self, profile):
        client = APIClient()
        client.force_authenticate(profile.user)
        res = client.get("/api/live/my-sessions/")
        self.assertEqual(res.status_code, 200, res.content)
        return {r["room_name"] for r in res.json()}

    def test_online_student_sees_own_grade_and_general_only(self):
        """طالب الصف الأول: غرفة فصله والغرفة العامة — لا الصف الثاني ولا الفلاش."""
        self.assertEqual(
            self._rooms_for(self.student_g1),
            {"بث الصف الأول", "بث عام أونلاين"},
        )

    def test_other_grade_room_is_hidden(self):
        """الثغرة الأصلية: كان يرى بثّ الصف الثاني."""
        self.assertNotIn("بث الصف الثاني", self._rooms_for(self.student_g1))

    def test_flash_room_is_hidden_from_online_student(self):
        self.assertNotIn("بث فلاش", self._rooms_for(self.student_g1))

    def test_inactive_room_is_hidden_even_in_own_grade(self):
        self.assertNotIn("غرفة معطّلة", self._rooms_for(self.student_g1))

    def test_online_student_without_grade_sees_general_only(self):
        """
        طالب أونلاين بلا فصل مسجّل: العام وحده. لا يُفتح له كل شيء ولا يُحجب
        عنه العام — نصف الطريق هو الصحيح حتى تُسجَّل مرحلته.
        """
        s = _student("s_nograde", "online", None)
        self.assertEqual(self._rooms_for(s), {"بث عام أونلاين"})

    def test_flash_student_sees_flash_grade_room_only(self):
        s = _student("s_flash", "flash", self.gflash)
        self.assertEqual(self._rooms_for(s), {"بث فلاش"})

    def test_grade_name_rides_with_room(self):
        client = APIClient()
        client.force_authenticate(self.student_g1.user)
        rooms = {r["room_name"]: r for r in client.get("/api/live/my-sessions/").json()}
        self.assertEqual(rooms["بث الصف الأول"]["grade_name"], "الصف الأول")
        self.assertIsNone(rooms["بث عام أونلاين"]["grade_name"])

    def test_no_schedule_fields_in_student_response(self):
        LiveSession.objects.create(
            room=self.room_g1, session_name="حصة", provider="zoom",
            stream_url="https://zoom.us/j/1", status="live",
        )
        client = APIClient()
        client.force_authenticate(self.student_g1.user)
        rooms = {r["room_name"]: r for r in client.get("/api/live/my-sessions/").json()}
        session = rooms["بث الصف الأول"]["sessions"][0]
        self.assertNotIn("scheduled_start", session)
        self.assertNotIn("scheduled_end",   session)
        self.assertEqual(session["status"], "live")


class AdminRoomGradeTests(TestCase):

    def setUp(self):
        online = Level.objects.create(name="ثانوي أونلاين", system_type="online")
        flash  = Level.objects.create(name="ثانوي فلاش",   system_type="flash")
        self.g_online = _grade(online, "الصف الأول", "online")
        self.g_flash  = _grade(flash,  "فلاش أ",     "flash")

        admin = CustomUser.objects.create_user(
            username="admin1", password="pass12345",
            full_name="مدير", role=CustomUser.Roles.ADMIN,
        )
        self.client = APIClient()
        self.client.force_authenticate(admin)

    def test_admin_can_create_room_with_grade(self):
        res = self.client.post("/api/live/rooms/", {
            "room_name": "بث الصف الأول", "room_type": "online",
            "grade": self.g_online.id,
        })
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.json()["grade"], self.g_online.id)
        self.assertEqual(res.json()["grade_name"], "الصف الأول")
        self.assertEqual(res.json()["level_name"], "ثانوي أونلاين")

    def test_admin_can_create_room_without_grade(self):
        """الغرفة العامة: فصل فارغ مقبول ويعني كل فصول النظام."""
        res = self.client.post("/api/live/rooms/", {
            "room_name": "بث عام", "room_type": "online",
        })
        self.assertEqual(res.status_code, 201, res.content)
        self.assertIsNone(res.json()["grade"])

    def test_grade_from_other_system_is_rejected(self):
        """غرفة أونلاين بفصل فلاش لا يراها أحد — تُرفض بدل أن تُحفظ صامتة."""
        res = self.client.post("/api/live/rooms/", {
            "room_name": "غرفة مختلطة", "room_type": "online",
            "grade": self.g_flash.id,
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn("grade", res.json())

    def test_changing_room_type_away_from_grade_system_is_rejected(self):
        """التحقق يقرأ الحقل غير المُرسَل من الكائن، فلا يُلتفّ عليه بـ PATCH."""
        room = _room("بث", "online", self.g_online)
        res = self.client.patch(f"/api/live/rooms/{room.id}/", {"room_type": "flash"})
        self.assertEqual(res.status_code, 400)
        self.assertIn("grade", res.json())

    def test_session_schedule_fields_are_gone(self):
        room = _room("بث", "online", self.g_online)
        res = self.client.post(f"/api/live/rooms/{room.id}/sessions/", {
            "room": room.id,
            "session_name": "حصة", "provider": "zoom",
            "stream_url": "https://zoom.us/j/1", "status": "upcoming",
            # عميل قديم ما يزال يرسلهما — يُتجاهلان لا يُرفضان
            "scheduled_start": "2026-01-01T10:00:00Z",
            "scheduled_end":   "2026-01-01T11:00:00Z",
        })
        self.assertEqual(res.status_code, 201, res.content)
        self.assertNotIn("scheduled_start", res.json())
        self.assertNotIn("scheduled_end",   res.json())
