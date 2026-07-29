from django.apps import AppConfig


class CustomModulesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.custom_modules"
    label = "custom_modules"
