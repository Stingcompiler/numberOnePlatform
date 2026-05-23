from django.contrib import admin
from .models import *

admin.site.register(Level)
admin.site.register(Grade)
admin.site.register(Course)
admin.site.register(Unit)
admin.site.register(Lesson)     

admin.site.register(Exercise)
admin.site.register(Question)
admin.site.register(Choice)
admin.site.register(Submission)
admin.site.register(SubmissionAnswer)
admin.site.register(StudentCourseAccess)

# Register your models here.
