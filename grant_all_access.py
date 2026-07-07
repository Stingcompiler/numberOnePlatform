import os
import django

# Setup Django Environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model
from academic.models import Course, StudentCourseAccess
from accounts.models import StudentProfile

User = get_user_model()

def grant_all():
    print("Starting auto-granting course access to all seeded students...")
    
    students = StudentProfile.objects.all()
    courses = Course.objects.all()
    
    print(f"Found {students.count()} students and {courses.count()} courses.")
    
    count_created = 0
    count_exists = 0
    
    for student in students:
        grade = student.enrolled_grade
        if not grade:
            # If no grade, assign a random one from the matching system type
            from academic.models import Grade
            grade_pool = Grade.objects.filter(system_type=student.system_type)
            if grade_pool.exists():
                import random
                grade = random.choice(list(grade_pool))
                student.enrolled_grade = grade
                student.save()
                print(f"Assigned grade {grade.name} to {student.user.username}")
            else:
                continue

        # Get courses for this student's grade and system type
        student_courses = Course.objects.filter(
            grade=grade, 
            system_type=student.system_type, 
            is_active=True
        )
        
        for course in student_courses:
            access, created = StudentCourseAccess.objects.get_or_create(
                student=student,
                course=course,
                defaults={"granted_by": None, "is_active": True}
            )
            if created:
                count_created += 1
            else:
                count_exists += 1
                
    print(f"Done! Granted {count_created} new course accesses. ({count_exists} already existed).")

if __name__ == "__main__":
    grant_all()
