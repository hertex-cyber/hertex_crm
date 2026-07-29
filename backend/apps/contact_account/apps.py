from django.apps import AppConfig


class ContactAccountConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.contact_account"
    label = "contactaccount"
    verbose_name = "Contact & Account Management"
