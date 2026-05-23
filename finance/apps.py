from django.apps import AppConfig


class FinanceConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "finance"
    verbose_name = "المالية"

    def ready(self):
        """
        يُستدعى عند بدء Django — يُسجّل الـ Signals الموجودة في models.py.
        الـ Signals معرَّفة مباشرةً في finance/models.py باستخدام @receiver
        لذلك يكفي استيراد الـ models لتفعيلها.
        """
        import finance.models  # noqa: F401
