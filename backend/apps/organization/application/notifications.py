from django.conf import settings
from django.core.mail import send_mail
from django.urls import reverse


def send_invite_email(*, invitee_email: str, inviter_name: str, org_name: str, membership_id: str) -> None:
    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
    accept_link = f"{frontend_url}/join?membership_id={membership_id}"
    subject = f"You've been invited to {org_name}"
    message = (
        f"Hi,\n\n"
        f"{inviter_name} has invited you to join {org_name} on TZAHU CRM.\n\n"
        f"Click the link below to accept the invitation:\n{accept_link}\n\n"
        f"If you don't have an account yet, you'll need to register first.\n\n"
        f"Best,\nTZAHU CRM Team"
    )
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[invitee_email],
        fail_silently=False,
    )
