"""
================================================================================
accounts/tests_registration_documents.py
================================================================================
مستندات طلب التسجيل السبعة.

student_id_image أُضيف إلى الموديل (وهو مطلوب) وإلى نموذج التسجيل العام،
ولم يُضَف إلى NewStudentRegistrationSerializer. وذلك السيريالايزر يخدم
الإنشاء والقراءة معاً، وDRF لا يقبل إلا ما تذكره Meta.fields — فكان
الملف يصل من المتصفح ثم يُهمَل بصمت.

لم تكن علة عرض: الرقم الوطني للطالب لم يُحفَظ قط منذ إضافة الحقل.

الاختبار الأول يقارن حقول الملفات في الموديل بحقول السيريالايزر، فأي
مستند يُضاف لاحقاً وينسى أحدهم توصيله يسقط الاختبار.
================================================================================
"""

import datetime
import io
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import CustomUser, NewStudentRegistration
from accounts.serializers import NewStudentRegistrationSerializer
from academic.models import Level, Grade

#: أسماء حقول المستندات كما هي في الموديل
DOCUMENT_FIELDS = [
    "academic_result_image",
    "birth_certificate_image",
    "personal_photo",
    "student_id_image",
    "father_id_image",
    "mother_id_image",
    "payment_receipt_image",
]

_TEST_MEDIA = tempfile.mkdtemp(prefix="reg-docs-")


def _image(name):
    """صورة PNG صالحة — Pillow يرفض البايتات العشوائية."""
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (8, 8), "red").save(buf, "PNG")
    buf.seek(0)
    return SimpleUploadedFile(name, buf.read(), content_type="image/png")


@override_settings(MEDIA_ROOT=_TEST_MEDIA)
class RegistrationDocumentsTests(TestCase):

    def setUp(self):
        self.level = Level.objects.create(name="المرحلة الثانوية")
        self.grade = Grade.objects.create(level=self.level, name="الصف الثالث")

    def _payload(self, **overrides):
        data = {
            "student_full_name": "طالب اختبار",
            "national_id": "1234567890",
            "level": self.level.id,
            "grade": self.grade.id,
            "gender": "male",
            "student_status": "new_year",
            "residence": "الخرطوم",
            "date_of_birth": datetime.date(2008, 1, 1),
            "guardian_name": "ولي الأمر",
            "guardian_phone": "0900000000",
            "guardian_residence": "الخرطوم",
            "mother_full_name": "اسم الأم",
        }
        data.update({f: _image(f"{f}.png") for f in DOCUMENT_FIELDS})
        data.update(overrides)
        return data

    # ── الحارس الأهم ─────────────────────────────────────────────────────

    def test_serializer_carries_every_document_field_on_the_model(self):
        """
        أي مستند يُضاف للموديل ولا يُوصَّل بالسيريالايزر يسقط هنا، بدل أن
        يُكتشَف بعد أشهر من رفع الطلاب لملفات تُرمى.
        """
        model_files = {
            f.name for f in NewStudentRegistration._meta.get_fields()
            if getattr(f, "get_internal_type", lambda: "")() in ("ImageField", "FileField")
        }
        serializer_fields = set(NewStudentRegistrationSerializer().fields)

        missing = model_files - serializer_fields
        self.assertEqual(
            missing, set(),
            f"حقول مستندات في الموديل لا يعرفها السيريالايزر: {missing}",
        )

    def test_all_seven_documents_are_saved(self):
        serializer = NewStudentRegistrationSerializer(data=self._payload())
        self.assertTrue(serializer.is_valid(), serializer.errors)

        obj = serializer.save()
        for field in DOCUMENT_FIELDS:
            with self.subTest(field=field):
                self.assertTrue(
                    getattr(obj, field),
                    f"{field} لم يُحفَظ رغم إرساله",
                )

    def test_student_id_is_required_like_the_form_says(self):
        """النموذج العام يعلّمه مطلوباً؛ لا يجوز أن يقبله الخادم فارغاً."""
        payload = self._payload()
        payload.pop("student_id_image")

        serializer = NewStudentRegistrationSerializer(data=payload)
        self.assertFalse(serializer.is_valid())
        self.assertIn("student_id_image", serializer.errors)

    # ── عبر الـ API ──────────────────────────────────────────────────────

    def test_public_submission_stores_the_student_id(self):
        res = APIClient().post(
            "/api/student-registration/public/", self._payload(), format="multipart",
        )
        self.assertEqual(res.status_code, 201, res.data)

        obj = NewStudentRegistration.objects.get(pk=res.data["id"])
        self.assertTrue(obj.student_id_image, "الرقم الوطني للطالب ضاع في الرحلة")

    def test_admin_detail_returns_all_seven(self):
        """الإدارة لا تستطيع مراجعة مستند لا يصلها."""
        obj = NewStudentRegistrationSerializer(data=self._payload())
        obj.is_valid(raise_exception=True)
        obj = obj.save()

        admin = CustomUser.objects.create_user(
            username="doc_admin", password="pass12345",
            full_name="مدير", role=CustomUser.Roles.ADMIN,
        )
        client = APIClient()
        client.force_authenticate(user=admin)

        res = client.get(f"/api/student-registration/{obj.pk}/")
        self.assertEqual(res.status_code, 200)

        for field in DOCUMENT_FIELDS:
            with self.subTest(field=field):
                self.assertIn(field, res.data)
                self.assertTrue(res.data[field], f"{field} فارغ في استجابة الإدارة")

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        import shutil
        shutil.rmtree(_TEST_MEDIA, ignore_errors=True)


@override_settings(MEDIA_ROOT=_TEST_MEDIA)
class MissingDocumentReportingTests(TestCase):
    """
    الطلبات المقدَّمة قبل إضافة student_id_image لا تحتويه، وصفحة المراجعة كانت
    تُخفي البطاقة الغائبة تماماً — فيرى المراجع ستّ بطاقات ولا شيء يدلّه على أن
    سابعاً ناقص. الخادم صار يُبلّغ عن الناقص بدل أن يصمت عنه.
    """

    def setUp(self):
        self.level = Level.objects.create(name="المرحلة الثانوية")
        self.grade = Grade.objects.create(level=self.level, name="الصف الثالث")

    def _registration(self, **files):
        return NewStudentRegistration.objects.create(
            student_full_name="طالب",
            national_id="1234567890",
            level=self.level,
            grade=self.grade,
            gender="male",
            student_status="new_year",
            residence="الخرطوم",
            date_of_birth=datetime.date(2008, 1, 1),
            guardian_name="ولي الأمر",
            guardian_phone="0900000000",
            guardian_residence="الخرطوم",
            mother_full_name="اسم الأم",
            **files,
        )

    def test_a_complete_request_reports_nothing_missing(self):
        registration = self._registration(**{
            f: _image(f"{f}.png") for f in DOCUMENT_FIELDS
        })

        self.assertEqual(registration.missing_documents(), [])

    def test_a_legacy_request_reports_the_document_it_never_had(self):
        """هذا هو الطلب الذي كان يُعرَض بستّ بطاقات فقط."""
        registration = self._registration(**{
            f: _image(f"{f}.png")
            for f in DOCUMENT_FIELDS if f != "student_id_image"
        })

        missing = registration.missing_documents()

        self.assertEqual([d["field"] for d in missing], ["student_id_image"])
        self.assertTrue(missing[0]["label"])

    def test_a_missing_payment_receipt_is_reported_like_any_other_document(self):
        """
        كان إشعار السداد وحده اختيارياً بين السبعة، فيمرّ الطلب بدونه ولا يُبلَّغ
        المراجع. صار إلزامياً كبقيتها.
        """
        registration = self._registration(**{
            f: _image(f"{f}.png")
            for f in DOCUMENT_FIELDS if f != "payment_receipt_image"
        })

        missing = registration.missing_documents()

        self.assertEqual([d["field"] for d in missing], ["payment_receipt_image"])

    def test_the_serializer_exposes_the_missing_list_to_the_review_page(self):
        registration = self._registration(**{
            f: _image(f"{f}.png")
            for f in DOCUMENT_FIELDS if f != "father_id_image"
        })

        data = NewStudentRegistrationSerializer(registration).data

        self.assertIn("missing_documents", data)
        self.assertEqual(
            [d["field"] for d in data["missing_documents"]], ["father_id_image"],
        )

    def test_the_required_flags_are_read_from_the_model_not_a_second_list(self):
        """
        قائمة مكرّرة يدوياً هي بالضبط ما جعل student_id_image يسقط. الحقول
        الإلزامية تُشتَقّ من ‎blank‎ في الموديل.
        """
        required = {name for name, _, is_required in
                    NewStudentRegistration.document_fields() if is_required}

        self.assertEqual(required, set(DOCUMENT_FIELDS))

    def test_a_submission_without_the_receipt_is_rejected(self):
        """الشرط يسري على الإرسال أيضاً، لا على تقرير النقص وحده."""
        payload = {
            "student_full_name": "طالب",
            "national_id": "1234567890",
            "level": self.level.id,
            "grade": self.grade.id,
            "gender": "male",
            "student_status": "new_year",
            "residence": "الخرطوم",
            "date_of_birth": datetime.date(2008, 1, 1),
            "guardian_name": "ولي الأمر",
            "guardian_phone": "0900000000",
            "guardian_residence": "الخرطوم",
            "mother_full_name": "اسم الأم",
        }
        payload.update({
            f: _image(f"{f}.png")
            for f in DOCUMENT_FIELDS if f != "payment_receipt_image"
        })

        serializer = NewStudentRegistrationSerializer(data=payload)

        self.assertFalse(serializer.is_valid())
        self.assertIn("payment_receipt_image", serializer.errors)
