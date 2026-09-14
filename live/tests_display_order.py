"""
================================================================================
live/tests_display_order.py
================================================================================
ترتيب غرف البث وجلساتها بيد المدير.

كانت الغرف والجلسات تُعرض بالأحدث أولاً بلا تحكّم. أُضيف display_order على
نسق المراحل والفصول والكورسات: الأصغر أعلى، والتعادل بالاسم. يسري الترتيب في
قوائم المدير وفي ما يراه الطالب على السواء، وفي الجلسات داخل كل غرفة.
================================================================================
"""

from django.test import TestCase
from rest_framework.test import APIClient

from academic.models import Grade, Level
from accounts.models import CustomUser, StudentProfile
from live.models import LiveRoom, LiveSession


def _admin():
    return CustomUser.objects.create_user(
        username="admin_order", password="pass12345",
        full_name="مدير", role=CustomUser.Roles.ADMIN,
    )


def _student(grade):
    user = CustomUser.objects.create_user(
        username="s_order", password="pass12345",
        full_name="طالب", role=CustomUser.Roles.STUDENT,
    )
    return StudentProfile.objects.create(
        user=user, system_type="online", enrolled_grade=grade,
    )


def _room(name, order, grade=None):
    return LiveRoom.objects.create(
        room_name=name, room_type="online", grade=grade, display_order=order,
    )


def _session(room, name, order):
    return LiveSession.objects.create(
        room=room, session_name=name, display_order=order,
        stream_url="https://example.com/live",
    )


class DisplayOrderTests(TestCase):

    def setUp(self):
        level = Level.objects.create(name="ثانوي أونلاين", system_type="online")
        self.grade = Grade.objects.create(level=level, name="الصف الأول", system_type="online")

        # أُنشئت بترتيب الإنشاء ج، ب، أ — فلو بقي "الأحدث أولاً" لظهرت أ، ب، ج.
        # display_order يقلبها: ب (1)، ثم أ (2)، ثم ج (3).
        self.room_c = _room("غرفة ج", 3, self.grade)
        self.room_b = _room("غرفة ب", 1, self.grade)
        self.room_a = _room("غرفة أ", 2, self.grade)

        # الجلسات داخل غرفة واحدة، أُنشئت بترتيب 3، 1، 2.
        _session(self.room_b, "جلسة ثالثة", 3)
        _session(self.room_b, "جلسة أولى",  1)
        _session(self.room_b, "جلسة ثانية", 2)

    def test_admin_room_list_follows_display_order(self):
        client = APIClient()
        client.force_authenticate(_admin())
        res = client.get("/api/live/rooms/")
        self.assertEqual(res.status_code, 200, res.content)
        names = [r["room_name"] for r in res.json()["results"]]
        self.assertEqual(names, ["غرفة ب", "غرفة أ", "غرفة ج"])

    def test_student_rooms_follow_display_order(self):
        client = APIClient()
        client.force_authenticate(_student(self.grade).user)
        res = client.get("/api/live/my-sessions/")
        self.assertEqual(res.status_code, 200, res.content)
        names = [r["room_name"] for r in res.json()]
        self.assertEqual(names, ["غرفة ب", "غرفة أ", "غرفة ج"])

    def test_sessions_inside_room_follow_display_order_for_student(self):
        client = APIClient()
        client.force_authenticate(_student(self.grade).user)
        res = client.get("/api/live/my-sessions/")
        room_b = next(r for r in res.json() if r["room_name"] == "غرفة ب")
        names = [s["session_name"] for s in room_b["sessions"]]
        self.assertEqual(names, ["جلسة أولى", "جلسة ثانية", "جلسة ثالثة"])

    def test_sessions_inside_room_follow_display_order_for_admin(self):
        client = APIClient()
        client.force_authenticate(_admin())
        res = client.get(f"/api/live/rooms/{self.room_b.pk}/sessions/")
        self.assertEqual(res.status_code, 200, res.content)
        names = [s["session_name"] for s in res.json()["results"]]
        self.assertEqual(names, ["جلسة أولى", "جلسة ثانية", "جلسة ثالثة"])

    def test_ties_fall_back_to_name(self):
        """كل الغرف القائمة ستكون 0 بعد الهجرة؛ التعادل يُحسم بالاسم لا عشوائياً."""
        LiveRoom.objects.update(display_order=0)
        client = APIClient()
        client.force_authenticate(_admin())
        names = [r["room_name"] for r in client.get("/api/live/rooms/").json()["results"]]
        self.assertEqual(names, sorted(names))

    def test_admin_can_set_order_on_room_and_session(self):
        client = APIClient()
        client.force_authenticate(_admin())

        res = client.patch(f"/api/live/rooms/{self.room_c.pk}/", {"display_order": 0}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()["display_order"], 0)
        names = [r["room_name"] for r in client.get("/api/live/rooms/").json()["results"]]
        self.assertEqual(names[0], "غرفة ج")

        session = self.room_b.sessions.get(session_name="جلسة ثالثة")
        res = client.patch(
            f"/api/live/rooms/{self.room_b.pk}/sessions/{session.pk}/",
            {"display_order": 0}, format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        names = [s["session_name"] for s in
                 client.get(f"/api/live/rooms/{self.room_b.pk}/sessions/").json()["results"]]
        self.assertEqual(names[0], "جلسة ثالثة")

    def test_display_order_defaults_to_zero(self):
        client = APIClient()
        client.force_authenticate(_admin())
        res = client.post("/api/live/rooms/", {"room_name": "بلا ترتيب", "room_type": "online"}, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.json()["display_order"], 0)
