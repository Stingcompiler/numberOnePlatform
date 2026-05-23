import os
import django
import random

# Setup Django Environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from site_settings.models import StaffCard

def run_seed():
    print("🧹 Cleaning old StaffCards...")
    StaffCard.objects.all().delete()

    print("👨‍🏫 Creating 10 Staff Cards (5 Academic, 5 Administrative)...")
    
    for i in range(1, 6):
        StaffCard.objects.create(
            name=f"د. خبير أكاديمي {i}",
            title=f"أستاذ أول - المادة رقم {i}",
            bio="نخبة من أفضل المعلمين ذوي خبرة تتجاوز 10 سنوات في تقديم المحتوى التعليمي بأسلوب شيق وبسيط يحفز ذكاء الطالب.",
            card_type="academic",
            is_active=True,
            display_order=i
        )
        
    for i in range(1, 6):
        StaffCard.objects.create(
            name=f"أ. خبير إداري {i}",
            title=f"مدير قسم الشؤون الأكاديمية {i}",
            bio="خبرة طويلة في الإدارة التعليمية والتخطيط وتطوير المناهج لضمان تقديم جودة دراسية فائقة لجميع الطلاب.",
            card_type="administrative",
            is_active=True,
            display_order=i+5
        )

    print("✅ Successfully seeded 10 StaffCards!")

if __name__ == "__main__":
    run_seed()
