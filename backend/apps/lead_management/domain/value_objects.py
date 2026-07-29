from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


_VALID_TRANSITIONS: dict[str, set[str]] = {
    "NEW": {"CONTACTED", "DISQUALIFIED"},
    "CONTACTED": {"QUALIFIED", "DISQUALIFIED"},
    "QUALIFIED": {"CONVERTED", "DISQUALIFIED"},
    "DISQUALIFIED": {"RECYCLED", "NEW"},
    "RECYCLED": {"CONTACTED", "QUALIFIED", "DISQUALIFIED"},
    "CONVERTED": set(),
}


class LeadStatus(str, Enum):
    NEW = "NEW"
    CONTACTED = "CONTACTED"
    QUALIFIED = "QUALIFIED"
    CONVERTED = "CONVERTED"
    DISQUALIFIED = "DISQUALIFIED"
    RECYCLED = "RECYCLED"

    def can_transition_to(self, target: str) -> bool:
        return target in _VALID_TRANSITIONS.get(self.value, set())


class LeadSource(str, Enum):
    WEB_FORM = "WEB_FORM"
    REFERRAL = "REFERRAL"
    COLD_CALL = "COLD_CALL"
    EMAIL = "EMAIL"
    SOCIAL_MEDIA = "SOCIAL_MEDIA"
    PARTNER = "PARTNER"
    OTHER = "OTHER"


@dataclass(frozen=True)
class LeadRating:
    score: int

    def __post_init__(self) -> None:
        if not 0 <= self.score <= 100:
            raise ValueError(f"Lead score must be between 0 and 100, got {self.score}")

    @property
    def label(self) -> str:
        if self.score >= 80:
            return "Hot"
        if self.score >= 50:
            return "Warm"
        if self.score >= 20:
            return "Cool"
        return "Cold"
