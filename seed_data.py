import os
import django
import random
from datetime import timedelta
from django.utils import timezone

# Setup Django Environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth.models import Group
from django.contrib.auth import get_user_model
from accounts.models import StudentProfile, Supervisor, TeacherProfile
from academic.models import Level, Grade, Course, Unit, Lesson, Exercise, Question, Choice, Submission, SubmissionAnswer
from site_settings.models import Announcement, ContactTool, SiteSettings

User = get_user_model()

def run_seed():
    print("🧹 Cleaning old random data (Optional, skipping clean to preserve admin accounts)...")
    
    # Create Default Settings
    print("⚙️  Filling Site Settings...")
    site_settings, _ = SiteSettings.objects.get_or_create(id=1)
    site_settings.site_name = "منصة نمبر ون التعليمية"
    site_settings.site_description = "أفضل منصة للتعليم الإلكتروني في السودان"
    site_settings.contact_email = "info@number1-sd.com"
    site_settings.contact_phone = "+249123456789"
    site_settings.save()
    
    # Create Announcements
    print("📢 Filling Announcements...")
    Announcement.objects.all().delete()
    for i in range(1, 5):
        Announcement.objects.create(
            title=f"إعلان إداري هام رقم {i}",
            body=f"نود أن نلفت انتباهكم إلى هذا الإعلان الهام جداً، الرجاء المتابعة بشكل دوري للتحديثات. تفاصيل الإعلان {i}",
            is_active=True
        )
        
    # Create Contact Methods
    print("📞 Filling Contact Methods...")
    ContactTool.objects.all().delete()
    methods = [
        ("واتساب الدعم التكنولوجي", "https://wa.me/249123456789", "whatsapp"),
        ("صفحة الفيسبوك", "https://facebook.com/number1", "facebook"),
        ("قناة التليجرام", "https://t.me/number1", "telegram"),
        ("رقم خدمة العملاء", "tel:+249912345678", "phone"),
    ]
    for idx, (label, value, tool_type) in enumerate(methods):
        ContactTool.objects.create(label=label, value=value, tool_type=tool_type, display_order=idx)

    print("🧑‍🏫 Creating 1 Teacher to assign courses to...")
    teacher_user, _ = User.objects.get_or_create(username='teacher_seed', defaults={'full_name': 'أستاذ التجربة', 'email':'teacher_seed@test.com', 'role':'teacher'})
    if not teacher_user.check_password('password123'):
        teacher_user.set_password('password123')
        teacher_user.save()
    TeacherProfile.objects.get_or_create(user=teacher_user, defaults={'specialization': 'عام'})

    # Create Supervisors (10)
    print("👨‍💼 Creating 10 Supervisors...")
    for i in range(1, 11):
        Supervisor.objects.get_or_create(name=f"مشرفة أكاديمية {i}", defaults={'phone': f"0910000{i}"})

    # Create Students (30 Online, 10 Flash)
    print("🎓 Creating Students (30 Online, 10 Flash)...")
    students_online = []
    students_flash = []
    
    for i in range(1, 31):
        st_user, created = User.objects.get_or_create(
            username=f'online_student_{i}', 
            defaults={'full_name': f"طالب أونلاين {i}", 'email': f'online_student_{i}@test.com', 'role': 'student'}
        )
        if created:
            st_user.set_password('password123')
            st_user.save()
            st_prof = StudentProfile.objects.create(user=st_user, system_type='online')
            students_online.append(st_prof)
        else:
            students_online.append(st_user.student_profile)

    for i in range(1, 11):
        st_user, created = User.objects.get_or_create(
            username=f'flash_student_{i}', 
            defaults={'full_name': f"طالب فلاش {i}", 'email': f'flash_student_{i}@test.com', 'role': 'student'}
        )
        if created:
            st_user.set_password('password123')
            st_user.save()
            st_prof = StudentProfile.objects.create(user=st_user, system_type='flash')
            students_flash.append(st_prof)
        else:
            students_flash.append(st_user.student_profile)

    # Create Levels (3 Online, 3 Flash)
    print("📚 Creating Levels and Grades...")
    level_names = ["أساس (ابتدائي)", "متوسط", "ثانوي"]
    
    online_grades = []
    flash_grades = []

    for sys_type, labels, result_list in [('online', level_names, online_grades), ('flash', level_names, flash_grades)]:
        for lvl_name in labels:
            level, _ = Level.objects.get_or_create(name=f"{lvl_name} ({'أونلاين' if sys_type=='online' else 'فلاش'})", defaults={'system_type': sys_type})
            
            if "أساس" in lvl_name:
                grade_count = 6
            else:
                grade_count = 3
                
            for g in range(1, grade_count + 1):
                grade, _ = Grade.objects.get_or_create(
                    name=f"الصف {'الأول' if g==1 else 'الثاني' if g==2 else 'الثالث' if g==3 else 'الرابع' if g==4 else 'الخامس' if g==5 else 'السادس'} - {lvl_name}",
                    level=level,
                    defaults={'system_type': sys_type}
                )
                result_list.append(grade)

    # Assign students to random grades
    for st in students_online:
        st.grade = random.choice(online_grades)
        st.save()
    for st in students_flash:
        st.grade = random.choice(flash_grades)
        st.save()

    # Create Courses (30 Online, 30 Flash)
    print("📖 Creating Courses (30 Online, 30 Flash)...")
    course_subjects = ["الرياضيات", "اللغة العربية", "اللغة الإنجليزية", "العلوم", "التاريخ", "الجغرافيا", "الفيزياء", "الكيمياء", "الأحياء", "الحاسوب"]
    
    online_courses = []
    flash_courses = []

    for sys_type, courses_list, grade_pool in [('online', online_courses, online_grades), ('flash', flash_courses, flash_grades)]:
        for c in range(1, 31):
            grade = grade_pool[c % len(grade_pool)]
            subj = course_subjects[c % len(course_subjects)]
            course, _ = Course.objects.get_or_create(
                name=f"كورس {subj} - {grade.name}",
                grade=grade,
                defaults={
                    'system_type': sys_type,
                    'teacher': teacher_user,
                    'description': 'وصف الكورس التجريبي لتعبئة البيانات.',
                    'is_active': True
                }
            )
            courses_list.append(course)

            # Create 1 Unit per course just to hold lessons
            Unit.objects.get_or_create(
                name=f"الوحدة الأولى - {subj}",
                course=course,
                defaults={'display_order': 1}
            )

    # Create 30 Lectures (for both -> total 60)
    print("🎥 Creating 30 Lectures and Exercises per system (Total 60)...")
    all_units_online = list(Unit.objects.filter(course__system_type='online'))
    all_units_flash = list(Unit.objects.filter(course__system_type='flash'))
    
    exercises = []

    for sys_type, units_list in [('online', all_units_online), ('flash', all_units_flash)]:
        for l in range(1, 31):
            if not units_list:
                break
            unit = random.choice(units_list)
            lesson = Lesson.objects.create(
                unit=unit,
                title=f"المحاضرة رقم {l} - {sys_type}",
                youtube_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                duration_minutes=random.randint(15, 60),
                display_order=l
            )
            # Create Exercise for this lesson
            exercise = Exercise.objects.create(
                lesson=lesson,
                title=f"تمرين المحاضرة {l}",
                pass_percentage=50
            )
            exercises.append(exercise)
            
            # Create Question selections
            for q_idx in range(1, 4): # 3 questions per exercise
                q = Question.objects.create(
                    exercise=exercise,
                    text=f"ما هو حل السؤال رقم {q_idx} في تمرين {l}؟",
                    marks=2
                )
                # Create Choices
                Choice.objects.create(question=q, text="إجابة خاطئة 1", is_correct=False)
                Choice.objects.create(question=q, text="إجابة خاطئة 2", is_correct=False)
                Choice.objects.create(question=q, text="إجابة صحيحة", is_correct=True)

    # Create 30 Submissions
    print("📝 Creating 30 Submissions...")
    for s in range(30):
        # Pick a random exercise
        ex = random.choice(exercises)
        
        # Pick a student matching the system type of the course
        sys_type = ex.lesson.unit.course.system_type
        if sys_type == 'online':
            student = random.choice(students_online)
        else:
            student = random.choice(students_flash)
            
        sub = Submission.objects.create(
            exercise=ex,
            student=student,
            score=random.randint(0, 100),
            is_passed=random.choice([True, False])
        )
        # Create submission answers
        for q in ex.questions.all():
            choice = random.choice(list(q.choices.all()))
            SubmissionAnswer.objects.create(
                submission=sub,
                question=q,
                selected_choice=choice
            )

    print("✅ Successfully seeded the database with all requested data!")

if __name__ == "__main__":
    run_seed()
