import pytest
from sqlalchemy import text
from models import Session, SessionStatus
from datetime import datetime, timedelta
from fastapi import Request

def test_postgres_connectivity(db_session):
    """Test PostgreSQL connection using test database."""
    result = db_session.execute(text("SELECT 1"))
    assert result.scalar() == 1

def test_create_user_new_tenant(client, user_data):
    response = client.post("/register", json=user_data)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == user_data["email"]
    assert data["first_name"] == user_data["first_name"]
    assert data["profile"]["role"] == user_data["user_profile"]["role"]
    assert data["profile"]["country"] == user_data["user_profile"]["country"]

def test_create_user_existing_tenant(client, user_data, existing_tenant_user_data):
    client.post("/register", json=user_data)
    response = client.post("/register", json=existing_tenant_user_data)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == existing_tenant_user_data["email"]
    assert data["profile"]["role"] == existing_tenant_user_data["user_profile"]["role"]

def test_create_user_duplicate_email(client, user_data):
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

def test_get_user_me(client, user_data, login_data):
    # Register user
    response = client.post("/register", json=user_data)
    assert response.status_code == 200
    user_id = response.json()["user_id"]

    # Login user to get a valid token (session created by the app)
    login_response = client.post("/login", json=login_data)
    assert login_response.status_code == 200
    token = login_response.cookies.get("access_token")
    assert token is not None

    # Access protected endpoint with the token cookie
    cookies = {"access_token": token}
    response = client.get("/users/me", cookies=cookies)
    assert response.status_code == 200

    data = response.json()
    assert data["email"] == user_data["email"]
    assert data["profile"]["role"] == user_data["user_profile"]["role"]


def test_update_user_me(client, user_data, login_data):
    # Register and login to get token
    client.post("/register", json=user_data)
    login_response = client.post("/login", json=login_data)
    token = login_response.cookies.get("access_token")

    update_data = {
        "email": "newemail@example.com",
        "first_name": "Jane",
        "user_profile": {
            "role": "manager",
            "position": "lead agronomist",
            "address": "789 New Lane, Ogun"
        }
    }

    headers = {"Authorization": f"Bearer {token}"}
    response = client.put("/users/me", json=update_data, headers=headers)

    assert response.status_code == 200
    json_resp = response.json()
    assert json_resp["email"] == "newemail@example.com"
    assert json_resp["first_name"] == "Jane"
    assert json_resp["profile"]["role"] == "manager"


def test_logout(client, user_data, login_data):
    client.post("/register", json=user_data)
    login_response = client.post("/login", json=login_data)
    token = login_response.cookies["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post("/logout", headers=headers)
    assert response.status_code == 200
    assert response.json()["message"] == "Logged out successfully"

    response = client.get("/users/me", headers=headers)
    assert response.status_code == 401

