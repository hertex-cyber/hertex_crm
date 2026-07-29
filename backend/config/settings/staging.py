"""Staging settings — pre-production validation."""

from .base import *  # noqa: F403, F401

DEBUG = False
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "staging.api.tzahu.com").split(",")  # noqa: F405

LOGGING["root"]["handlers"] = ["json"]  # noqa: F405
LOGGING["root"]["level"] = "INFO"  # noqa: F405
