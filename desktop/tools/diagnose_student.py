"""
Why is a student's app empty?

Answers, in one pass, every reason a screen can legitimately come back blank.
Read-only -- it changes nothing.

    python manage.py shell -c "exec(open('desktop/tools/diagnose_student.py').read())"

Set USERNAME below, or leave it as-is to report on every student.
"""

USERNAME = "wiz"

import sys

from accounts.models import StudentProfile
from academic.models import Course, Grade, Level, StudentCourseAccess
from exams.models import Exam
from live.models import LiveRoom, LiveSession
from notifications.models import Notification


def say(*parts):
    """
    print() that survives a cp1252 console.

    Windows terminals default to a codepage that cannot encode Arabic, and an
    unhandled UnicodeEncodeError halfway through would leave the diagnosis
    truncated at the first course name -- exactly the output that matters.
    """
    line = " ".join(str(p) for p in parts)
    encoding = getattr(sys.stdout, "encoding", None) or "utf-8"
    safe = line.encode(encoding, errors="replace").decode(encoding)
    sys.stdout.write(safe + chr(10))

say("=" * 62)
say("PLATFORM CONTENT (does anything exist at all?)")
say("=" * 62)
say(f"  levels          : {Level.objects.count()}")
say(f"  grades          : {Grade.objects.count()}")
say(f"  courses         : {Course.objects.count()}  (active: {Course.objects.filter(is_active=True).count()})")
say(f"  exams           : {Exam.objects.count()}  (active: {Exam.objects.filter(is_active=True).count()})")
say(f"  live rooms      : {LiveRoom.objects.count()}  (active: {LiveRoom.objects.filter(is_active=True).count()})")
say(f"  live sessions   : {LiveSession.objects.count()}")

if Course.objects.filter(is_active=True).count() == 0:
    say("\n  >> No active courses exist. Every student's courses screen is")
    say("     correctly empty until courses are created.")

say()
say("=" * 62)
say(f"STUDENT: {USERNAME}")
say("=" * 62)

try:
    p = StudentProfile.objects.select_related("user", "enrolled_grade").get(
        user__username=USERNAME
    )
except StudentProfile.DoesNotExist:
    say(f"  No student profile for '{USERNAME}'.")
    say("  Students on this server:",
          list(StudentProfile.objects.values_list("user__username", flat=True)[:20]))
    raise SystemExit

say(f"  active          : {p.user.is_active}")
say(f"  system_type     : {p.system_type}")
say(f"  enrolled_grade  : {p.enrolled_grade}")
say(f"  device_id       : {p.device_id}")

access = StudentCourseAccess.objects.filter(student=p, is_active=True)
say(f"  course access   : {access.count()}")
for a in access[:10]:
    say(f"      - {a.course.name}")

say()
say("-- WHY THE COURSES SCREEN IS EMPTY --")
if access.count() > 0:
    say("  It should NOT be empty. /academic/my-courses/ reads exactly this")
    say("  list, so if the screen is blank the problem is not the data.")
else:
    say("  /academic/my-courses/ reads StudentCourseAccess, which is empty.")
    if p.enrolled_grade is None:
        say("  Root cause: enrolled_grade is None. _grant_all_level_courses()")
        say("  returns early without it, so even a payment grants nothing.")
    elif p.system_type == "online":
        n = Course.objects.filter(
            grade=p.enrolled_grade, is_active=True, system_type="online"
        ).count()
        say(f"  Online student. Access is granted on FIRST PAYMENT only.")
        say(f"  Courses that would be granted: {n}")
    else:
        say("  Flash student. Courses must be linked manually.")

say()
say("-- WHAT THE EXAMS SCREEN WILL SHOW --")
# Deliberately different rule from courses: StudentExamListView reads
# enrolled_grade for online students rather than StudentCourseAccess.
if p.system_type == "online":
    courses = Course.objects.filter(
        grade=p.enrolled_grade, system_type="online", is_active=True
    )
else:
    courses = [a.course for a in access]
n_exams = Exam.objects.filter(course__in=courses, is_active=True).count()
say(f"  {n_exams} exam(s) -- note this uses a DIFFERENT rule than courses,")
say("  so exams can appear for courses the student cannot open.")

say()
say("-- WHY THE LIVE SCREEN IS EMPTY --")
rooms = LiveRoom.objects.filter(room_type=p.system_type, is_active=True)
say(f"  Rooms matching room_type='{p.system_type}' and active: {rooms.count()}")
for r in rooms[:10]:
    say(f"      - {r.room_name}: {r.sessions.count()} session(s)")
if rooms.count() == 0:
    other = LiveRoom.objects.exclude(room_type=p.system_type)
    if other.exists():
        say("  Rooms exist but none match this student's system_type:")
        for r in other[:10]:
            say(f"      - {r.room_name} (room_type={r.room_type}, active={r.is_active})")
        say("  The server filters by system_type; the client does not filter.")

say()
say(f"-- NOTIFICATIONS --")
say(f"  {Notification.objects.filter(student=p).count()} total, "
      f"{Notification.objects.filter(student=p, is_read=False).count()} unread")
say("=" * 62)
