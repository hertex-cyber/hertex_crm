"""Shared Kernel Value Objects — universal, context-independent.

These are safe to share across all modules because they encode pure format/validation
logic with zero business semantics. Every module may import these freely.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Self

from .base import ValueObject
from .errors import ValidationError


@dataclass(frozen=True)
class Email(ValueObject):
    """Email address with normalization and validation.

    Rules:
    - Must match RFC 5322 simplified pattern
    - Stored in lowercase (normalized)
    - Verified flag is managed by Identity context, not here
    """
    address: str

    def __post_init__(self) -> None:
        normalized = self.address.strip().lower()
        if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", normalized):
            raise ValidationError(f"Invalid email address: {self.address}")
        object.__setattr__(self, "address", normalized)


@dataclass(frozen=True)
class PhoneNumber(ValueObject):
    """Phone number in E.164 format.

    Rules:
    - Must start with +
    - Must contain only digits after +
    - Must be between 8 and 15 digits
    """
    number: str
    country_code: str = ""

    def __post_init__(self) -> None:
        normalized = self.number.strip()
        if not normalized.startswith("+"):
            normalized = f"+{normalized}" if normalized.isdigit() else normalized
        if not re.match(r"^\+[1-9]\d{7,14}$", normalized):
            raise ValidationError(f"Invalid phone number: {self.number}")
        object.__setattr__(self, "number", normalized)


@dataclass(frozen=True)
class Address(ValueObject):
    """Universal address structure."""
    street: str = ""
    city: str = ""
    state: str = ""
    postal_code: str = ""
    country: str = ""


@dataclass(frozen=True)
class PersonName(ValueObject):
    """Person name with display name generation."""
    first_name: str
    last_name: str

    @property
    def display_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


@dataclass(frozen=True)
class Currency(ValueObject):
    """ISO 4217 currency code."""
    code: str

    def __post_init__(self) -> None:
        code = self.code.upper()
        if code not in _VALID_CURRENCIES:
            raise ValidationError(f"Invalid currency code: {self.code}")
        object.__setattr__(self, "code", code)

    @property
    def symbol(self) -> str:
        return _CURRENCY_SYMBOLS.get(self.code, self.code)

    @property
    def decimal_places(self) -> int:
        return _CURRENCY_DECIMALS.get(self.code, 2)


_VALID_CURRENCIES = {"USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY", "CNY", "BRL", "MXN", "CHF", "SGD", "HKD", "NZD", "KRW", "SEK", "NOK", "DKK"}
_CURRENCY_SYMBOLS = {"USD": "$", "EUR": "€", "GBP": "£", "INR": "₹", "JPY": "¥", "CNY": "¥", "BRL": "R$"}
_CURRENCY_DECIMALS = {"USD": 2, "EUR": 2, "GBP": 2, "INR": 2, "JPY": 0, "CNY": 2}


@dataclass(frozen=True)
class Money(ValueObject):
    """Monetary value with currency safety.

    Invariant: Adding two Money values with different currencies must fail.
    This single rule, enforced here, prevents a silent multi-currency bug
    from ever reaching Opportunity or Billing.
    """
    amount: Decimal
    currency: Currency

    def __post_init__(self) -> None:
        normalized = self.amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        object.__setattr__(self, "amount", normalized)

    def __add__(self, other: Money) -> Money:
        if self.currency != other.currency:
            raise ValidationError(f"Cannot add {self.currency.code} to {other.currency.code}")
        return Money(self.amount + other.amount, self.currency)

    def __sub__(self, other: Money) -> Money:
        if self.currency != other.currency:
            raise ValidationError(f"Cannot subtract {other.currency.code} from {self.currency.code}")
        return Money(self.amount - other.amount, self.currency)

    def __mul__(self, multiplier: Decimal) -> Money:
        return Money(self.amount * multiplier, self.currency)

    def __neg__(self) -> Money:
        return Money(-self.amount, self.currency)


@dataclass(frozen=True)
class Percentage(ValueObject):
    """0-100 bounded decimal percentage."""
    value: Decimal

    def __post_init__(self) -> None:
        normalized = self.value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if not Decimal("0") <= normalized <= Decimal("100"):
            raise ValidationError(f"Percentage must be between 0 and 100: {self.value}")
        object.__setattr__(self, "value", normalized)

    def as_decimal(self) -> Decimal:
        return self.value / Decimal("100")

    def apply_to(self, amount: Decimal) -> Decimal:
        return amount * self.as_decimal()


@dataclass(frozen=True)
class TimeZone(ValueObject):
    """IANA timezone identifier."""
    zone: str

    def __post_init__(self) -> None:
        import zoneinfo
        if self.zone not in zoneinfo.available_timezones():
            raise ValidationError(f"Invalid timezone: {self.zone}")
