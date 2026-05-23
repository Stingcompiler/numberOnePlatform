import os
import django
import random

# Setup Django Environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from accounts.models import StudentProfile, Supervisor
from academic.models import Grade

def run_seed():
    print("🔧 Fixing student grades and supervisors...")
    online_grades = list(Grade.objects.filter(system_type='online'))
    flash_grades = list(Grade.objects.filter(system_type='flash'))
    supervisors = list(Supervisor.objects.all())

    students_online = StudentProfile.objects.filter(system_type='online')
    for st in students_online:
        if online_grades:
            st.enrolled_grade = random.choice(online_grades)
        if supervisors:
            st.supervisor = random.choice(supervisors)
        st.save()

    students_flash = StudentProfile.objects.filter(system_type='flash')
    for st in students_flash:
        if flash_grades:
            st.enrolled_grade = random.choice(flash_grades)
        if supervisors:
            st.supervisor = random.choice(supervisors)
        st.save()

    print("✅ Successfully updated all students with valid Grades and Supervisors!")

if __name__ == "__main__":
    run_seed()
