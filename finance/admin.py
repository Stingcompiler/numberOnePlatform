from django.contrib import admin
from .models import *
# Register your models here.

admin.site.register(ExchangeRate)
admin.site.register(FinancialFile   )

admin.site.register(Payment)



