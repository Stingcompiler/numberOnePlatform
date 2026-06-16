import os
import django

# Setup Django Environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from site_settings.models import SiteSettings

def run_seed():
    print("⚙️  Filling SiteSettings table with rich realistic data...")
    settings = SiteSettings.get_settings()

    settings.institution_name = "مدارس ومعاهد نمبر ون"
    settings.short_title = "الوجهة الأولى للنجاح والتفوق الأكاديمي في السودان"
    
    settings.vision = "الريادة المطلقة في توجيه وصناعة الأجيال نحو التفوق بأساليب تربوية وتقنية مبتكرة تحاكي العصر، لبناء جيل قيادي واعٍ ومتفوق."
    settings.mission = "تقديم دمج متكامل وعالي الجودة للتعليم الحضوري (فلاش) والإلكتروني (أونلاين) في منصة واحدة، مع استقطاب أكفأ الكوادر التعليمية لدعم المسار التعلمي للطالب بشكل مستمر ومرن."
    settings.objectives = "1. رفع المستوى الأكاديمي والتحصيلي للطلاب.\n2. استخدام أحدث أدوات التقنية التعليمية الذكية.\n3. ربط الطالب المعاصر بمحتوى ممتع، وجاذب يسهل عملية استرجاع المعلومة.\n4. دعم الأسرة عبر تتبع مسار وإنجاز الطالب إلكترونياً."
    settings.history = "تأسست مدارس نمبر ون في السودان لتمثل قفزة نوعية في التعليم الخاص. ومنذ نشأتها وما زالت مستمرة بثبات في تخريج أوائل الشهادة السودانية عاماً بعد عام، وتحقيق المراتب الأولى على مستوى الولاية وعلى مستوى الجمهورية بشكل متواصل وبفضل الكادر المتميز والرؤية الإدارية العميقة."
    
    settings.meta_description = "منصة نمبر ون التعليمية، خيارك الأول للتفوق الأكاديمي. نقدم دروس الأونلاين ونظام الفلاش مع أفضل نخبة من معلمي السودان. اشترك الآن واضمن مستقبلك المشرق!"
    settings.meta_keywords = "أونلاين, فلاش, تعليم إلكتروني, السودان, الشهادة السودانية, مدرسة نمبر ون, كورسات مدرسية, دروس عن بعد"
    
    settings.primary_email = "support@numberone-sd.edu"
    settings.primary_phone = "00249123456789"
    settings.address_text = "السودان، ولاية الخرطوم، مركز نمبر ون النموذجي - المبنى الرئيسي."
    
    settings.save()
    print("✅ Successfully populated SiteSettings with all detailed profile information!")

if __name__ == "__main__":
    run_seed()
