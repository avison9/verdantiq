from sqlalchemy import text


def test_postgres_connectivity(db_session):
    result = db_session.execute(text("SELECT 1"))
    assert result.scalar() == 1


def test_create_billing(client, billing_data):
    response = client.post("/billings/", json=billing_data)
    assert response.status_code == 200
    data = response.json()
    assert data["tenant_id"] == billing_data["tenant_id"]
    assert data["frequency"] == billing_data["frequency"]
    assert data["payment_method"] == billing_data["payment_method"]
    assert data["status"] == "active"
    assert data["amount_due"] == 0.0
    assert "id" in data


def test_create_billing_unauthorized_tenant(client, mock_user, billing_data):
    billing_data["tenant_id"] = mock_user.tenant_id + 9999
    response = client.post("/billings/", json=billing_data)
    assert response.status_code == 403
    assert response.json()["detail"] == "Not authorized for this tenant"


def test_subscribe_ml_feature(client, billing_data):
    billing_id = client.post("/billings/", json=billing_data).json()["id"]

    ml_data = {"feature_name": "data_insights", "cost": 10.0}
    response = client.post(f"/billings/{billing_id}/ml-features/", json=ml_data)
    assert response.status_code == 200
    data = response.json()
    assert data["feature_name"] == "data_insights"
    assert data["cost"] == 10.0
    assert data["billing_id"] == billing_id


def test_subscribe_ml_feature_not_found(client):
    response = client.post(
        "/billings/9999/ml-features/", json={"feature_name": "test", "cost": 5.0}
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Billing not found or unauthorized"


def test_record_payment(client, billing_data):
    billing_id = client.post("/billings/", json=billing_data).json()["id"]

    response = client.post(f"/billings/{billing_id}/payment")
    assert response.status_code == 200
    data = response.json()
    assert data["message_count"] == 0
    assert data["sensor_count"] == 0
    assert data["amount_due"] == 0.0
    assert data["status"] == "active"


def test_internal_billing_status_active(client, billing_data, mock_user):
    client.post("/billings/", json=billing_data)
    response = client.get(f"/internal/tenants/{mock_user.tenant_id}/billing-status")
    assert response.status_code == 200
    data = response.json()
    assert data["billing_active"] is True
    assert data["tenant_id"] == mock_user.tenant_id


def test_internal_billing_status_no_billing(client, mock_user):
    response = client.get(f"/internal/tenants/{mock_user.tenant_id}/billing-status")
    assert response.status_code == 200
    assert response.json()["billing_active"] is False


def test_internal_sensor_count_update(client, billing_data, mock_user):
    client.post("/billings/", json=billing_data)
    response = client.patch(
        "/internal/billings/sensor-count",
        json={"tenant_id": mock_user.tenant_id, "delta": 3},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_internal_message_count_update(client, billing_data, mock_user):
    client.post("/billings/", json=billing_data)
    response = client.patch(
        "/internal/billings/message-count",
        json={"tenant_id": mock_user.tenant_id, "increment": 1000},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["service"] == "tenant"
