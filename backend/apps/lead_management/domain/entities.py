from __future__ import annotations

from uuid import UUID

from apps.lead_management.domain.events import (
    LeadAssigned,
    LeadConverted,
    LeadCreated,
    LeadDeleted,
    LeadScored,
    LeadStatusChanged,
    LeadUpdated,
)
from apps.lead_management.domain.value_objects import LeadRating, LeadSource, LeadStatus
from apps.shared_kernel.domain.base import AggregateRoot, utcnow
from apps.shared_kernel.domain.errors import ValidationError


class Lead(AggregateRoot):
    def __init__(
        self,
        organization_id: UUID,
        first_name: str,
        last_name: str,
        email: str,
        source: str | None = None,
        phone: str = "",
        company: str = "",
        title: str = "",
        notes: str = "",
        owner_id: UUID | None = None,
        assigned_to_id: UUID | None = None,
        status: str | None = None,
        score: int | None = None,
        disqualification_reason: str = "",
        converted_at=None,
        converted_to_contact_id: UUID | None = None,
        converted_to_opportunity_id: UUID | None = None,
        id: UUID | None = None,
    ) -> None:
        super().__init__(id)
        if not first_name.strip():
            raise ValidationError("First name is required")
        if not last_name.strip():
            raise ValidationError("Last name is required")
        if not email.strip() or "@" not in email:
            raise ValidationError("A valid email is required")

        self.organization_id = organization_id
        self._first_name = first_name.strip()
        self._last_name = last_name.strip()
        self._email = email.strip().lower()
        self._phone = phone.strip()
        self._company = company.strip()
        self._title = title.strip()
        self._source = LeadSource(source) if source else LeadSource.OTHER
        self._status = LeadStatus(status) if status else LeadStatus.NEW
        self._score = LeadRating(score) if score is not None else LeadRating(0)
        self._notes = notes
        self._owner_id = owner_id
        self._assigned_to_id = assigned_to_id
        self._converted_at = converted_at
        self._converted_to_contact_id = converted_to_contact_id
        self._converted_to_opportunity_id = converted_to_opportunity_id
        self._disqualification_reason = disqualification_reason
        self._created_at = utcnow()
        self._updated_at = utcnow()

    @property
    def first_name(self) -> str:
        return self._first_name

    @property
    def last_name(self) -> str:
        return self._last_name

    @property
    def full_name(self) -> str:
        return f"{self._first_name} {self._last_name}"

    @property
    def email(self) -> str:
        return self._email

    @property
    def phone(self) -> str:
        return self._phone

    @property
    def company(self) -> str:
        return self._company

    @property
    def title(self) -> str:
        return self._title

    @property
    def source(self) -> str:
        return self._source.value

    @property
    def status(self) -> str:
        return self._status.value

    @property
    def score(self) -> int:
        return self._score.score

    @property
    def notes(self) -> str:
        return self._notes

    @property
    def owner_id(self) -> UUID | None:
        return self._owner_id

    @property
    def assigned_to_id(self) -> UUID | None:
        return self._assigned_to_id

    @property
    def converted_at(self):
        return self._converted_at

    @property
    def converted_to_contact_id(self) -> UUID | None:
        return self._converted_to_contact_id

    @property
    def converted_to_opportunity_id(self) -> UUID | None:
        return self._converted_to_opportunity_id

    @property
    def disqualification_reason(self) -> str:
        return self._disqualification_reason

    @property
    def created_at(self):
        return self._created_at

    @property
    def updated_at(self):
        return self._updated_at

    def _set_updated(self) -> None:
        self._updated_at = utcnow()

    def update_info(
        self,
        first_name: str | None = None,
        last_name: str | None = None,
        email: str | None = None,
        phone: str | None = None,
        company: str | None = None,
        title: str | None = None,
        source: str | None = None,
        notes: str | None = None,
    ) -> dict[str, list]:
        changes: dict[str, list] = {}
        if first_name is not None:
            if not first_name.strip():
                raise ValidationError("First name cannot be empty")
            if first_name.strip() != self._first_name:
                changes["first_name"] = [self._first_name, first_name.strip()]
                self._first_name = first_name.strip()
        if last_name is not None:
            if not last_name.strip():
                raise ValidationError("Last name cannot be empty")
            if last_name.strip() != self._last_name:
                changes["last_name"] = [self._last_name, last_name.strip()]
                self._last_name = last_name.strip()
        if email is not None:
            stripped = email.strip().lower()
            if "@" not in stripped:
                raise ValidationError("A valid email is required")
            if stripped != self._email:
                changes["email"] = [self._email, stripped]
                self._email = stripped
        if phone is not None and phone.strip() != self._phone:
            changes["phone"] = [self._phone, phone.strip()]
            self._phone = phone.strip()
        if company is not None and company.strip() != self._company:
            changes["company"] = [self._company, company.strip()]
            self._company = company.strip()
        if title is not None and title.strip() != self._title:
            changes["title"] = [self._title, title.strip()]
            self._title = title.strip()
        if source is not None:
            new_source = LeadSource(source)
            if new_source != self._source:
                changes["source"] = [self._source.value, new_source.value]
                self._source = new_source
        if notes is not None and notes != self._notes:
            changes["notes"] = [self._notes, notes]
            self._notes = notes
        if changes:
            self._set_updated()
            self._record_event(
                LeadUpdated(lead_id=self.id, changes=changes, organization_id=self.organization_id)
            )
        return changes

    def assign_to(self, user_id: UUID | None) -> None:
        previous = self._assigned_to_id
        if previous == user_id:
            return
        self._assigned_to_id = user_id
        self._set_updated()
        self._record_event(
            LeadAssigned(
                lead_id=self.id,
                from_user_id=previous,
                to_user_id=user_id,
                organization_id=self.organization_id,
            )
        )

    def change_status(self, new_status: str, reason: str = "") -> None:
        target = LeadStatus(new_status)
        if not self._status.can_transition_to(target):
            raise ValidationError(
                f"Cannot transition from {self._status.value} to {target.value}"
            )
        previous = self._status
        self._status = target
        self._set_updated()
        if target == LeadStatus.DISQUALIFIED:
            self._disqualification_reason = reason
        if target == LeadStatus.RECYCLED:
            self._disqualification_reason = ""
        if target == LeadStatus.CONVERTED:
            self._converted_at = utcnow()
        self._record_event(
            LeadStatusChanged(
                lead_id=self.id,
                from_status=previous.value,
                to_status=target.value,
                reason=reason,
                organization_id=self.organization_id,
            )
        )

    def set_score(self, score: int) -> None:
        new_rating = LeadRating(score)
        previous = self._score.score
        if new_rating.score == previous:
            return
        self._score = new_rating
        self._set_updated()
        self._record_event(
            LeadScored(
                lead_id=self.id,
                score=new_rating.score,
                previous_score=previous,
                organization_id=self.organization_id,
            )
        )

    def convert(self, contact_id: UUID, opportunity_id: UUID | None = None) -> None:
        if self._status != LeadStatus.QUALIFIED:
            raise ValidationError("Only qualified leads can be converted")
        self._converted_to_contact_id = contact_id
        self._converted_to_opportunity_id = opportunity_id
        self.change_status("CONVERTED")
        self._record_event(
            LeadConverted(
                lead_id=self.id,
                contact_id=contact_id,
                opportunity_id=opportunity_id,
                organization_id=self.organization_id,
            )
        )

    def record_created(self) -> None:
        self._record_event(
            LeadCreated(
                lead_id=self.id,
                first_name=self._first_name,
                last_name=self._last_name,
                email=self._email,
                source=self._source.value,
                status=self._status.value,
                assigned_to_id=self._assigned_to_id,
                organization_id=self.organization_id,
            )
        )

    def record_deleted(self) -> None:
        self._record_event(
            LeadDeleted(lead_id=self.id, organization_id=self.organization_id)
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "first_name": self._first_name,
            "last_name": self._last_name,
            "email": self._email,
            "phone": self._phone,
            "company": self._company,
            "title": self._title,
            "source": self._source.value,
            "status": self._status.value,
            "score": self._score.score,
            "score_label": self._score.label,
            "notes": self._notes,
            "owner_id": self._owner_id,
            "assigned_to_id": self._assigned_to_id,
            "disqualification_reason": self._disqualification_reason,
            "converted_at": self._converted_at.isoformat() if self._converted_at else None,
            "converted_to_contact_id": self._converted_to_contact_id,
            "converted_to_opportunity_id": self._converted_to_opportunity_id,
            "organization_id": self.organization_id,
            "created_at": self._created_at.isoformat() if self._created_at else None,
            "updated_at": self._updated_at.isoformat() if self._updated_at else None,
        }
