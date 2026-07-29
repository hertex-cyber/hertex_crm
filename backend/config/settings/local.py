"""Local development settings — SQLite for environments without PostgreSQL."""

from .base import *  # noqa: F403, F401
import os

DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0"]

SECRET_KEY = "dev-insecure-key-do-not-use-in-prod"

INSTALLED_APPS += [  # noqa: F405
    "django_extensions",
]

CORS_ALLOW_ALL_ORIGINS = True

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "tzahu_dev.sqlite3",  # noqa: F405
    }
}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}

LOGGING["root"]["level"] = "INFO"  # noqa: F405
LOGGING["loggers"]["django"]["level"] = "INFO"  # noqa: F405

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = "noreply@tzahu.com"
FRONTEND_URL = "http://localhost:5173"

SILENCED_SYSTEM_CHECKS = ["django_ratelimit.E003", "django_ratelimit.W001", "staticfiles.W004"]

# JWT keys from environment or generated files
KEY_DIR = BASE_DIR.parent / "keys"  # noqa: F405
JWT_PRIVATE_KEY = os.environ.get("JWT_PRIVATE_KEY", "")
if not JWT_PRIVATE_KEY:
    try:
        JWT_PRIVATE_KEY = (KEY_DIR / "private.pem").read_text()
    except (FileNotFoundError, OSError):
        pass

JWT_PUBLIC_KEY = os.environ.get("JWT_PUBLIC_KEY", "")
if not JWT_PUBLIC_KEY:
    try:
        JWT_PUBLIC_KEY = (KEY_DIR / "public.pem").read_text()
    except (FileNotFoundError, OSError):
        pass
