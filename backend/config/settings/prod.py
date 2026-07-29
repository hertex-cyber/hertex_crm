"""Production settings — live customer traffic."""

from .base import *  # noqa: F403, F401

DEBUG = False
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "api.tzahu.com").split(",")  # noqa: F405
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = "DENY"

CORS_ALLOWED_ORIGINS = os.environ.get(  # noqa: F405
    "CORS_ALLOWED_ORIGINS",
    "https://app.tzahu.com",
).split(",")

LOGGING["root"]["handlers"] = ["json"]  # noqa: F405
LOGGING["root"]["level"] = "INFO"  # noqa: F405

STORAGES = {  # noqa: F405
    "default": {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "bucket_name": os.environ.get("AWS_STORAGE_BUCKET_NAME", "tzahu-media"),
            "location": "media",
            "file_overwrite": False,
        },
    },
    "staticfiles": {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "bucket_name": os.environ.get("AWS_STATIC_BUCKET_NAME", "tzahu-static"),
            "location": "static",
        },
    },
}
