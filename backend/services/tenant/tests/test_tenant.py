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
    """update_sensor_count with no billing row returns (None, False) gracefully."""
    import crud
    billing, newly_suspended = crud.update_sensor_count(db_session, tenant_id=999999, delta=5)
    assert billing is None
    assert newly_suspended is False


def test_update_message_count_no_billing(db_session):
    """update_message_count with no billing row returns (None, False) gracefully."""
    import crud
    billing, newly_suspended = crud.update_message_count(db_session, tenant_id=999999, increment=100)
    assert billing is None
    assert newly_suspended is False


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


# ── Billing top-up & transactions ────────────────────────────────────────────

TOPUP_CARD = {
    "amount": 50.0,
    "payment_method": "credit_card",
    "cardholder_name": "Jane Farm",
    "card_number": "4111111111111111",
    "card_expiry": "12/27",
    "card_cvv": "123",
}


# ── CRUD-level unit tests ─────────────────────────────────────────────────────

def test_topup_creates_billing_when_none_exists(db_session, mock_user):
    """topup_billing creates a new Billing row when tenant has none."""
    import crud, schemas
    req = schemas.BillingTopUpRequest(**TOPUP_CARD)
    billing = crud.topup_billing(db_session, mock_user.tenant_id, req)

    assert billing.id is not None
    assert billing.tenant_id == mock_user.tenant_id
    assert billing.balance == 50.0
    assert billing.status == "active"
    assert billing.payment_method == "credit_card"


def test_topup_adds_to_existing_balance(db_session, mock_user, billing_data):
    """Second topup accumulates balance; does not reset existing value."""
    import crud, schemas, models
    from datetime import timedelta, timezone

    existing = models.Billing(
        tenant_id=mock_user.tenant_id,
        status=models.BillingStatus.INACTIVE,
        frequency=models.BillingFrequency.MONTHLY,
        payment_method="credit_card",
        balance=20.0,
        amount_due=0.0,
        due_date=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=30),
    )
    db_session.add(existing)
    db_session.commit()

    req = schemas.BillingTopUpRequest(**TOPUP_CARD)
    billing = crud.topup_billing(db_session, mock_user.tenant_id, req)

    assert billing.balance == 70.0  # 20 existing + 50 topup


def test_topup_activates_inactive_billing(db_session, mock_user):
    """An inactive billing record becomes active after a topup."""
    import crud, schemas, models
    from datetime import timedelta, timezone

    existing = models.Billing(
        tenant_id=mock_user.tenant_id,
        status=models.BillingStatus.INACTIVE,
        frequency=models.BillingFrequency.MONTHLY,
        payment_method="credit_card",
        balance=0.0,
        amount_due=0.0,
        due_date=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=30),
    )
    db_session.add(existing)
    db_session.commit()

    req = schemas.BillingTopUpRequest(**TOPUP_CARD)
    billing = crud.topup_billing(db_session, mock_user.tenant_id, req)

    assert billing.status == "active"


def test_topup_creates_credit_transaction(db_session, mock_user):
    """topup_billing writes one credit Transaction row with correct fields."""
    import crud, schemas, models

    req = schemas.BillingTopUpRequest(**TOPUP_CARD)
    billing = crud.topup_billing(db_session, mock_user.tenant_id, req)

    txs = db_session.query(models.Transaction).filter_by(billing_id=billing.id).all()
    assert len(txs) == 1
    tx = txs[0]
    assert tx.type == models.TransactionType.CREDIT
    assert tx.amount == 50.0
    assert tx.balance_after == 50.0
    assert tx.card_last4 == "1111"
    assert tx.card_brand == "Visa"
    assert tx.reference is not None and tx.reference.startswith("TXN-")


def test_topup_paypal_creates_correct_description(db_session, mock_user):
    """PayPal topup stores the payer email in the transaction description."""
    import crud, schemas

    req = schemas.BillingTopUpRequest(
        amount=30.0,
        payment_method="paypal",
        payer_email="jane@farm.com",
    )
    billing = crud.topup_billing(db_session, mock_user.tenant_id, req)

    import models
    tx = db_session.query(models.Transaction).filter_by(billing_id=billing.id).first()
    assert "PayPal" in tx.description
    assert "jane@farm.com" in tx.description
    assert tx.card_last4 is None


def test_topup_bank_transfer_with_reference(db_session, mock_user):
    """Wire transfer topup includes reference in description."""
    import crud, schemas

    req = schemas.BillingTopUpRequest(
        amount=100.0,
        payment_method="bank_transfer",
        reference="REF-ABC123",
    )
    billing = crud.topup_billing(db_session, mock_user.tenant_id, req)

    import models
    tx = db_session.query(models.Transaction).filter_by(billing_id=billing.id).first()
    assert "Wire Transfer" in tx.description
    assert "REF-ABC123" in tx.description


def test_topup_skrill_stores_email(db_session, mock_user):
    import crud, schemas, models

    req = schemas.BillingTopUpRequest(
        amount=25.0,
        payment_method="skrill",
        payer_email="user@skrill.com",
    )
    billing = crud.topup_billing(db_session, mock_user.tenant_id, req)
    tx = db_session.query(models.Transaction).filter_by(billing_id=billing.id).first()
    assert "Skrill" in tx.description
    assert billing.payment_method == "skrill"


def test_topup_revolut_stores_email(db_session, mock_user):
    import crud, schemas, models

    req = schemas.BillingTopUpRequest(
        amount=40.0,
        payment_method="revolut",
        payer_email="user@revolut.com",
    )
    billing = crud.topup_billing(db_session, mock_user.tenant_id, req)
    tx = db_session.query(models.Transaction).filter_by(billing_id=billing.id).first()
    assert "Revolut" in tx.description


# ── Card brand detection ──────────────────────────────────────────────────────

def test_detect_card_brand_visa():
    import crud
    assert crud._detect_card_brand("4111111111111111") == "Visa"


def test_detect_card_brand_mastercard():
    import crud
    assert crud._detect_card_brand("5111111111111111") == "Mastercard"


def test_detect_card_brand_amex():
    import crud
    assert crud._detect_card_brand("371449635398431") == "Amex"


def test_detect_card_brand_unknown():
    import crud
    assert crud._detect_card_brand("6011111111111117") == "Card"


# ── get_transactions CRUD ─────────────────────────────────────────────────────

def test_get_transactions_empty_when_no_billing(db_session, mock_user):
    import crud
    page = crud.get_transactions(db_session, billing_id=999999, page=1, per_page=20)
    assert page.total == 0
    assert page.items == []
    assert page.pages == 1


def test_get_transactions_returns_all_and_paginates(db_session, mock_user):
    import crud, schemas

    # Create 25 transactions via 25 topups
    req = schemas.BillingTopUpRequest(**TOPUP_CARD)
    billing = None
    for _ in range(25):
        billing = crud.topup_billing(db_session, mock_user.tenant_id, req)

    page1 = crud.get_transactions(db_session, billing.id, page=1, per_page=20)
    assert page1.total == 25
    assert len(page1.items) == 20
    assert page1.pages == 2

    page2 = crud.get_transactions(db_session, billing.id, page=2, per_page=20)
    assert len(page2.items) == 5


def test_get_transactions_ordered_newest_first(db_session, mock_user):
    import crud, schemas

    req = schemas.BillingTopUpRequest(**{**TOPUP_CARD, "amount": 10.0})
    billing = None
    for _ in range(3):
        billing = crud.topup_billing(db_session, mock_user.tenant_id, req)

    page = crud.get_transactions(db_session, billing.id, page=1, per_page=10)
    dates = [tx.created_at for tx in page.items]
    assert dates == sorted(dates, reverse=True)


# ── API-level tests ───────────────────────────────────────────────────────────

def test_topup_endpoint_creates_billing(client):
    resp = client.post("/billings/topup/", json=TOPUP_CARD)
    assert resp.status_code == 200
    data = resp.json()
    assert data["balance"] == 50.0
    assert data["status"] == "active"
    assert data["payment_method"] == "credit_card"


def test_topup_endpoint_accumulates_balance(client):
    client.post("/billings/topup/", json=TOPUP_CARD)
    resp = client.post("/billings/topup/", json=TOPUP_CARD)
    assert resp.status_code == 200
    assert resp.json()["balance"] == 100.0


def test_topup_endpoint_rejects_zero_amount(client):
    resp = client.post("/billings/topup/", json={**TOPUP_CARD, "amount": 0})
    assert resp.status_code == 422


def test_topup_endpoint_rejects_negative_amount(client):
    resp = client.post("/billings/topup/", json={**TOPUP_CARD, "amount": -10})
    assert resp.status_code == 422


def test_topup_endpoint_paypal(client):
    payload = {"amount": 75.0, "payment_method": "paypal", "payer_email": "p@example.com"}
    resp = client.post("/billings/topup/", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["balance"] == 75.0
    assert data["payment_method"] == "paypal"


def test_topup_endpoint_skrill(client):
    payload = {"amount": 20.0, "payment_method": "skrill", "payer_email": "s@example.com"}
    resp = client.post("/billings/topup/", json=payload)
    assert resp.status_code == 200


def test_topup_endpoint_revolut(client):
    payload = {"amount": 35.0, "payment_method": "revolut", "payer_email": "r@example.com"}
    resp = client.post("/billings/topup/", json=payload)
    assert resp.status_code == 200


def test_topup_endpoint_wire_transfer(client):
    payload = {"amount": 200.0, "payment_method": "bank_transfer", "reference": "WIRE-001"}
    resp = client.post("/billings/topup/", json=payload)
    assert resp.status_code == 200


def test_transactions_endpoint_empty_no_billing(client):
    resp = client.get("/billings/transactions/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []


def test_transactions_endpoint_after_topup(client):
    client.post("/billings/topup/", json=TOPUP_CARD)
    resp = client.get("/billings/transactions/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    tx = data["items"][0]
    assert tx["type"] == "credit"
    assert tx["amount"] == 50.0
    assert tx["card_last4"] == "1111"
    assert tx["card_brand"] == "Visa"
    assert tx["reference"].startswith("TXN-")


def test_transactions_endpoint_pagination(client):
    for _ in range(15):
        client.post("/billings/topup/", json=TOPUP_CARD)

    resp = client.get("/billings/transactions/?page=1&per_page=10")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 15
    assert len(data["items"]) == 10
    assert data["pages"] == 2


def test_transactions_endpoint_invalid_per_page_too_low(client):
    resp = client.get("/billings/transactions/?per_page=5")
    assert resp.status_code == 422


def test_transactions_endpoint_invalid_per_page_too_high(client):
    resp = client.get("/billings/transactions/?per_page=101")
    assert resp.status_code == 422


def test_billing_response_includes_balance_field(client, billing_data):
    resp = client.post("/billings/", json=billing_data)
    assert resp.status_code == 200
    assert "balance" in resp.json()
    assert resp.json()["balance"] == 0.0


def test_get_billing_after_topup_shows_updated_balance(client):
    client.post("/billings/topup/", json=TOPUP_CARD)
    resp = client.get("/billings/")
    assert resp.status_code == 200
    assert resp.json()["balance"] == 50.0


# ══════════════════════════════════════════════════════════════════════════════
# Suspension: amount_due preserved when running cost exceeds balance
# ══════════════════════════════════════════════════════════════════════════════

def _make_billing(db_session, tenant_id, balance, amount_due, frequency="monthly", status="active"):
    """Insert a Billing row directly for unit-test setup."""
    from datetime import timedelta, timezone
    billing = models.Billing(
        tenant_id=tenant_id,
        status=models.BillingStatus.ACTIVE if status == "active" else models.BillingStatus.SUSPENDED,
        frequency=models.BillingFrequency.MONTHLY if frequency == "monthly"
                  else models.BillingFrequency.DAILY if frequency == "daily"
                  else models.BillingFrequency.WEEKLY,
        payment_method="credit_card",
        balance=balance,
        amount_due=amount_due,
        message_count=0,
        sensor_count=0,
        due_date=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=30),
    )
    db_session.add(billing)
    db_session.commit()
    db_session.refresh(billing)
    return billing


def test_amount_due_preserved_when_suspended_by_messages(db_session, mock_user):
    """When messages push amount_due above balance the billing is suspended and
    amount_due is NOT zeroed — it is frozen so the debt survives to cycle end."""
    import crud

    # Balance = $0.10, one message costs $0.000001 — but many will exceed it
    billing = _make_billing(db_session, mock_user.tenant_id, balance=0.10, amount_due=0.0)

    # Incrementing 200 000 messages → amount_due ~ $0.20 > $0.10 balance
    updated, newly_suspended = crud.update_message_count(
        db_session, mock_user.tenant_id, increment=200_000
    )

    assert newly_suspended is True
    assert updated.status == models.BillingStatus.SUSPENDED
    # amount_due must be positive and frozen — not reset to 0
    assert updated.amount_due > 0
    assert updated.amount_due > updated.balance


def test_amount_due_preserved_when_suspended_by_sensors(db_session, mock_user):
    """Adding sensors beyond what balance can cover suspends billing and
    freezes amount_due for later deduction."""
    import crud

    # Balance = $0.50, each sensor costs $1.00 → 1 sensor already exceeds balance
    billing = _make_billing(db_session, mock_user.tenant_id, balance=0.50, amount_due=0.0)

    updated, newly_suspended = crud.update_sensor_count(
        db_session, mock_user.tenant_id, delta=1
    )

    assert newly_suspended is True
    assert updated.status == models.BillingStatus.SUSPENDED
    assert updated.amount_due > 0
    assert updated.amount_due > updated.balance


def test_amount_due_not_recalculated_while_suspended(db_session, mock_user):
    """After suspension, further message increments must NOT recalculate or clear amount_due
    — the frozen debt value must remain unchanged."""
    import crud

    # Start already suspended with a known frozen debt
    frozen_debt = 5.00
    billing = _make_billing(
        db_session, mock_user.tenant_id,
        balance=0.0, amount_due=frozen_debt, status="suspended"
    )

    # More messages arrive during the suspended window
    updated, newly_suspended = crud.update_message_count(
        db_session, mock_user.tenant_id, increment=50_000
    )

    # Not newly suspended (was already suspended)
    assert newly_suspended is False
    # amount_due must still equal the frozen value — messages didn't change it
    assert updated.amount_due == frozen_debt
    # message_count still incremented (for record-keeping)
    assert updated.message_count == 50_000


def test_process_billing_cycle_deducts_frozen_amount_due(db_session, mock_user):
    """process_billing_cycle must deduct the frozen amount_due from balance
    even when billing is in SUSPENDED state (end-of-cycle settlement)."""
    import crud, schemas

    # Billing is suspended: amount_due=$5, balance=$3 → deduct $3 (max available)
    billing = _make_billing(
        db_session, mock_user.tenant_id,
        balance=3.00, amount_due=5.00, status="suspended"
    )

    result = crud.process_billing_cycle(
        db_session, mock_user.tenant_id, schemas.BillingProcessCycleRequest()
    )

    assert result.balance == 0.0          # $3 fully consumed
    assert result.amount_due == 0.0       # reset after cycle
    assert result.message_count == 0      # reset after cycle


def test_process_billing_cycle_stays_suspended_when_balance_zero(db_session, mock_user):
    """After a cycle where balance is fully consumed, billing remains SUSPENDED."""
    import crud, schemas

    billing = _make_billing(
        db_session, mock_user.tenant_id,
        balance=2.00, amount_due=5.00, status="suspended"
    )

    result = crud.process_billing_cycle(
        db_session, mock_user.tenant_id, schemas.BillingProcessCycleRequest()
    )

    assert result.status == models.BillingStatus.SUSPENDED
    assert result.balance == 0.0


def test_process_billing_cycle_reactivates_when_balance_remains(db_session, mock_user):
    """After a cycle where balance > amount_due, billing becomes ACTIVE again."""
    import crud, schemas

    billing = _make_billing(
        db_session, mock_user.tenant_id,
        balance=20.00, amount_due=5.00, status="suspended"
    )

    result = crud.process_billing_cycle(
        db_session, mock_user.tenant_id, schemas.BillingProcessCycleRequest()
    )

    assert result.status == models.BillingStatus.ACTIVE
    assert result.balance == pytest.approx(15.00)
    assert result.amount_due == 0.0


def test_process_billing_cycle_creates_debit_transaction(db_session, mock_user):
    """process_billing_cycle must write a DEBIT Transaction row with correct amount."""
    import crud, schemas

    billing = _make_billing(
        db_session, mock_user.tenant_id,
        balance=10.00, amount_due=4.00
    )
    billing.message_count = 1000
    db_session.commit()

    crud.process_billing_cycle(
        db_session, mock_user.tenant_id, schemas.BillingProcessCycleRequest()
    )

    txs = db_session.query(models.Transaction).filter_by(billing_id=billing.id).all()
    assert len(txs) == 1
    tx = txs[0]
    assert tx.type == models.TransactionType.DEBIT
    assert tx.amount == pytest.approx(4.00)
    assert tx.balance_after == pytest.approx(6.00)
    assert tx.data_points == 1000
    assert tx.reference.startswith("CYCLE-")


def test_process_billing_cycle_advances_due_date(db_session, mock_user):
    """After cycle processing, due_date must advance by one billing period."""
    import crud, schemas

    billing = _make_billing(
        db_session, mock_user.tenant_id,
        balance=50.00, amount_due=2.00
    )
    old_due = billing.due_date

    crud.process_billing_cycle(
        db_session, mock_user.tenant_id, schemas.BillingProcessCycleRequest()
    )

    db_session.refresh(billing)
    assert billing.due_date > old_due


# ══════════════════════════════════════════════════════════════════════════════
# Daily billing cycle
# ══════════════════════════════════════════════════════════════════════════════

def test_calculate_next_due_date_daily():
    """DAILY frequency advances due_date by exactly one day."""
    import crud, models
    base = datetime(2026, 3, 22, 12, 0, 0)
    result = crud.calculate_next_due_date(models.BillingFrequency.DAILY, base)
    assert result.day == 23
    assert result.month == 3
    assert result.year == 2026


def test_calculate_next_due_date_daily_month_boundary():
    """DAILY frequency correctly rolls over to the next month."""
    import crud, models
    base = datetime(2026, 1, 31)
    result = crud.calculate_next_due_date(models.BillingFrequency.DAILY, base)
    assert result.month == 2
    assert result.day == 1


def test_update_billing_frequency_to_daily(client, billing_data):
    """PATCH /billing/frequency accepts 'daily' and updates the record."""
    client.post("/billings/", json=billing_data)

    resp = client.patch("/billings/frequency", json={"frequency": "daily"})
    assert resp.status_code == 200
    assert resp.json()["frequency"] == "daily"


def test_process_billing_cycle_daily_advances_one_day(db_session, mock_user):
    """Cycle processing on a DAILY billing advances due_date by exactly one day."""
    import crud, schemas
    from datetime import timedelta, timezone

    billing = _make_billing(
        db_session, mock_user.tenant_id,
        balance=50.00, amount_due=1.00, frequency="daily"
    )

    before = datetime.now(timezone.utc).replace(tzinfo=None)
    crud.process_billing_cycle(
        db_session, mock_user.tenant_id, schemas.BillingProcessCycleRequest()
    )
    db_session.refresh(billing)

    # due_date must be approximately tomorrow (within a 5-second window of test execution)
    expected = before + timedelta(days=1)
    delta = abs((billing.due_date - expected).total_seconds())
    assert delta < 5


def test_process_billing_cycle_endpoint_accepts_daily(client, billing_data):
    """POST /billings/process-cycle works end-to-end for a DAILY billing."""
    # Setup billing with daily frequency via direct API
    client.post("/billings/", json={**billing_data, "frequency": "daily"})
    client.post("/billings/topup/", json=TOPUP_CARD)  # add balance

    resp = client.post("/billings/process-cycle", json={})
    assert resp.status_code == 200
    data = resp.json()
    assert data["frequency"] == "daily"
