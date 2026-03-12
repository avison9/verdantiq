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


# ── Coverage additions ─────────────────────────────────────────────────────────

import jwt as _pyjwt
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock

_TEST_SECRET = "test-secret-for-ci-only-min-32-bytes!"
_TEST_ALGO = "HS256"


# ── tenant/authenticate.py coverage ─────────────────────────────────────────

def test_decode_token_invalid_jwt():
    from authenticate import decode_access_token
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        decode_access_token("bad.token.here")
    assert exc.value.status_code == 401


def test_decode_token_missing_claims():
    from authenticate import decode_access_token
    from fastapi import HTTPException
    token = _pyjwt.encode({"foo": "bar"}, _TEST_SECRET, algorithm=_TEST_ALGO)
    with pytest.raises(HTTPException) as exc:
        decode_access_token(token)
    assert exc.value.status_code == 401


def test_decode_token_valid():
    from authenticate import decode_access_token
    token = _pyjwt.encode(
        {"sub": "1", "tenant_id": "1",
         "exp": datetime.now(timezone.utc) + timedelta(minutes=30)},
        _TEST_SECRET, algorithm=_TEST_ALGO,
    )
    payload = decode_access_token(token)
    assert payload["user_id"] == 1


# ── tenant/configs.py coverage ───────────────────────────────────────────────

def test_tenant_get_db_yields_and_closes():
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


# ── tenant/crud.py coverage ──────────────────────────────────────────────────

def test_update_sensor_count_no_billing(db_session):
    """update_sensor_count with no billing row returns None gracefully."""
    import crud
    result = crud.update_sensor_count(db_session, tenant_id=999999, delta=5)
    assert result is None


def test_update_message_count_no_billing(db_session):
    """update_message_count with no billing row returns None gracefully."""
    import crud
    result = crud.update_message_count(db_session, tenant_id=999999, increment=100)
    assert result is None


def test_calculate_next_due_date_quarterly():
    import crud, models
    base = datetime(2025, 1, 1)
    result = crud.calculate_next_due_date(models.BillingFrequency.QUARTERLY, base)
    assert result.month == 4


def test_calculate_next_due_date_yearly():
    import crud, models
    base = datetime(2025, 1, 1)
    result = crud.calculate_next_due_date(models.BillingFrequency.YEARLY, base)
    assert result.year == 2026


# ── tenant/main.py coverage ──────────────────────────────────────────────────

@pytest.fixture
def raw_client():
    """TestClient without get_current_user override."""
    from fastapi.testclient import TestClient
    from main import app, get_current_user as _gcu
    overrides_backup = app.dependency_overrides.copy()
    app.dependency_overrides.pop(_gcu, None)
    yield TestClient(app)
    app.dependency_overrides = overrides_backup


def test_tenant_get_current_user_no_token(raw_client):
    resp = raw_client.post("/billings/", json={})
    assert resp.status_code == 401


def test_tenant_get_current_user_invalid_token(raw_client):
    raw_client.cookies.set("access_token", "bad.token.here")
    resp = raw_client.post("/billings/", json={})
    assert resp.status_code == 401


def test_tenant_get_current_user_missing_claims(raw_client):
    token = _pyjwt.encode({"foo": "bar"}, _TEST_SECRET, algorithm=_TEST_ALGO)
    raw_client.cookies.set("access_token", token)
    resp = raw_client.post("/billings/", json={})
    assert resp.status_code == 401


def test_tenant_get_current_user_user_not_found(raw_client):
    token = _pyjwt.encode(
        {"sub": "999999", "tenant_id": "999999",
         "exp": datetime.now(timezone.utc) + timedelta(minutes=30)},
        _TEST_SECRET, algorithm=_TEST_ALGO,
    )
    raw_client.cookies.set("access_token", token)
    resp = raw_client.post("/billings/", json={})
    assert resp.status_code == 401


def test_tenant_get_current_user_expired_session(raw_client, mock_user, db_session):
    import models
    token = _pyjwt.encode(
        {"sub": str(mock_user.user_id), "tenant_id": str(mock_user.tenant_id),
         "exp": datetime.now(timezone.utc) + timedelta(minutes=30)},
        _TEST_SECRET, algorithm=_TEST_ALGO,
    )
    db_session.add(models.Session(
        user_id=mock_user.user_id,
        tenant_id=mock_user.tenant_id,
        token=token,
        expires_at=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=1),
        status=models.SessionStatus.active,
    ))
    db_session.commit()
    raw_client.cookies.set("access_token", token)
    resp = raw_client.post("/billings/", json={})
    assert resp.status_code == 401


def test_tenant_get_current_user_valid_session(raw_client, mock_user, db_session, billing_data):
    import models
    token = _pyjwt.encode(
        {"sub": str(mock_user.user_id), "tenant_id": str(mock_user.tenant_id),
         "exp": datetime.now(timezone.utc) + timedelta(minutes=30)},
        _TEST_SECRET, algorithm=_TEST_ALGO,
    )
    db_session.add(models.Session(
        user_id=mock_user.user_id,
        tenant_id=mock_user.tenant_id,
        token=token,
        expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=30),
        status=models.SessionStatus.active,
    ))
    db_session.commit()
    raw_client.cookies.set("access_token", token)
    resp = raw_client.post("/billings/", json=billing_data)
    assert resp.status_code == 200


def test_record_payment_billing_not_found(client, mock_user):
    resp = client.post("/billings/999999/payment")
    assert resp.status_code == 404


def test_subscribe_ml_billing_id_mismatch(client, billing_data):
    """billing.id != billing_id → 404."""
    billing_id = client.post("/billings/", json=billing_data).json()["id"]
    resp = client.post(f"/billings/{billing_id + 999}/ml-features/",
                       json={"feature_name": "ai", "cost": 5.0})
    assert resp.status_code == 404


def test_sync_iot_devices_internal(client, mock_user):
    """Calling the internal sync endpoint exercises the raw SQL update path."""
    resp = client.patch(
        f"/internal/tenants/{mock_user.tenant_id}/iot-devices",
        json={
            "tenant_id": mock_user.tenant_id,
            "devices": [{"sensor_id": 1, "name": "S1", "status": "active"}],
        },
    )
    assert resp.status_code == 200
