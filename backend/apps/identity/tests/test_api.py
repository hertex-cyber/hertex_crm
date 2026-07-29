"""Integration tests for identity API endpoints."""

import pytest
from django.test import Client
from django.urls import reverse


@pytest.fixture
def client():
    return Client()


@pytest.fixture
def register_payload():
    return {
        "email": "test@example.com",
        "password": "strong-password-123!",
        "first_name": "Test",
        "last_name": "User",
    }


@pytest.mark.django_db
class TestAuthAPI:
    def test_register_success(self, client, register_payload):
        resp = client.post(
            "/api/v1/auth/register",
            register_payload,
            content_type="application/json",
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "test@example.com"
        assert data["status"] == "PENDING_VERIFICATION"
        assert "id" in data

    def test_register_duplicate_email(self, client, register_payload):
        client.post("/api/v1/auth/register", register_payload, content_type="application/json")
        resp = client.post(
            "/api/v1/auth/register",
            register_payload,
            content_type="application/json",
        )
        assert resp.status_code == 422
        assert "already registered" in resp.json()["error"]["message"].lower()

    def test_login_success(self, client, register_payload):
        client.post("/api/v1/auth/register", register_payload, content_type="application/json")
        resp = client.post(
            "/api/v1/auth/login",
            {"email": register_payload["email"], "password": register_payload["password"]},
            content_type="application/json",
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["access_token"]
        assert data["refresh_token"]
        assert data["token_type"] == "Bearer"
        assert data["expires_in"] == 900

    def test_login_wrong_password(self, client, register_payload):
        client.post("/api/v1/auth/register", register_payload, content_type="application/json")
        resp = client.post(
            "/api/v1/auth/login",
            {"email": register_payload["email"], "password": "wrong-password"},
            content_type="application/json",
        )
        assert resp.status_code == 401

    def test_me_endpoint(self, client, register_payload):
        client.post("/api/v1/auth/register", register_payload, content_type="application/json")
        login_resp = client.post(
            "/api/v1/auth/login",
            {"email": register_payload["email"], "password": register_payload["password"]},
            content_type="application/json",
        )
        access_token = login_resp.json()["access_token"]

        resp = client.get(
            "/api/v1/auth/me",
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == register_payload["email"]
        assert data["first_name"] == register_payload["first_name"]

    def test_me_unauthorized(self, client):
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 401

    def test_refresh_success(self, client, register_payload):
        client.post("/api/v1/auth/register", register_payload, content_type="application/json")
        login_resp = client.post(
            "/api/v1/auth/login",
            {"email": register_payload["email"], "password": register_payload["password"]},
            content_type="application/json",
        )
        refresh_token = login_resp.json()["refresh_token"]

        resp = client.post(
            "/api/v1/auth/refresh",
            {"refresh_token": refresh_token},
            content_type="application/json",
        )
        assert resp.status_code == 200
        assert resp.json()["access_token"]
        assert resp.json()["refresh_token"]

    def test_refresh_token_rotation(self, client, register_payload):
        client.post("/api/v1/auth/register", register_payload, content_type="application/json")
        login_resp = client.post(
            "/api/v1/auth/login",
            {"email": register_payload["email"], "password": register_payload["password"]},
            content_type="application/json",
        )
        old_refresh = login_resp.json()["refresh_token"]

        client.post(
            "/api/v1/auth/refresh",
            {"refresh_token": old_refresh},
            content_type="application/json",
        )
        resp = client.post(
            "/api/v1/auth/refresh",
            {"refresh_token": old_refresh},
            content_type="application/json",
        )
        assert resp.status_code == 401

    def test_logout(self, client, register_payload):
        client.post("/api/v1/auth/register", register_payload, content_type="application/json")
        login_resp = client.post(
            "/api/v1/auth/login",
            {"email": register_payload["email"], "password": register_payload["password"]},
            content_type="application/json",
        )
        tokens = login_resp.json()
        access_token = tokens["access_token"]
        refresh_token = tokens["refresh_token"]

        resp = client.post(
            "/api/v1/auth/logout",
            {"refresh_token": refresh_token},
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
        )
        assert resp.status_code == 204

        resp = client.post(
            "/api/v1/auth/refresh",
            {"refresh_token": refresh_token},
            content_type="application/json",
        )
        assert resp.status_code == 401

    def test_forgot_password(self, client):
        resp = client.post(
            "/api/v1/auth/forgot-password",
            {"email": "test@example.com"},
            content_type="application/json",
        )
        assert resp.status_code == 200
        assert "sent" in resp.json()["message"].lower()

    def test_forgot_password_returns_token_in_debug(self, client, register_payload):
        client.post("/api/v1/auth/register", register_payload, content_type="application/json")
        resp = client.post(
            "/api/v1/auth/forgot-password",
            {"email": register_payload["email"]},
            content_type="application/json",
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "reset_token" in data
        assert "reset_url" in data

    def test_reset_password_success(self, client, register_payload):
        client.post("/api/v1/auth/register", register_payload, content_type="application/json")
        forgot_resp = client.post(
            "/api/v1/auth/forgot-password",
            {"email": register_payload["email"]},
            content_type="application/json",
        )
        token = forgot_resp.json()["reset_token"]

        resp = client.post(
            "/api/v1/auth/reset-password",
            {"token": token, "new_password": "new-strong-pwd-123!"},
            content_type="application/json",
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Password has been reset successfully."

        login_resp = client.post(
            "/api/v1/auth/login",
            {"email": register_payload["email"], "password": "new-strong-pwd-123!"},
            content_type="application/json",
        )
        assert login_resp.status_code == 200

    def test_reset_password_invalid_token(self, client):
        resp = client.post(
            "/api/v1/auth/reset-password",
            {"token": "invalid-token", "new_password": "new-strong-pwd-123!"},
            content_type="application/json",
        )
        assert resp.status_code == 400
        assert "Invalid or expired" in resp.json()["error"]["message"]

    def test_update_profile(self, client, register_payload):
        client.post("/api/v1/auth/register", register_payload, content_type="application/json")
        login_resp = client.post(
            "/api/v1/auth/login",
            {"email": register_payload["email"], "password": register_payload["password"]},
            content_type="application/json",
        )
        access_token = login_resp.json()["access_token"]

        resp = client.put(
            "/api/v1/auth/me",
            {"first_name": "Updated", "locale": "fr-FR"},
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["first_name"] == "Updated"
        assert data["locale"] == "fr-FR"
        assert data["email"] == register_payload["email"]

    def test_change_password_success(self, client, register_payload):
        client.post("/api/v1/auth/register", register_payload, content_type="application/json")
        login_resp = client.post(
            "/api/v1/auth/login",
            {"email": register_payload["email"], "password": register_payload["password"]},
            content_type="application/json",
        )
        access_token = login_resp.json()["access_token"]

        resp = client.post(
            "/api/v1/auth/change-password",
            {
                "current_password": register_payload["password"],
                "new_password": "brand-new-pwd-456!",
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
        )
        assert resp.status_code == 200

        old_login = client.post(
            "/api/v1/auth/login",
            {"email": register_payload["email"], "password": register_payload["password"]},
            content_type="application/json",
        )
        assert old_login.status_code == 401

        new_login = client.post(
            "/api/v1/auth/login",
            {"email": register_payload["email"], "password": "brand-new-pwd-456!"},
            content_type="application/json",
        )
        assert new_login.status_code == 200

    def test_change_password_wrong_current(self, client, register_payload):
        client.post("/api/v1/auth/register", register_payload, content_type="application/json")
        login_resp = client.post(
            "/api/v1/auth/login",
            {"email": register_payload["email"], "password": register_payload["password"]},
            content_type="application/json",
        )
        access_token = login_resp.json()["access_token"]

        resp = client.post(
            "/api/v1/auth/change-password",
            {"current_password": "wrong-current", "new_password": "brand-new-pwd-456!"},
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
        )
        assert resp.status_code == 400

    def test_list_sessions(self, client, register_payload):
        client.post("/api/v1/auth/register", register_payload, content_type="application/json")
        login_resp = client.post(
            "/api/v1/auth/login",
            {"email": register_payload["email"], "password": register_payload["password"]},
            content_type="application/json",
        )
        access_token = login_resp.json()["access_token"]

        resp = client.get(
            "/api/v1/auth/sessions",
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert "id" in data[0]
        assert "created_at" in data[0]

    def test_revoke_session(self, client, register_payload):
        client.post("/api/v1/auth/register", register_payload, content_type="application/json")
        login_resp = client.post(
            "/api/v1/auth/login",
            {"email": register_payload["email"], "password": register_payload["password"]},
            content_type="application/json",
        )
        access_token = login_resp.json()["access_token"]

        sessions_resp = client.get(
            "/api/v1/auth/sessions",
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
        )
        session_id = sessions_resp.json()[0]["id"]

        resp = client.delete(
            f"/api/v1/auth/{session_id}/sessions",
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
        )
        assert resp.status_code == 204

        sessions_after = client.get(
            "/api/v1/auth/sessions",
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
        )
        assert len(sessions_after.json()) == 0


@pytest.mark.django_db
class TestUserAdmin:
    def test_users_list_requires_auth(self, client):
        resp = client.get("/api/v1/auth/users/")
        assert resp.status_code == 401

    def test_users_list_and_detail(self, client, register_payload):
        client.post("/api/v1/auth/register", register_payload, content_type="application/json")
        login_resp = client.post(
            "/api/v1/auth/login",
            {"email": register_payload["email"], "password": register_payload["password"]},
            content_type="application/json",
        )
        access_token = login_resp.json()["access_token"]

        list_resp = client.get(
            "/api/v1/auth/users/",
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
        )
        assert list_resp.status_code == 200
        data = list_resp.json()
        assert len(data) == 1
        assert data[0]["email"] == register_payload["email"]

        user_id = data[0]["id"]
        detail_resp = client.get(
            f"/api/v1/auth/users/{user_id}",
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
        )
        assert detail_resp.status_code == 200
        assert detail_resp.json()["email"] == register_payload["email"]

    def test_users_detail_not_found(self, client, register_payload):
        client.post("/api/v1/auth/register", register_payload, content_type="application/json")
        login_resp = client.post(
            "/api/v1/auth/login",
            {"email": register_payload["email"], "password": register_payload["password"]},
            content_type="application/json",
        )
        access_token = login_resp.json()["access_token"]

        resp = client.get(
            "/api/v1/auth/users/nonexistent-id",
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
        )
        assert resp.status_code == 404
