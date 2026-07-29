"""Identity-specific value objects."""

from dataclasses import dataclass

from apps.shared_kernel.domain.base import ValueObject


@dataclass(frozen=True)
class UserPreferences(ValueObject):
    timezone: str = "UTC"
    locale: str = "en"
    date_format: str = "YYYY-MM-DD"
    number_format: str = "en-US"


@dataclass(frozen=True)
class DeviceInfo(ValueObject):
    name: str = ""
    device_type: str = ""
    os: str = ""
    browser: str = ""
    os_version: str = ""
    browser_version: str = ""


@dataclass(frozen=True)
class PasswordPolicy(ValueObject):
    min_length: int = 12
    require_uppercase: bool = True
    require_lowercase: bool = True
    require_digit: bool = True
    require_special: bool = True
    history_count: int = 5
    max_age_days: int = 90
