"""Event handlers for identity domain events.

Auto-verifies users on registration since email infrastructure is not yet deployed.
When SendGrid/Mailgun is configured, replace auto-verify with email-sending logic.
"""

from apps.identity.domain.events import UserRegistered
from apps.identity.infrastructure.repositories import UserRepository


def handle_UserRegistered(event: UserRegistered) -> None:
    """Auto-verify user on registration.

    TODO: Replace with actual email sending when email service is configured.
    Sends verification email with link containing a signed token.
    """
    repo = UserRepository()
    user = repo.get_by_id(event.user_id)
    if not user:
        return
    user.verify_email()
    repo.save(user)
