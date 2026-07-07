import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model
from academic.models import Course, StudentCourseAccess
from accounts.models import StudentProfile

User = get_user_model()

def grant_access():
    print("🔑 Seeding course access for online_student_1...")
    try:
        student_user = User.objects.get(username="online_student_1")
        student_profile = student_user.student_profile
        grade = student_profile.enrolled_grade
        
        if not grade:
            print("❌ online_student_1 has no enrolled grade assigned. Run fix_students.py first.")
            return

        courses = Course.objects.filter(grade=grade, is_active=True, system_type="online")
        if not courses.exists():
            print(f"⚠️ No online courses found for grade {grade.name}.")
            return
            
        for course in courses:
            access, created = StudentCourseAccess.objects.get_or_create(
                student=student_profile,
                course=course,
                defaults={"granted_by": None, "is_active": True}
            )
            if created:
                print(f"✅ Granted access to course: {course.name}")
            else:
                print(f"ℹ️ Access already exists for course: {course.name}")
        
        print("🎉 Successfully seeded access records for local testing!")
    except User.DoesNotExist:
        print("❌ online_student_1 user not found in the database. Please run seed_data.py first.")

if __name__ == "__main__":
    grant_access()
