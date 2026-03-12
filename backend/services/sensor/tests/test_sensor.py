import uuid
from unittest.mock import AsyncMock
from sqlalchemy import text
import trino.exceptions

import models
import schemas
import main as _main_module
import crud as _crud_module


def _create_sensor(client, sensor_payload, monkeypatch):
    """Helper: patch billing check and create a sensor via the API."""
    monkeypatch.setattr(_main_module, "check_billing_active", AsyncMock(return_value=True))
    response = client.post("/sensors/", json=sensor_payload)
    assert response.status_code == 201
    return response.json()


def test_postgres_connectivity(db_session):
    result = db_session.execute(text("SELECT 1"))
    assert result.scalar() == 1


def test_onboard_sensor(client, sensor_payload, monkeypatch):
    data = _create_sensor(client, sensor_payload, monkeypatch)
    assert data["sensor_name"] == sensor_payload["sensor_name"]
    assert data["tenant_id"] == sensor_payload["tenant_id"]
    assert data["status"] == "active"
    assert data["message_count"] == 0
    assert "sensor_id" in data


def test_onboard_sensor_no_billing(client, sensor_payload, monkeypatch):
    monkeypatch.setattr(_main_module, "check_billing_active", AsyncMock(return_value=False))
    response = client.post("/sensors/", json=sensor_payload)
    assert response.status_code == 403
    assert response.json()["detail"] == "Active billing required to onboard sensor"


def test_onboard_sensor_unauthorized_tenant(client, mock_user, monkeypatch):
    monkeypatch.setattr(_main_module, "check_billing_active", AsyncMock(return_value=True))
    # mock_user has tenant_id=1; send a payload with a different tenant
    payload = {
        "tenant_id": mock_user.tenant_id + 9999,
        "sensor_name": "BadSensor",
        "sensor_type": "temp",
    }
    response = client.post("/sensors/", json=payload)
    assert response.status_code == 403
    assert response.json()["detail"] == "Not authorized for this tenant"


def test_list_sensors(client, sensor_payload, mock_user, monkeypatch):
    _create_sensor(client, sensor_payload, monkeypatch)
    response = client.get(f"/sensors/?tenant_id={mock_user.tenant_id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["sensor_name"] == sensor_payload["sensor_name"]


def test_list_sensors_unauthorized_tenant(client, mock_user, monkeypatch):
    _create_sensor(client, sensor_payload={"tenant_id": mock_user.tenant_id,
                                           "sensor_name": "S1", "sensor_type": "temp"},
                   monkeypatch=monkeypatch)
    # Request sensors for a tenant the current user doesn't belong to
    response = client.get(f"/sensors/?tenant_id={mock_user.tenant_id + 9999}")
    assert response.status_code == 403
    assert response.json()["detail"] == "Not authorized for this tenant"


def test_delete_sensor(client, sensor_payload, monkeypatch):
    sensor = _create_sensor(client, sensor_payload, monkeypatch)
    sensor_id = sensor["sensor_id"]

    response = client.delete(f"/sensors/{sensor_id}")
    assert response.status_code == 200
    assert response.json()["sensor_id"] == sensor_id


def test_delete_sensor_not_found(client, monkeypatch):
    response = client.delete("/sensors/99999")
    assert response.status_code == 404


def test_delete_sensor_unauthorized(client, db_session, mock_user, monkeypatch):
    """Sensor owned by a different user_id — mock_user must be rejected."""
    sensor = models.Sensor(
        tenant_id=mock_user.tenant_id,
        user_id=9999,  # belongs to someone else
        sensor_name="OtherSensor",
        sensor_type="temp",
        mqtt_token=str(uuid.uuid4()),
        message_count=0,
        status=models.SensorStatus.active,
    )
    db_session.add(sensor)
    db_session.commit()
    db_session.refresh(sensor)

    response = client.delete(f"/sensors/{sensor.sensor_id}")
    assert response.status_code == 403
    assert response.json()["detail"] == "Not authorized"


def test_update_sensor_messages(client, sensor_payload, monkeypatch):
    sensor = _create_sensor(client, sensor_payload, monkeypatch)
    sensor_id = sensor["sensor_id"]

    response = client.post(
        f"/sensors/{sensor_id}/messages", json={"message_increment": 100}
    )
    assert response.status_code == 200
    assert response.json()["message_count"] == 100


def test_update_sensor_messages_unauthorized(client, db_session, mock_user, monkeypatch):
    sensor = models.Sensor(
        tenant_id=mock_user.tenant_id,
        user_id=9999,
        sensor_name="OtherSensor",
        sensor_type="temp",
        mqtt_token=str(uuid.uuid4()),
        message_count=0,
        status=models.SensorStatus.active,
    )
    db_session.add(sensor)
    db_session.commit()
    db_session.refresh(sensor)

    response = client.post(
        f"/sensors/{sensor.sensor_id}/messages", json={"message_increment": 50}
    )
    assert response.status_code == 403


def test_get_sensor_data(client, sensor_payload, monkeypatch):
    mock_data = [
        schemas.SensorDataPoint(timestamp="2025-07-01T12:00:00", value={"temperature": 25.5}),
        schemas.SensorDataPoint(timestamp="2025-07-01T12:01:00", value={"temperature": 26.0}),
    ]
    monkeypatch.setattr(_crud_module, "get_sensor_data", lambda *args: mock_data)

    sensor = _create_sensor(client, sensor_payload, monkeypatch)
    sensor_id = sensor["sensor_id"]

    response = client.get(f"/sensors/{sensor_id}/data")
    assert response.status_code == 200
    data = response.json()
    assert data["sensor_id"] == sensor_id
    assert len(data["data"]) == 2


def test_get_sensor_data_not_found(client):
    response = client.get("/sensors/99999/data")
    assert response.status_code == 404


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["service"] == "sensor"


# ── 1.1 Fix: assert sync_iot_devices is called ────────────────────────────────

def test_onboard_sensor_calls_sync_iot_devices(client, sensor_payload, monkeypatch):
    """sync_iot_devices must be invoked once when a sensor is successfully onboarded."""
    sync_mock = AsyncMock()
    monkeypatch.setattr(_main_module, "check_billing_active", AsyncMock(return_value=True))
    monkeypatch.setattr(_main_module, "sync_iot_devices", sync_mock)

    response = client.post("/sensors/", json=sensor_payload)
    assert response.status_code == 201
    sync_mock.assert_called_once()


def test_delete_sensor_calls_sync_iot_devices(client, sensor_payload, monkeypatch):
    """sync_iot_devices must be invoked once when a sensor is deleted."""
    sync_mock = AsyncMock()
    monkeypatch.setattr(_main_module, "check_billing_active", AsyncMock(return_value=True))
    monkeypatch.setattr(_main_module, "sync_iot_devices", sync_mock)

    sensor = _create_sensor(client, sensor_payload, monkeypatch)
    sync_mock.reset_mock()  # ignore the call from onboarding

    client.delete(f"/sensors/{sensor['sensor_id']}")
    sync_mock.assert_called_once()


# ── 1.2 Pagination ────────────────────────────────────────────────────────────

def test_list_sensors_pagination(client, mock_user, db_session):
    """Create 25 sensors; page 1 (skip=0, limit=10) returns 10; page 3 returns 5."""
    for i in range(25):
        db_session.add(
            models.Sensor(
                tenant_id=mock_user.tenant_id,
                user_id=mock_user.user_id,
                sensor_name=f"Sensor{i:02d}",
                sensor_type="temp",
                mqtt_token=str(uuid.uuid4()),
                message_count=0,
                status=models.SensorStatus.active,
            )
        )
    db_session.commit()

    r1 = client.get(f"/sensors/?tenant_id={mock_user.tenant_id}&skip=0&limit=10")
    assert r1.status_code == 200
    assert len(r1.json()) == 10

    r3 = client.get(f"/sensors/?tenant_id={mock_user.tenant_id}&skip=20&limit=10")
    assert r3.status_code == 200
    assert len(r3.json()) == 5


# ── 1.2 Sensor data via Trino ─────────────────────────────────────────────────

def test_get_sensor_data_filters_by_tenant(client, sensor_payload, monkeypatch):
    """crud.get_sensor_data must be called with the correct sensor_id and tenant_id."""
    captured: dict = {}

    def mock_get_data(sensor_id, tenant_id):
        captured["sensor_id"] = sensor_id
        captured["tenant_id"] = tenant_id
        return []

    monkeypatch.setattr(_main_module, "check_billing_active", AsyncMock(return_value=True))
    monkeypatch.setattr(_crud_module, "get_sensor_data", mock_get_data)

    sensor = _create_sensor(client, sensor_payload, monkeypatch)
    client.get(f"/sensors/{sensor['sensor_id']}/data")

    assert captured["sensor_id"] == sensor["sensor_id"]
    assert captured["tenant_id"] == sensor_payload["tenant_id"]


def test_get_sensor_data_handles_trino_unavailable(client, sensor_payload, monkeypatch):
    """When Trino is unreachable, the endpoint must return 503."""
    monkeypatch.setattr(_main_module, "check_billing_active", AsyncMock(return_value=True))

    def trino_down(*args, **kwargs):
        raise trino.exceptions.DatabaseError("Connection refused")

    monkeypatch.setattr(_crud_module, "get_sensor_data", trino_down)

    sensor = _create_sensor(client, sensor_payload, monkeypatch)
    response = client.get(f"/sensors/{sensor['sensor_id']}/data")
    assert response.status_code == 503
    assert "unavailable" in response.json()["detail"].lower()


# ── 1.2 Role enforcement ──────────────────────────────────────────────────────

def test_admin_can_delete_any_sensor_in_tenant(admin_client, admin_user, db_session):
    """Admin may delete a sensor owned by another user within the same tenant."""
    sensor = models.Sensor(
        tenant_id=admin_user.tenant_id,
        user_id=9999,  # owned by a different user
        sensor_name="OtherSensor",
        sensor_type="temp",
        mqtt_token=str(uuid.uuid4()),
        message_count=0,
        status=models.SensorStatus.active,
    )
    db_session.add(sensor)
    db_session.commit()
    db_session.refresh(sensor)

    response = admin_client.delete(f"/sensors/{sensor.sensor_id}")
    assert response.status_code == 200
    assert response.json()["sensor_id"] == sensor.sensor_id


def test_viewer_cannot_delete_sensor(viewer_client, viewer_user, db_session):
    """Viewer role is never allowed to delete sensors, even their own."""
    sensor = models.Sensor(
        tenant_id=viewer_user.tenant_id,
        user_id=viewer_user.user_id,
        sensor_name="MySensor",
        sensor_type="temp",
        mqtt_token=str(uuid.uuid4()),
        message_count=0,
        status=models.SensorStatus.active,
    )
    db_session.add(sensor)
    db_session.commit()
    db_session.refresh(sensor)

    response = viewer_client.delete(f"/sensors/{sensor.sensor_id}")
    assert response.status_code == 403
    assert "viewer" in response.json()["detail"].lower()


def test_active_billing_required_before_sensor_onboarding(client, sensor_payload, monkeypatch):
    """Explicit test: onboarding a sensor without active billing must return 403."""
    monkeypatch.setattr(_main_module, "check_billing_active", AsyncMock(return_value=False))
    response = client.post("/sensors/", json=sensor_payload)
    assert response.status_code == 403
    assert "billing" in response.json()["detail"].lower()
