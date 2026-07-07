import os
import django
import random
from django.utils import timezone

# Setup Django Environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model
from academic.models import Course
from accounts.models import StudentProfile
from exams.models import Exam, ExamQuestion, ExamQuestionOption, ExamAttempt, ExamAttemptAnswer

User = get_user_model()

def seed_exams():
    print("Cleaning old exams and attempts...")
    ExamAttemptAnswer.objects.all().delete()
    ExamAttempt.objects.all().delete()
    ExamQuestionOption.objects.all().delete()
    ExamQuestion.objects.all().delete()
    Exam.objects.all().delete()

    admin_user = User.objects.filter(role="admin").first()
    if not admin_user:
        admin_user = User.objects.first()

    courses = Course.objects.all()
    if not courses.exists():
        print("No courses found! Please run seed_data.py first.")
        return

    print(f"Seeding exams for {courses.count()} courses...")

    # We will seed exams for all courses
    for course in courses:
        # 1. Available Exam
        exam1 = Exam.objects.create(
            course=course,
            title=f"Exam 1: {course.name.split(' - ')[0]}",
            duration_minutes=30,
            passing_score=5.0,
            is_active=True,
            created_by=admin_user
        )
        
        # Add 3 questions to exam1
        q1 = ExamQuestion.objects.create(
            exam=exam1,
            question_type=ExamQuestion.QuestionType.MULTIPLE_CHOICE,
            text="Question 1?",
            marks=4.0,
            display_order=1
        )
        opt1_1 = ExamQuestionOption.objects.create(question=q1, text="Incorrect 1", display_order=1)
        opt1_2 = ExamQuestionOption.objects.create(question=q1, text="Incorrect 2", display_order=2)
        opt1_correct = ExamQuestionOption.objects.create(question=q1, text="Correct Option", display_order=3)
        q1.correct_answer = {"option_id": opt1_correct.id}
        q1.save()

        q2 = ExamQuestion.objects.create(
            exam=exam1,
            question_type=ExamQuestion.QuestionType.TRUE_FALSE,
            text="Question 2?",
            marks=3.0,
            display_order=2,
            correct_answer={"value": True}
        )

        q3 = ExamQuestion.objects.create(
            exam=exam1,
            question_type=ExamQuestion.QuestionType.FILL_BLANK,
            text="Question 3 _____",
            marks=3.0,
            display_order=3,
            correct_answer={"text": "correct"}
        )

        # 2. Completed Exam (for testing past results)
        exam2 = Exam.objects.create(
            course=course,
            title=f"Exam 2: {course.name.split(' - ')[0]}",
            duration_minutes=45,
            passing_score=6.0,
            is_active=True,
            created_by=admin_user
        )

        # Add 3 questions to exam2
        eq1 = ExamQuestion.objects.create(
            exam=exam2,
            question_type=ExamQuestion.QuestionType.MULTIPLE_CHOICE,
            text="Question 1?",
            marks=4.0,
            display_order=1
        )
        eopt1_1 = ExamQuestionOption.objects.create(question=eq1, text="Incorrect 1", display_order=1)
        eopt1_correct = ExamQuestionOption.objects.create(question=eq1, text="Correct Option", display_order=2)
        eopt1_2 = ExamQuestionOption.objects.create(question=eq1, text="Incorrect 2", display_order=3)
        eq1.correct_answer = {"option_id": eopt1_correct.id}
        eq1.save()

        eq2 = ExamQuestion.objects.create(
            exam=exam2,
            question_type=ExamQuestion.QuestionType.TRUE_FALSE,
            text="Question 2?",
            marks=3.0,
            display_order=2,
            correct_answer={"value": False}
        )

        eq3 = ExamQuestion.objects.create(
            exam=exam2,
            question_type=ExamQuestion.QuestionType.FILL_BLANK,
            text="Question 3 _____",
            marks=3.0,
            display_order=3,
            correct_answer={"text": "correct"}
        )

        # Create Attempt for exam2 for the online_student_1 and flash_student_1
        for student_username in ["online_student_1", "flash_student_1"]:
            try:
                student_user = User.objects.get(username=student_username)
                student_profile = student_user.student_profile
                
                # Create an attempt
                attempt = ExamAttempt.objects.create(
                    exam=exam2,
                    student=student_profile,
                    score=7.0, # 7 out of 10 (passed)
                    percentage=70.0,
                    is_passed=True,
                    started_at=timezone.now() - timezone.timedelta(minutes=45),
                    submitted_at=timezone.now() - timezone.timedelta(minutes=5)
                )

                # Create attempt answers
                # Q1: Correct
                ExamAttemptAnswer.objects.create(
                    attempt=attempt,
                    question=eq1,
                    student_answer={"option_id": eopt1_correct.id},
                    is_correct=True,
                    earned_marks=4.0
                )
                # Q2: Correct
                ExamAttemptAnswer.objects.create(
                    attempt=attempt,
                    question=eq2,
                    student_answer={"value": False},
                    is_correct=True,
                    earned_marks=3.0
                )
                # Q3: Incorrect
                ExamAttemptAnswer.objects.create(
                    attempt=attempt,
                    question=eq3,
                    student_answer={"text": "wrong"},
                    is_correct=False,
                    earned_marks=0.0
                )
                
            except User.DoesNotExist:
                pass

    print("Successfully seeded exams, questions, options, and sample student attempts!")

if __name__ == "__main__":
    seed_exams()
