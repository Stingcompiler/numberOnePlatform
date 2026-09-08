"""
================================================================================
exams/tests_exam_save.py
================================================================================
حفظ الاختبار كان يرفع AttributeError.

‎notifications/signals.py‎ فيها ‎post_save‎ على Exam تقرأ ‎instance.is_published‎،
وهو حقل لا وجود له في Exam — الحقل الوحيد بهذا الاسم في المشروع يخصّ
‎store.App‎. الإشارة مسجّلة في ‎NotificationsConfig.ready()‎ فتعمل مع كل حفظ،
أي أن إنشاء أي اختبار أو تعديله كان يفشل بـ 500 في الإنتاج.

هذه الاختبارات تحرس الإصلاح، وتحرس أيضاً ألّا يعود التعديل على اختبار قديم
بإشعار "امتحان جديد" لطلاب الكورس.
================================================================================
"""

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import CustomUser, StudentProfile
from academic.models import Level, Grade, Course, StudentCourseAccess
from exams.models import Exam
from notifications.models import Notification


class ExamSaveTests(TestCase):

    def setUp(self):
        level = Level.objects.create(name="المرحلة الثانوية")
        self.grade = Grade.objects.create(level=level, name="الصف الثالث")
        self.course = Course.objects.create(
            grade=self.grade, name="الرياضيات", system_type="online",
        )

        student_user = CustomUser.objects.create_user(
            username="exam_student", password="pass12345",
            full_name="طالب", role=CustomUser.Roles.STUDENT,
        )
        self.student = StudentProfile.objects.create(
            user=student_user, system_type="online", enrolled_grade=self.grade,
        )
        StudentCourseAccess.objects.create(
            student=self.student, course=self.course, is_active=True,
        )

        self.admin = CustomUser.objects.create_user(
            username="exam_admin", password="pass12345",
            full_name="مدير", role=CustomUser.Roles.ADMIN,
        )
        self.admin_client = APIClient()
        self.admin_client.force_authenticate(user=self.admin)

    def test_creating_an_exam_does_not_raise(self):
        """الخلل الأصلي: كل ‎Exam.save()‎ كان يرفع AttributeError."""
        exam = Exam.objects.create(
            course=self.course, title="اختبار الجبر",
            duration_minutes=30, passing_score=3.0,
        )

        self.assertIsNotNone(exam.pk)

    def test_editing_an_exam_does_not_raise(self):
        exam = Exam.objects.create(
            course=self.course, title="اختبار", duration_minutes=30, passing_score=3.0,
        )

        exam.duration_minutes = 45
        exam.save()

        exam.refresh_from_db()
        self.assertEqual(exam.duration_minutes, 45)

    def test_creating_an_exam_through_the_api_succeeds(self):
        # ExamBatchCreateSerializer يُنشئ الاختبار وأسئلته دفعة واحدة، وسؤال
        # واحد على الأقل مطلوب.
        res = self.admin_client.post("/api/exams/create/", {
            "course": self.course.id,
            "title": "اختبار عبر الواجهة",
            "duration_minutes": 30,
            "passing_score": 3.0,
            "questions": [{
                "question_type": "true_false",
                "text": "المعادلة التربيعية لها حلان دائماً.",
                "marks": 1.0,
                "display_order": 1,
                "correct_answer": {"value": False},
            }],
        }, format="json")

        self.assertIn(res.status_code, (200, 201), res.data)

    def test_a_new_active_exam_notifies_the_students_of_its_course(self):
        Exam.objects.create(
            course=self.course, title="اختبار جديد",
            duration_minutes=30, passing_score=3.0, is_active=True,
        )

        self.assertTrue(
            Notification.objects.filter(
                student=self.student,
                notification_type=Notification.NotificationType.EXAM,
            ).exists()
        )

    def test_an_inactive_exam_notifies_nobody(self):
        Exam.objects.create(
            course=self.course, title="مسودة",
            duration_minutes=30, passing_score=3.0, is_active=False,
        )

        self.assertFalse(
            Notification.objects.filter(
                notification_type=Notification.NotificationType.EXAM,
            ).exists()
        )

    def test_editing_an_existing_exam_does_not_re_notify(self):
        """
        بدون شرط ‎created‎، أول تعديل على أي اختبار قديم بعد نشر الإصلاح كان
        سيرسل "امتحان جديد" لكل طلاب الكورس عن اختبار موجود منذ شهور.
        """
        exam = Exam.objects.create(
            course=self.course, title="اختبار", duration_minutes=30, passing_score=3.0,
        )
        Notification.objects.all().delete()

        exam.title = "اختبار معدّل"
        exam.save()

        self.assertEqual(
            Notification.objects.filter(
                notification_type=Notification.NotificationType.EXAM,
            ).count(),
            0,
        )
