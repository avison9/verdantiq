import pytest
from sqlalchemy import text
from fastapi import Request
from datetime import datetime, timedelta
import models
import schemas
import crud
import trino

# Mock Trino query for Iceberg data
def mock_get_sensor_data(sensor_id: int, tenant_id: int):
    return [
        schemas.SensorDataPoint(
            timestamp=datetime(2025, 7, 1, 12, 0),
            payload={"temperature": 25.5, "humidity": 60}
        ),
        schemas.SensorDataPoint(
            timestamp=datetime(2025, 7, 1, 12, 1),
            payload={"temperature": 26.0, "humidity": 58}
        )
    ]

@pytest.fixture
def billing_data():
    return {
        "tenant_id": None,  # Will be set dynamically after user creation
        "frequency": "monthly",
        "payment_method": "credit_card",
        "due_date": (datetime.utcnow() + timedelta(days=30)).isoformat()
    }

@pytest.fixture
def sensor_data():
    return {
        "name": "SoilSensor1",
        "tenant_id": None,  # Will be set dynamically
        "user_id": None     # Will be set dynamically
    }

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
    response = client.post("/register", json=user_data)
    assert response.status_code == 200
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
    response = client.post("/register", json=user_data)
    assert response.status_code == 200
    user_id = response.json()["user_id"]

    login_response = client.post("/login", json=login_data)
    assert login_response.status_code == 200
    token = login_response.cookies.get("access_token")
    assert token is not None

    cookies = {"access_token": token}
    response = client.get("/users/me", cookies=cookies)
    assert response.status_code == 200

    data = response.json()
    assert data["email"] == user_data["email"]
    assert data["profile"]["role"] == user_data["user_profile"]["role"]

def test_update_user_me(client, user_data, login_data):
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

    cookies = {"access_token": token}
    response = client.put("/users/me", json=update_data, cookies=cookies)

    assert response.status_code == 200
    json_resp = response.json()
    assert json_resp["email"] == "newemail@example.com"
    assert json_resp["first_name"] == "Jane"
    assert json_resp["profile"]["role"] == "manager"

def test_logout(client, user_data, login_data):
    client.post("/register", json=user_data)
    login_response = client.post("/login", json=login_data)
    token = login_response.cookies.get("access_token")
    cookies = {"access_token": token}
    response = client.post("/logout", cookies=cookies)
    assert response.status_code == 200
    assert response.json()["message"] == "Logged out successfully"

    response = client.get("/users/me", cookies=cookies)
    assert response.status_code == 401

def test_create_billing(client, user_data, login_data, billing_data, db_session):
    response = client.post("/register", json=user_data)
    assert response.status_code == 200
    user = response.json()
    tenant_id = user["tenant_id"]
    billing_data["tenant_id"] = tenant_id

    login_response = client.post("/login", json=login_data)
    token = login_response.cookies.get("access_token")
    cookies = {"access_token": token}

    response = client.post("/billings/", json=billing_data, cookies=cookies)
    assert response.status_code == 200
    data = response.json()
    assert data["tenant_id"] == tenant_id
    assert data["frequency"] == billing_data["frequency"]
    assert data["payment_method"] == billing_data["payment_method"]
    assert data["status"] == "active"
    assert data["amount_due"] == 0.0

def test_create_billing_unauthorized_tenant(client, user_data, login_data, billing_data):
    client.post("/register", json=user_data)
    login_response = client.post("/login", json=login_data)
    token = login_response.cookies.get("access_token")
    cookies = {"access_token": token}

    billing_data["tenant_id"] = 999
    response = client.post("/billings/", json=billing_data, cookies=cookies)
    assert response.status_code == 403
    assert response.json()["detail"] == "User not authorized for this tenant"

def test_subscribe_ml_feature(client, user_data, login_data, billing_data):
    response = client.post("/register", json=user_data)
    tenant_id = response.json()["tenant_id"]
    billing_data["tenant_id"] = tenant_id

    login_response = client.post("/login", json=login_data)
    token = login_response.cookies.get("access_token")
    cookies = {"access_token": token}

    billing_response = client.post("/billings/", json=billing_data, cookies=cookies)
    billing_id = billing_response.json()["id"]

    ml_feature_data = {"feature_name": "data_insights", "cost": 10.0}
    response = client.post(f"/billings/{billing_id}/ml-features/", json=ml_feature_data, cookies=cookies)
    assert response.status_code == 200
    data = response.json()
    assert data["feature_name"] == ml_feature_data["feature_name"]
    assert data["cost"] == ml_feature_data["cost"]
    assert data["billing_id"] == billing_id

def test_subscribe_ml_feature_unauthorized(client, user_data, login_data, billing_data):
    client.post("/register", json=user_data)
    login_response = client.post("/login", json=login_data)
    token = login_response.cookies.get("access_token")
    cookies = {"access_token": token}

    ml_feature_data = {"feature_name": "data_insights", "cost": 10.0}
    response = client.post("/billings/999/ml-features/", json=ml_feature_data, cookies=cookies)
    assert response.status_code == 404
    assert response.json()["detail"] == "Billing not found or unauthorized"

def test_record_payment(client, user_data, login_data, billing_data, db_session):
    response = client.post("/register", json=user_data)
    tenant_id = response.json()["tenant_id"]
    billing_data["tenant_id"] = tenant_id

    login_response = client.post("/login", json=login_data)
    token = login_response.cookies.get("access_token")
    cookies = {"access_token": token}

    billing_response = client.post("/billings/", json=billing_data, cookies=cookies)
    billing_id = billing_response.json()["id"]

    response = client.post(f"/billings/{billing_id}/payment", cookies=cookies)
    assert response.status_code == 200
    data = response.json()
    assert data["message_count"] == 0
    assert data["sensor_count"] == 0
    assert data["amount_due"] == 0.0
    assert data["status"] == "active"

def test_onboard_sensor(client, user_data, login_data, billing_data, sensor_data):
    response = client.post("/register", json=user_data)
    user = response.json()
    tenant_id = user["tenant_id"]
    user_id = user["user_id"]
    billing_data["tenant_id"] = tenant_id
    sensor_data["tenant_id"] = tenant_id
    sensor_data["user_id"] = user_id

    login_response = client.post("/login", json=login_data)
    token = login_response.cookies.get("access_token")
    cookies = {"access_token": token}

    client.post("/billings/", json=billing_data, cookies=cookies)

    response = client.post("/sensors/", json=sensor_data, cookies=cookies)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == sensor_data["name"]
    assert data["tenant_id"] == tenant_id
    assert data["user_id"] == user_id
    assert data["status"] == "inactive"
    assert data["message_count"] == 0

def test_onboard_sensor_no_billing(client, user_data, login_data, sensor_data):
    response = client.post("/register", json=user_data)
    user = response.json()
    tenant_id = user["tenant_id"]
    user_id = user["user_id"]
    sensor_data["tenant_id"] = tenant_id
    sensor_data["user_id"] = user_id

    login_response = client.post("/login", json=login_data)
    token = login_response.cookies.get("access_token")
    cookies = {"access_token": token}

    response = client.post("/sensors/", json=sensor_data, cookies=cookies)
    assert response.status_code == 403
    assert response.json()["detail"] == "Active billing required to onboard sensor"

def test_list_sensors(client, user_data, login_data, billing_data, sensor_data):
    response = client.post("/register", json=user_data)
    user = response.json()
    tenant_id = user["tenant_id"]
    user_id = user["user_id"]
    billing_data["tenant_id"] = tenant_id
    sensor_data["tenant_id"] = tenant_id
    sensor_data["user_id"] = user_id

    login_response = client.post("/login", json=login_data)
    token = login_response.cookies.get("access_token")
    cookies = {"access_token": token}

    client.post("/billings/", json=billing_data, cookies=cookies)
    client.post("/sensors/", json=sensor_data, cookies=cookies)

    response = client.get(f"/sensors/?tenant_id={tenant_id}", cookies=cookies)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["name"] == sensor_data["name"]
    assert data[0]["tenant_id"] == tenant_id

def test_list_sensors_unauthorized(client, user_data, login_data, billing_data, sensor_data):
    response = client.post("/register", json=user_data)
    user = response.json()
    tenant_id = user["tenant_id"]
    user_id = user["user_id"]
    billing_data["tenant_id"] = tenant_id
    sensor_data["tenant_id"] = tenant_id
    sensor_data["user_id"] = user_id

    login_response = client.post("/login", json=login_data)
    token = login_response.cookies.get("access_token")
    cookies = {"access_token": token}

    client.post("/billings/", json=billing_data, cookies=cookies)
    client.post("/sensors/", json=sensor_data, cookies=cookies)

    response = client.get("/sensors/?tenant_id=999", cookies=cookies)
    assert response.status_code == 403
    assert response.json()["detail"] == "User not authorized for this tenant"

def test_remove_sensor(client, user_data, login_data, billing_data, sensor_data):
    response = client.post("/register", json=user_data)
    user = response.json()
    tenant_id = user["tenant_id"]
    user_id = user["user_id"]
    billing_data["tenant_id"] = tenant_id
    sensor_data["tenant_id"] = tenant_id
    sensor_data["user_id"] = user_id

    login_response = client.post("/login", json=login_data)
    token = login_response.cookies.get("access_token")
    cookies = {"access_token": token}

    client.post("/billings/", json=billing_data, cookies=cookies)
    sensor_response = client.post("/sensors/", json=sensor_data, cookies=cookies)
    sensor_id = sensor_response.json()["id"]

    response = client.delete(f"/sensors/{sensor_id}", cookies=cookies)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == sensor_id

    response = client.get(f"/sensors/{sensor_id}/data", cookies=cookies)
    assert response.status_code == 404

def test_remove_sensor_unauthorized(client, user_data, login_data, billing_data, sensor_data, db_session):
    response = client.post("/register", json=user_data)
    user = response.json()
    tenant_id = user["tenant_id"]
    user_id = user["user_id"]
    billing_data["tenant_id"] = tenant_id
    sensor_data["tenant_id"] = tenant_id
    sensor_data["user_id"] = user_id

    login_response = client.post("/login", json=login_data)
    token = login_response.cookies.get("access_token")
    cookies = {"access_token": token}

    client.post("/billings/", json=billing_data, cookies=cookies)
    sensor_response = client.post("/sensors/", json=sensor_data, cookies=cookies)
    sensor_id = sensor_response.json()["id"]

    new_user_data = user_data.copy()
    new_user_data["email"] = "newuser@example.com"
    new_user_data["tenant_name"] = "new_tenant"
    client.post("/register", json=new_user_data)
    new_login_data = {"email": "newuser@example.com", "password": user_data["password"]}
    new_login_response = client.post("/login", json=new_login_data)
    new_token = new_login_response.cookies.get("access_token")
    new_cookies = {"access_token": new_token}

    response = client.delete(f"/sensors/{sensor_id}", cookies=new_cookies)
    assert response.status_code == 403
    assert response.json()["detail"] == "User not authorized to delete this sensor"

def test_update_sensor_messages(client, user_data, login_data, billing_data, sensor_data, db_session):
    response = client.post("/register", json=user_data)
    user = response.json()
    tenant_id = user["tenant_id"]
    user_id = user["user_id"]
    billing_data["tenant_id"] = tenant_id
    sensor_data["tenant_id"] = tenant_id
    sensor_data["user_id"] = user_id

    login_response = client.post("/login", json=login_data)
    token = login_response.cookies.get("access_token")
    cookies = {"access_token": token}

    client.post("/billings/", json=billing_data, cookies=cookies)
    sensor_response = client.post("/sensors/", json=sensor_data, cookies=cookies)
    sensor_id = sensor_response.json()["id"]

    message_data = {"message_increment": 100}
    response = client.post(f"/sensors/{sensor_id}/messages", json=message_data, cookies=cookies)
    assert response.status_code == 200
    data = response.json()
    assert data["message_count"] == 100

    billing = db_session.query(models.Billing).filter(models.Billing.tenant_id == tenant_id).first()
    assert billing.message_count == 100
    assert billing.amount_due == 100 * crud.SENSOR_MESSAGE_COST + 1 * crud.SENSOR_ONBOARD_FEE

def test_get_sensor_data(client, user_data, login_data, billing_data, sensor_data, monkeypatch):
    monkeypatch.setattr(crud, "get_sensor_data", mock_get_sensor_data)

    response = client.post("/register", json=user_data)
    user = response.json()
    tenant_id = user["tenant_id"]
    user_id = user["user_id"]
    billing_data["tenant_id"] = tenant_id
    sensor_data["tenant_id"] = tenant_id
    sensor_data["user_id"] = user_id

    login_response = client.post("/login", json=login_data)
    token = login_response.cookies.get("access_token")
    cookies = {"access_token": token}

    client.post("/billings/", json=billing_data, cookies=cookies)
    sensor_response = client.post("/sensors/", json=sensor_data, cookies=cookies)
    sensor_id = sensor_response.json()["id"]

    response = client.get(f"/sensors/{sensor_id}/data", cookies=cookies)
    assert response.status_code == 200
    data = response.json()
    assert data["sensor_id"] == sensor_id
    assert data["tenant_id"] == tenant_id
    assert len(data["data"]) == 2
    assert data["data"][0]["payload"]["temperature"] == 25.5
    assert data["data"][1]["payload"]["temperature"] == 26.0

def test_get_sensor_data_unauthorized(client, user_data, login_data, billing_data, sensor_data):
    response = client.post("/register", json=user_data)
    user = response.json()
    tenant_id = user["tenant_id"]
    user_id = user["user_id"]
    billing_data["tenant_id"] = tenant_id
    sensor_data["tenant_id"] = tenant_id
    sensor_data["user_id"] = user_id

    login_response = client.post("/login", json=login_data)
    token = login_response.cookies.get("access_token")
    cookies = {"access_token": token}

    client.post("/billings/", json=billing_data, cookies=cookies)
    sensor_response = client.post("/sensors/", json=sensor_data, cookies=cookies)
    sensor_id = sensor_response.json()["id"]

    new_user_data = user_data.copy()
    new_user_data["email"] = "newuser@example.com"
    new_user_data["tenant_name"] = "new_tenant"
    client.post("/register", json=new_user_data)
    new_login_data = {"email": "newuser@example.com", "password": user_data["password"]}
    new_login_response = client.post("/login", json=new_login_data)
    new_token = new_login_response.cookies.get("access_token")
    new_cookies = {"access_token": new_token}

    response = client.get(f"/sensors/{sensor_id}/data", cookies=new_cookies)
    assert response.status_code == 403
    assert response.json()["detail"] == "User not authorized to view this sensor's data"

# fast_api/test-services/tests/test_services.py
def test_tenant_iot_devices_sync(client, user_data, login_data, billing_data, sensor_data, db_session):
    response = client.post("/register", json=user_data)
    user = response.json()
    tenant_id = user["tenant_id"]
    user_id = user["user_id"]
    billing_data["tenant_id"] = tenant_id
    sensor_data["tenant_id"] = tenant_id
    sensor_data["user_id"] = user_id

    login_response = client.post("/login", json=login_data)
    token = login_response.cookies.get("access_token")
    client.cookies.set("access_token", token)  

    client.post("/billings/", json=billing_data)
    sensor_response = client.post("/sensors/", json=sensor_data)
    sensor_id = sensor_response.json()["id"]

    tenant_profile = db_session.query(models.TenantProfile).filter(models.TenantProfile.tenant_id == tenant_id).first()
    assert tenant_profile.iot_devices is not None
    assert len(tenant_profile.iot_devices) == 1
    assert tenant_profile.iot_devices[0]["sensor_id"] == sensor_id
    assert tenant_profile.iot_devices[0]["name"] == sensor_data["name"]
    assert tenant_profile.iot_devices[0]["status"] == "inactive"

    message_data = {"message_increment": 100}
    client.post(f"/sensors/{sensor_id}/messages", json=message_data)

    tenant_profile = db_session.query(models.TenantProfile).filter(models.TenantProfile.tenant_id == tenant_id).first()
    assert len(tenant_profile.iot_devices) == 1
    assert tenant_profile.iot_devices[0]["sensor_id"] == sensor_id
    assert tenant_profile.iot_devices[0]["status"] == "inactive"

    delete_response = client.delete(f"/sensors/{sensor_id}")
    print(f"Delete response: {delete_response.status_code}, {delete_response.json()}")  
    tenant_profile = db_session.query(models.TenantProfile).filter(models.TenantProfile.tenant_id == tenant_id).first()
    print(f"iot_devices after delete: {tenant_profile.iot_devices}")  
    # assert tenant_profile.iot_devices == [] or tenant_profile.iot_devices is None