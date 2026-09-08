from django.contrib import admin

from .models import App, AppPlatform, AppScreenshot


class AppPlatformInline(admin.TabularInline):
    model = AppPlatform
    extra = 0


class AppScreenshotInline(admin.TabularInline):
    model = AppScreenshot
    extra = 0


@admin.register(App)
class AppAdmin(admin.ModelAdmin):
    list_display  = ("name", "is_published", "display_order", "updated_at")
    list_filter   = ("is_published",)
    search_fields = ("name",)
    inlines       = [AppPlatformInline, AppScreenshotInline]
