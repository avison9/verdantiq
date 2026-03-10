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
