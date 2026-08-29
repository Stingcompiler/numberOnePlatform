"""
جعل إشعار السداد إلزامياً كبقية مستندات التسجيل.

كان ‎payment_receipt_image‎ وحده بين السبعة ‎blank=True, null=True‎، فكان الطلب
يُقبَل بلا إشعار سداد.

الترتيب مقصود: ‎null=False‎ تعديل على قاعدة البيانات، وأي صف قديم يحمل NULL
كان سيُفشل ‎SET NOT NULL‎ في منتصف النشر على PostgreSQL. فتُملأ القيم الفارغة
بسلسلة فارغة أولاً — وهي التمثيل الذي يستخدمه Django أصلاً للملف الغائب —
ثم يُغيَّر العمود.

لا تُحذف بيانات: الصفوف التي تحمل ملفاً تبقى كما هي، والتي لا تحمله تُصبح ''
فتظهر ناقصةً في صفحة المراجعة بدل أن تمرّ بصمت.
"""

from django.db import migrations, models

import accounts.models


def fill_null_receipts(apps, schema_editor):
    """NULL → '' قبل تضييق العمود."""
    NewStudentRegistration = apps.get_model("accounts", "NewStudentRegistration")
    NewStudentRegistration.objects.filter(payment_receipt_image__isnull=True).update(
        payment_receipt_image="",
    )


def noop(apps, schema_editor):
    """
    التراجع لا يحتاج عملاً: العمود يعود ليقبل NULL، والسلاسل الفارغة صالحة
    فيه. إعادتها إلى NULL كانت ستضيّع التمييز بين "لم يُرفع" و"أُفرِغ".
    """


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0012_alter_lecturesupervisorprofile_options_and_more"),
    ]

    operations = [
        migrations.RunPython(fill_null_receipts, noop),
        migrations.AlterField(
            model_name="newstudentregistration",
            name="payment_receipt_image",
            field=models.ImageField(
                upload_to=accounts.models.registration_upload_path,
                verbose_name="  تحميل اشعار سداد الرسوم / اشعار بنكك ",
            ),
        ),
    ]
