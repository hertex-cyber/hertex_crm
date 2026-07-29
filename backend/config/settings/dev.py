"""Development settings — local development only."""

from .base import *  # noqa: F403, F401

DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0"]

SECRET_KEY = "dev-insecure-key-do-not-use-in-prod"

INSTALLED_APPS += [  # noqa: F405
    "django_extensions",
]

CORS_ALLOW_ALL_ORIGINS = True

DATABASES["default"]["OPTIONS"] = {  # noqa: F405
    "connect_timeout": 10,
}

LOGGING["root"]["level"] = "DEBUG"  # noqa: F405
LOGGING["loggers"]["django"]["level"] = "DEBUG"  # noqa: F405

EMAIL_BACKEND = "django.core.mail.backends.console.Backend"
DEFAULT_FROM_EMAIL = "noreply@tzahu.com"
FRONTEND_URL = "http://localhost:5173"
