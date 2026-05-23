from django.contrib import admin
from .models import *

# Register your models here.

admin.site.register(SiteSettings)
admin.site.register(Announcement)
admin.site.register(ContactTool)
admin.site.register(ContactMessage)
admin.site.register(StaffCard)  
