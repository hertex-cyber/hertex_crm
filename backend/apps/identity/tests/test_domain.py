"""Tests for identity domain entities."""

from apps.identity.domain.entities import Session, User, UserStatus
from apps.identity.domain.value_objects import DeviceInfo
from apps.shared_kernel.domain.base import utcnow
from apps.shared_kernel.domain.errors import ValidationError
from apps.shared_kernel.domain.value_objects import Email, PersonName


class TestUser:
    def test_create_user_defaults_to_pending(self):
        user = User(
            email=Email("test@example.com"),
            display_name=PersonName("Test", "User"),
        )
        assert user.status == UserStatus.PENDING_VERIFICATION
        assert not user.email_verified
        assert user.is_active is False

    def test_register_sets_password_and_records_event(self):
        user = User(
            email=Email("test@example.com"),
            display_name=PersonName("Test", "User"),
        )
        user.register("hashed_password_here")
        assert user._password_hash == "hashed_password_here"
        events = user.collect_events()
        assert len(events) == 1
        assert events[0].email == "test@example.com"

    def test_verify_email_activates_user(self):
        user = User(
            email=Email("test@example.com"),
            display_name=PersonName("Test", "User"),
        )
        user.register("hash")
        user.collect_events()
        user.verify_email()
        assert user.email_verified
        assert user.status == UserStatus.ACTIVE
        events = user.collect_events()
        assert len(events) == 1

    def test_verify_email_twice_raises_error(self):
        user = User(
            email=Email("test@example.com"),
            display_name=PersonName("Test", "User"),
            email_verified_at=utcnow(),
        )
        try:
            user.verify_email()
            assert False, "Should have raised"
        except ValidationError as e:
            assert "already verified" in str(e)

    def test_record_failed_login_locks_after_5_attempts(self):
        user = User(
            email=Email("test@example.com"),
            display_name=PersonName("Test", "User"),
        )
        for _ in range(4):
            user.record_failed_login()
        assert user.status != UserStatus.LOCKED
        user.record_failed_login()
        assert user.status == UserStatus.LOCKED

    def test_lock_and_unlock(self):
        user = User(
            email=Email("test@example.com"),
            display_name=PersonName("Test", "User"),
        )
        user.lock("test")
        assert user.status == UserStatus.LOCKED
        user.unlock()
        assert user.status == UserStatus.ACTIVE

    def test_disable(self):
        user = User(
            email=Email("test@example.com"),
            display_name=PersonName("Test", "User"),
        )
        user.disable("test")
        assert user.status == UserStatus.DISABLED

    def test_change_password(self):
        user = User(
            email=Email("test@example.com"),
            display_name=PersonName("Test", "User"),
        )
        user.change_password("new_hash")
        assert user._password_hash == "new_hash"

    def test_record_login_resets_failed_attempts(self):
        user = User(
            email=Email("test@example.com"),
            display_name=PersonName("Test", "User"),
        )
        user.record_failed_login()
        user.record_failed_login()
        user.record_login()
        assert user._failed_login_attempts == 0


class TestSession:
    def test_create_session(self):
        session = Session(
            user_id="user-1",
            refresh_token_hash="hash123",
            device_info=DeviceInfo(name="Chrome", device_type="web"),
            ip_address="192.168.1.1",
        )
        assert not session.is_revoked

    def test_revoke_session(self):
        session = Session(
            user_id="user-1",
            refresh_token_hash="hash123",
            device_info=DeviceInfo(),
            ip_address="127.0.0.1",
        )
        session.revoke()
        assert session.is_revoked
