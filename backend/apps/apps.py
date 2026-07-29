from django.apps import AppConfig


class SharedKernelConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.shared_kernel"
    label = "shared_kernel"
    verbose_name = "Shared Kernel"
