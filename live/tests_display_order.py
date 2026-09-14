"""
================================================================================
live/tests_display_order.py
================================================================================
ترتيب غرف البث وجلساتها بيد المدير.

القاعدتان: الأعلى رقماً أولاً، ولا تتشارك غرفتان رقماً (ولا جلستان داخل
غرفة). الجديد بلا رقم يأخذ الأعلى+1 فيظهر أولاً، والتكرار يُرفض برسالة تسمّي
صاحب الرقم. يسري في قوائم المدير وما يراه الطالب وجلسات كل غرفة.
================================================================================
"""

from django.db import IntegrityError, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase
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

        # أُنشئت بترتيب ج، ب، أ. الأعلى رقماً أولاً: ج (3)، ثم أ (2)، ثم ب (1).
        self.room_c = _room("غرفة ج", 3, self.grade)
        self.room_b = _room("غرفة ب", 1, self.grade)
        self.room_a = _room("غرفة أ", 2, self.grade)

        _session(self.room_c, "جلسة ثالثة", 3)
        _session(self.room_c, "جلسة أولى",  1)
        _session(self.room_c, "جلسة ثانية", 2)

        self.admin = APIClient()
        self.admin.force_authenticate(_admin())

    def _admin_rooms(self):
        return [r["room_name"] for r in self.admin.get("/api/live/rooms/").json()["results"]]

    def _admin_sessions(self, room):
        res = self.admin.get(f"/api/live/rooms/{room.pk}/sessions/")
        return [s["session_name"] for s in res.json()["results"]]

    # ── الأعلى أولاً ──────────────────────────────────────────────────────

    def test_admin_room_list_highest_first(self):
        self.assertEqual(self._admin_rooms(), ["غرفة ج", "غرفة أ", "غرفة ب"])

    def test_student_rooms_highest_first(self):
        client = APIClient()
        client.force_authenticate(_student(self.grade).user)
        res = client.get("/api/live/my-sessions/")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual([r["room_name"] for r in res.json()], ["غرفة ج", "غرفة أ", "غرفة ب"])

    def test_sessions_highest_first_for_student(self):
        client = APIClient()
        client.force_authenticate(_student(self.grade).user)
        room_c = next(r for r in client.get("/api/live/my-sessions/").json() if r["room_name"] == "غرفة ج")
        self.assertEqual([s["session_name"] for s in room_c["sessions"]],
                         ["جلسة ثالثة", "جلسة ثانية", "جلسة أولى"])

    def test_sessions_highest_first_for_admin(self):
        self.assertEqual(self._admin_sessions(self.room_c),
                         ["جلسة ثالثة", "جلسة ثانية", "جلسة أولى"])

    # ── الجديد يأخذ الأعلى+1 فيظهر أولاً ─────────────────────────────────

    def test_new_room_without_order_goes_to_top(self):
        res = self.admin.post("/api/live/rooms/", {"room_name": "غرفة جديدة", "room_type": "online"}, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.json()["display_order"], 4)
        self.assertEqual(self._admin_rooms()[0], "غرفة جديدة")

    def test_first_room_ever_gets_one(self):
        LiveRoom.objects.all().delete()
        res = self.admin.post("/api/live/rooms/", {"room_name": "الأولى", "room_type": "online"}, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.json()["display_order"], 1)

    def test_new_session_without_order_goes_to_top_of_its_room(self):
        res = self.admin.post(
            f"/api/live/rooms/{self.room_c.pk}/sessions/",
            {"session_name": "جلسة رابعة", "stream_url": "https://example.com/x"}, format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.json()["display_order"], 4)
        self.assertEqual(self._admin_sessions(self.room_c)[0], "جلسة رابعة")

        # الترقيم لكل غرفة على حدة: غرفة أخرى فارغة تبدأ من 1
        res = self.admin.post(
            f"/api/live/rooms/{self.room_a.pk}/sessions/",
            {"session_name": "أول جلسة هنا", "stream_url": "https://example.com/y"}, format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.json()["display_order"], 1)

    # ── لا تكرار ─────────────────────────────────────────────────────────

    def test_duplicate_room_order_is_rejected_naming_the_holder(self):
        res = self.admin.post(
            "/api/live/rooms/", {"room_name": "مكرّرة", "room_type": "online", "display_order": 2}, format="json",
        )
        self.assertEqual(res.status_code, 400, res.content)
        self.assertIn("غرفة أ", res.json()["display_order"][0])

        res = self.admin.patch(f"/api/live/rooms/{self.room_b.pk}/", {"display_order": 3}, format="json")
        self.assertEqual(res.status_code, 400, res.content)
        self.assertIn("غرفة ج", res.json()["display_order"][0])

    def test_keeping_own_order_on_update_is_fine(self):
        res = self.admin.patch(f"/api/live/rooms/{self.room_b.pk}/", {"display_order": 1, "room_name": "غرفة ب2"}, format="json")
        self.assertEqual(res.status_code, 200, res.content)

    def test_duplicate_session_order_in_same_room_is_rejected(self):
        res = self.admin.post(
            f"/api/live/rooms/{self.room_c.pk}/sessions/",
            {"session_name": "مكرّرة", "stream_url": "https://example.com/x", "display_order": 2}, format="json",
        )
        self.assertEqual(res.status_code, 400, res.content)
        self.assertIn("جلسة ثانية", res.json()["display_order"][0])

    def test_same_session_order_in_another_room_is_fine(self):
        res = self.admin.post(
            f"/api/live/rooms/{self.room_a.pk}/sessions/",
            {"session_name": "في غرفة أخرى", "stream_url": "https://example.com/x", "display_order": 2}, format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)

    def test_database_refuses_duplicates_too(self):
        """شبكة أمان تحت السيريالايزر: القيد على مستوى القاعدة."""
        with self.assertRaises(IntegrityError), transaction.atomic():
            _room("تكرار مباشر", 3)

    # ── تعديل الترتيب ────────────────────────────────────────────────────

    def test_admin_can_move_a_room_to_the_top(self):
        res = self.admin.patch(f"/api/live/rooms/{self.room_b.pk}/", {"display_order": 9}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(self._admin_rooms()[0], "غرفة ب")


class ExistingRowsNumberingTests(TransactionTestCase):
    """
    ترقيم الهجرة 0005 للقائم قبل فرض قيد التفرّد.

    يُحاكى وضع الإنتاج الفعلي الذي أسقط النشر: قيمٌ **غير صفرية مكرّرة**
    خلّفتها واجهة #10 (بلا تفرّد) إلى جانب الأصفار. تُشغَّل الهجرة على قاعدة
    عند 0004 ثم يُتحقَّق أن الناتج تسلسل فريد كثيف يحفظ الترتيب المرئي.
    """

    def _run_0004(self):
        executor = MigrationExecutor(connection)
        executor.migrate([("live", "0004_display_order")])
        state = executor.loader.project_state([("live", "0004_display_order")]).apps
        return state.get_model("live", "LiveRoom"), state.get_model("live", "LiveSession")

    def test_duplicate_nonzero_values_are_renumbered_uniquely(self):
        LiveRoom, LiveSession = self._run_0004()

        # الوضع الذي أسقط النشر: رقمان 1، وصفر، ثم رقم أكبر.
        LiveRoom.objects.create(room_name="أ", room_type="online", display_order=1)
        LiveRoom.objects.create(room_name="ب", room_type="online", display_order=1)
        LiveRoom.objects.create(room_name="ج", room_type="online", display_order=0)
        LiveRoom.objects.create(room_name="د", room_type="online", display_order=5)

        # الهجرة يجب ألا تُخفق على القيد المكرّر.
        MigrationExecutor(connection).migrate([("live", "0005_order_unique_desc")])

        from live.models import LiveRoom as Room
        orders = sorted(r.display_order for r in Room.objects.all())
        self.assertEqual(orders, [1, 2, 3, 4])  # فريد كثيف بلا فجوات

    def test_last_seen_order_is_preserved_under_descending(self):
        LiveRoom, LiveSession = self._run_0004()
        # تحت #10 التصاعدي: 0،0 تُرتَّب بالاسم فالأعلى «الأقدم» ثم «الأحدث»،
        # يليهما «يدوية» (7). الترتيب المرئي: الأقدم، الأحدث، يدوية.
        # تحت #10 التصاعدي، الصفران يُرتَّبان بالاسم: «الأحدث» قبل «الأقدم»
        # (ح < ق)، ثم «يدوية» (7). فالترتيب المرئي: الأحدث، الأقدم، يدوية.
        LiveRoom.objects.create(room_name="الأقدم", room_type="online", display_order=0)
        newer = LiveRoom.objects.create(room_name="الأحدث", room_type="online", display_order=0)
        LiveRoom.objects.create(room_name="يدوية",  room_type="online", display_order=7)
        LiveSession.objects.create(room=newer, session_name="ج1", stream_url="https://e.com/1", display_order=0)
        LiveSession.objects.create(room=newer, session_name="ج2", stream_url="https://e.com/2", display_order=0)

        MigrationExecutor(connection).migrate([("live", "0005_order_unique_desc")])

        from live.models import LiveRoom as Room, LiveSession as Session
        # الترتيب المرئي نفسه يبقى تحت التنازلي (أعلى رقم أولاً).
        self.assertEqual([r.room_name for r in Room.objects.all()], ["الأحدث", "الأقدم", "يدوية"])
        self.assertEqual({r.room_name: r.display_order for r in Room.objects.all()},
                         {"الأحدث": 3, "الأقدم": 2, "يدوية": 1})
        # جلسات الغرفة: تسلسل فريد كثيف داخلها (الترتيب الدقيق بين اسمين
        # متطابقي البادئة يتبع تنسيق القاعدة، فيُكتفى بالتفرّد والكثافة).
        session_orders = sorted(s.display_order for s in Session.objects.filter(room_id=newer.pk))
        self.assertEqual(session_orders, [1, 2])
