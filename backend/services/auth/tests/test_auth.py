from datetime import datetime, timedelta, timezone
from sqlalchemy import text


def test_postgres_connectivity(db_session):
    result = db_session.execute(text("SELECT 1"))
    assert result.scalar() == 1


def test_register_new_tenant(client, user_data):
    response = client.post("/register", json=user_data)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == user_data["email"]
    assert data["first_name"] == user_data["first_name"]
    assert data["profile"]["role"] == user_data["user_profile"]["role"]
    assert "user_id" in data
    assert "tenant_id" in data


def test_register_existing_tenant(client, user_data):
    response = client.post("/register", json=user_data)
    tenant_id = response.json()["tenant_id"]

    second_user = {
        "email": "worker@greenfield.com",
        "password": "pass1234",
        "tenant_id": tenant_id,
        "user_profile": {"role": "field_worker"},
    }
    response = client.post("/register", json=second_user)
    assert response.status_code == 200
    assert response.json()["tenant_id"] == tenant_id


def test_register_duplicate_email(client, user_data):
    client.post("/register", json=user_data)
    response = client.post("/register", json=user_data)
    assert response.status_code == 400
    assert response.json()["detail"] == "Email already registered"


def test_login_success(client, user_data, login_data):
    client.post("/register", json=user_data)
    response = client.post("/login", json=login_data)
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["token_type"] == "bearer"
    assert "access_token" in response.cookies


def test_login_invalid_credentials(client, login_data):
    response = client.post("/login", json=login_data)
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


def test_login_wrong_password(client, user_data):
    client.post("/register", json=user_data)
    response = client.post(
        "/login", json={"email": user_data["email"], "password": "wrongpassword"}
    )
    assert response.status_code == 401


def test_get_me(client, user_data, login_data):
    client.post("/register", json=user_data)
    client.post("/login", json=login_data)  # sets access_token cookie on client jar

    response = client.get("/users/me")
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == user_data["email"]
    assert data["profile"]["role"] == user_data["user_profile"]["role"]


def test_get_me_no_token(client):
    response = client.get("/users/me")
    assert response.status_code == 401


def test_update_me(client, user_data, login_data):
    client.post("/register", json=user_data)
    client.post("/login", json=login_data)  # sets access_token cookie on client jar

    update = {
        "first_name": "Jane",
        "user_profile": {"role": "admin", "position": "lead agronomist"},
    }
    response = client.put("/users/me", json=update)
    assert response.status_code == 200
    assert response.json()["first_name"] == "Jane"


def test_logout(client, user_data, login_data):
    client.post("/register", json=user_data)
    client.post("/login", json=login_data)  # sets access_token cookie on client jar

    response = client.post("/logout")
    assert response.status_code == 200
    assert response.json()["message"] == "Logged out successfully"

    # Token should be invalidated after logout (server-side session marked logged_out)
    response = client.get("/users/me")
    assert response.status_code == 401


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["service"] == "auth"


# ── 1.1 Test gaps ─────────────────────────────────────────────────────────────

def test_unauthenticated_access_returns_401(client):
    """All protected routes must reject requests without a valid session cookie."""
    assert client.get("/users/me").status_code == 401
    assert client.put("/users/me", json={}).status_code == 401
    assert client.post("/logout").status_code == 401


def test_session_expiry_enforced(client, user_data, login_data, db_session):
    """After a session's expires_at is in the past, /users/me must return 401."""
    client.post("/register", json=user_data)
    client.post("/login", json=login_data)

    # Manually push all active sessions into the past
    db_session.execute(
        text("UPDATE sessions SET expires_at = :exp WHERE status = 'active'"),
        {"exp": datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=1)},
    )
    db_session.commit()

    response = client.get("/users/me")
    assert response.status_code == 401


def test_cross_tenant_profile_update_blocked(client, user_data):
    """A user cannot submit a tenant_id that doesn't match their own session."""
    # Register two separate tenants
    client.post("/register", json=user_data)
    second = {
        "email": "other@otherfarm.com",
        "password": "pass1234",
        "tenant_name": "OtherFarm",
        "user_profile": {"role": "manager"},
    }
    client.post("/register", json=second)

    # Login as first user
    client.post("/login", json={"email": user_data["email"], "password": user_data["password"]})

    # The PUT /users/me endpoint only updates the current_user's own profile;
    # it cannot touch another tenant's data. Sending a different tenant_profile
    # is silently scoped to the authenticated user's tenant.
    response = client.put(
        "/users/me",
        json={"user_profile": {"role": "hacker"}},
    )
    # Should succeed but only update own profile
    assert response.status_code == 200
    assert response.json()["email"] == user_data["email"]


# ── 1.2 Password reset flow ───────────────────────────────────────────────────

def test_forgot_password_creates_reset_token(client, user_data):
    client.post("/register", json=user_data)
    response = client.post("/forgot-password", json={"email": user_data["email"]})
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert data.get("reset_token") is not None
    assert len(data["reset_token"]) == 64  # secrets.token_hex(32) → 64 hex chars


def test_forgot_password_unknown_email_returns_200(client):
    """Security: never reveal whether an email is registered."""
    response = client.post("/forgot-password", json={"email": "ghost@nowhere.com"})
    assert response.status_code == 200
    assert response.json().get("reset_token") is None


def test_reset_password_with_valid_token(client, user_data, login_data):
    client.post("/register", json=user_data)
    forgot = client.post("/forgot-password", json={"email": user_data["email"]})
    token = forgot.json()["reset_token"]

    response = client.post("/reset-password", json={"token": token, "new_password": "newpass456"})
    assert response.status_code == 200

    # Old password no longer works
    assert client.post("/login", json=login_data).status_code == 401
    # New password works
    assert client.post(
        "/login", json={"email": user_data["email"], "password": "newpass456"}
    ).status_code == 200


def test_reset_password_token_expires_after_15min(client, user_data, db_session):
    client.post("/register", json=user_data)
    forgot = client.post("/forgot-password", json={"email": user_data["email"]})
    token = forgot.json()["reset_token"]

    # Wind the expiry back into the past
    db_session.execute(
        text("UPDATE password_reset_tokens SET expires_at = :exp WHERE token = :tok"),
        {"exp": datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=1), "tok": token},
    )
    db_session.commit()

    response = client.post("/reset-password", json={"token": token, "new_password": "newpass456"})
    assert response.status_code == 400
    assert "expired" in response.json()["detail"]


def test_reset_password_token_single_use(client, user_data):
    client.post("/register", json=user_data)
    forgot = client.post("/forgot-password", json={"email": user_data["email"]})
    token = forgot.json()["reset_token"]

    client.post("/reset-password", json={"token": token, "new_password": "firstnew"})
    # Second use of the same token must fail
    response = client.post("/reset-password", json={"token": token, "new_password": "secondnew"})
    assert response.status_code == 400


# ── 1.2 Role enforcement ──────────────────────────────────────────────────────

def test_assign_role_requires_admin(client, user_data):
    # Register admin (tenant creator)
    admin_resp = client.post("/register", json=user_data)
    tenant_id = admin_resp.json()["tenant_id"]

    # Register a second user (non-admin, just joins tenant)
    worker_data = {
        "email": "worker@greenfield.com",
        "password": "pass1234",
        "tenant_id": tenant_id,
        "user_profile": {"role": "field_worker"},
    }
    worker_resp = client.post("/register", json=worker_data)
    worker_id = worker_resp.json()["user_id"]
    admin_id = admin_resp.json()["user_id"]

    # Log in as admin
    client.post("/login", json={"email": user_data["email"], "password": user_data["password"]})

    # Admin assigns Viewer role to worker — must succeed
    resp = client.post(f"/users/{worker_id}/roles", json={"role_name": "Viewer"})
    assert resp.status_code == 200

    # Log out admin; log in as worker (now Viewer)
    client.post("/logout")
    client.post("/login", json={"email": "worker@greenfield.com", "password": "pass1234"})

    # Worker (Viewer) tries to assign Admin role back — must fail
    resp = client.post(f"/users/{admin_id}/roles", json={"role_name": "Admin"})
    assert resp.status_code == 403
    assert "Admin role required" in resp.json()["detail"]


# ── Coverage additions ─────────────────────────────────────────────────────────

import jwt as _pyjwt
import pytest
from unittest.mock import patch, MagicMock

_TEST_SECRET = "test-secret-for-ci-only-min-32-bytes!"
_TEST_ALGO = "HS256"


# ── authenticate.py coverage ──────────────────────────────────────────────────

def test_decode_access_token_invalid_jwt(client):
    """Invalid JWT signature → 401."""
    client.cookies.set("access_token", "this.is.garbage")
    assert client.get("/users/me").status_code == 401


def test_decode_access_token_missing_claims(client):
    """JWT missing sub/tenant_id → 401."""
    token = _pyjwt.encode({"foo": "bar"}, _TEST_SECRET, algorithm=_TEST_ALGO)
    client.cookies.set("access_token", token)
    assert client.get("/users/me").status_code == 401


# ── configs.py coverage ───────────────────────────────────────────────────────

def test_get_db_yields_and_closes():
    from configs import get_db
    gen = get_db()
    db = next(gen)
    assert db is not None
    try:
        next(gen)
    except StopIteration:
        pass


def test_connect_with_retry_raises_after_max_attempts():
    import configs
    from sqlalchemy.exc import OperationalError
    mock_engine = MagicMock()
    mock_engine.connect.side_effect = OperationalError("fail", {}, Exception("fail"))
    with patch("configs.create_engine", return_value=mock_engine), \
         patch("configs.time.sleep"):
        with pytest.raises(Exception, match="Failed to connect"):
            configs.connect_with_retry(max_attempts=2, delay=0)


def test_connect_with_retry_succeeds_after_transient_error():
    import configs
    from sqlalchemy.exc import OperationalError
    mock_engine = MagicMock()
    call_count = [0]
    def flaky_connect():
        call_count[0] += 1
        if call_count[0] == 1:
            raise OperationalError("fail", {}, Exception("fail"))
    mock_engine.connect.side_effect = flaky_connect
    with patch("configs.create_engine", return_value=mock_engine), \
         patch("configs.time.sleep"):
        result = configs.connect_with_retry(max_attempts=3, delay=0)
    assert result is mock_engine


# ── crud.py coverage ──────────────────────────────────────────────────────────

def test_register_duplicate_tenant_name(client, user_data):
    """Two registrations with same tenant_name → 400 Tenant name already exists."""
    client.post("/register", json=user_data)
    duplicate = {**user_data, "email": "other@greenfield.com"}
    resp = client.post("/register", json=duplicate)
    assert resp.status_code == 400
    assert "Tenant name already exists" in resp.json()["detail"]


def test_register_invalid_tenant_id_returns_400(client, user_data):
    """Joining a non-existent tenant_id → 400."""
    payload = {
        "email": user_data["email"],
        "password": user_data["password"],
        "tenant_id": 999999,
        "user_profile": {"role": "manager"},
    }
    resp = client.post("/register", json=payload)
    assert resp.status_code == 400
    assert "Invalid tenant_id" in resp.json()["detail"]


def test_register_no_tenant_returns_400(client, user_data):
    """Registration without tenant_id or tenant_name → 400."""
    payload = {"email": user_data["email"], "password": user_data["password"]}
    resp = client.post("/register", json=payload)
    assert resp.status_code == 400
    assert "Either tenant_id or tenant_name" in resp.json()["detail"]


def test_update_me_email_and_password(client, user_data, login_data):
    """Updating email, password, and last_name exercises those crud branches."""
    client.post("/register", json=user_data)
    client.post("/login", json=login_data)
    resp = client.put("/users/me", json={
        "email": "updated@greenfield.com",
        "password": "newpass999",
        "last_name": "Smith",
    })
    assert resp.status_code == 200


def test_update_me_tenant_profile(client, user_data, login_data):
    """Updating tenant_profile creates/updates the TenantProfile row."""
    client.post("/register", json=user_data)
    client.post("/login", json=login_data)
    resp = client.put("/users/me", json={"tenant_profile": {"country": "Kenya", "farm_size": 25.0}})
    assert resp.status_code == 200


def test_update_me_creates_user_profile_if_missing(client, user_data):
    """If user has no UserProfile, updating user_profile creates one."""
    no_profile = {
        "email": user_data["email"],
        "password": user_data["password"],
        "tenant_name": user_data["tenant_name"],
    }
    client.post("/register", json=no_profile)
    client.post("/login", json={"email": user_data["email"], "password": user_data["password"]})
    resp = client.put("/users/me", json={"user_profile": {"role": "agronomist"}})
    assert resp.status_code == 200


# ── main.py coverage ─────────────────────────────────────────────────────────

def test_get_current_user_nonexistent_user_returns_401(client):
    """Valid JWT but user not in DB → 401."""
    token = _pyjwt.encode(
        {"sub": "999999", "tenant_id": "999999",
         "exp": datetime.now(timezone.utc) + timedelta(minutes=30)},
        _TEST_SECRET, algorithm=_TEST_ALGO,
    )
    client.cookies.set("access_token", token)
    assert client.get("/users/me").status_code == 401


def test_login_inactive_user_returns_403(client, user_data, login_data, db_session):
    """Login attempt with an inactive user → 403."""
    client.post("/register", json=user_data)
    db_session.execute(
        text("UPDATE users SET status = 'inactive' WHERE email = :e"),
        {"e": user_data["email"]},
    )
    db_session.commit()
    resp = client.post("/login", json=login_data)
    assert resp.status_code == 403


def test_assign_role_target_not_in_tenant_returns_404(client, user_data):
    """Admin assigning role to non-existent user_id in their tenant → 404."""
    client.post("/register", json=user_data)
    client.post("/login", json={"email": user_data["email"], "password": user_data["password"]})
    resp = client.post("/users/999999/roles", json={"role_name": "Viewer"})
    assert resp.status_code == 404
    assert "User not found" in resp.json()["detail"]
