"""Clock implementation using Django's timezone utilities."""

from datetime import datetime

from django.utils import timezone

from apps.shared_kernel.application.ports import Clock


class DjangoClock(Clock):
    """Django-aware clock implementation.

    Uses Django's timezone.now() which respects USE_TZ and the active timezone.
    """

    def now(self) -> datetime:
        return timezone.now()

    def today(self) -> datetime:
        return timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
