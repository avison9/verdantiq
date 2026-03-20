from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List
import httpx
import models
import schemas
import crud
from authenticate import decode_access_token
from configs import get_db, Base, engine, ALLOWED_ORIGINS, settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    # Idempotent migrations
    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE billings ADD COLUMN IF NOT EXISTS balance FLOAT NOT NULL DEFAULT 0.0"
        ))
        # Convert payment_method from PostgreSQL enum to VARCHAR for extensibility
        conn.execute(text("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='billings'
                      AND column_name='payment_method'
                      AND data_type='USER-DEFINED'
                ) THEN
                    ALTER TABLE billings
                        ALTER COLUMN payment_method TYPE VARCHAR(50)
                        USING payment_method::VARCHAR(50);
                END IF;
            END $$;
        """))
        # Migrate billing_transactions.sensor_id from integer to UUID (VARCHAR 36)
        conn.execute(text("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='billing_transactions'
                      AND column_name='sensor_id'
                      AND data_type='integer'
                ) THEN
                    ALTER TABLE billing_transactions
                        ALTER COLUMN sensor_id TYPE VARCHAR(36) USING sensor_id::VARCHAR;
                END IF;
            END $$;
        """))
        conn.commit()
    yield


app = FastAPI(title="VerdantIQ Tenant Service", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Auth dependency ──────────────────────────────────────────────────────────

async def get_current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No token provided")
    payload = decode_access_token(token)
    user = db.query(models.User).filter(
        models.User.user_id == payload["user_id"],
        models.User.tenant_id == payload["tenant_id"],
    ).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    session = db.query(models.Session).filter(
        models.Session.token == token,
        models.Session.user_id == user.user_id,
        models.Session.status == models.SessionStatus.active,
    ).first()
    if not session or session.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    session.last_active = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    return user


# ─── Public routes ────────────────────────────────────────────────────────────

@app.get("/billings/", response_model=schemas.BillingResponse)
async def get_billing(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    billing = crud.get_billing_by_tenant(db, current_user.tenant_id)
    if not billing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No billing record found")
    return billing


@app.post("/billings/", response_model=schemas.BillingResponse)
async def create_billing(
    billing: schemas.BillingCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.tenant_id != billing.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this tenant")
    return crud.create_billing(db, billing)


@app.post("/billings/{billing_id}/ml-features/", response_model=schemas.MLFeatureSubscriptionResponse)
async def subscribe_ml_feature(
    billing_id: int,
    ml_feature: schemas.MLFeatureSubscriptionCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    billing = crud.get_billing_by_tenant(db, current_user.tenant_id)
    if not billing or billing.id != billing_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billing not found or unauthorized")
    return crud.create_ml_feature_subscription(db, ml_feature, billing_id)


@app.post("/billings/{billing_id}/payment", response_model=schemas.BillingResponse)
async def record_payment(
    billing_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    billing = crud.get_billing_by_tenant(db, current_user.tenant_id)
    if not billing or billing.id != billing_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billing not found or unauthorized")
    return crud.update_billing_on_payment(db, billing)


@app.post("/billings/topup/", response_model=schemas.BillingResponse)
async def topup_billing(
    topup: schemas.BillingTopUpRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if topup.amount <= 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Amount must be positive")
    return crud.topup_billing(db, current_user.tenant_id, topup)


@app.patch("/billings/frequency", response_model=schemas.BillingResponse)
async def update_billing_frequency(
    body: schemas.BillingFrequencyUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    billing = crud.update_billing_frequency(db, current_user.tenant_id, body.frequency)
    if not billing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No billing record found")
    return billing


@app.post("/billings/process-cycle", response_model=schemas.BillingResponse)
async def process_billing_cycle(
    body: schemas.BillingProcessCycleRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return crud.process_billing_cycle(db, current_user.tenant_id, body)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@app.post("/billings/suspend", response_model=schemas.BillingResponse)
async def suspend_billing(
    body: schemas.BillingSuspendRequest = schemas.BillingSuspendRequest(),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Suspend billing when running cost exceeds balance. Locks in amount_due for end-of-cycle deduction."""
    billing = crud.get_billing_by_tenant(db, current_user.tenant_id)
    if not billing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No billing record found")
    billing.status = models.BillingStatus.SUSPENDED
    if body.amount_due > 0:
        billing.amount_due = body.amount_due
    db.commit()
    db.refresh(billing)
    return billing


@app.get("/billing-rates/", response_model=schemas.BillingRateResponse)
async def get_billing_rates(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return crud.get_billing_rate(db)


@app.patch("/billing-rates/", response_model=schemas.BillingRateResponse)
async def update_billing_rates(
    body: schemas.BillingRateUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return crud.update_billing_rate(db, body)


@app.get("/billings/transactions/", response_model=schemas.TransactionPage)
async def get_transactions(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=10, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    billing = crud.get_billing_by_tenant(db, current_user.tenant_id)
    if not billing:
        return schemas.TransactionPage(items=[], total=0, page=page, per_page=per_page, pages=1)
    return crud.get_transactions(db, billing.id, page, per_page)


# ─── Internal helpers ─────────────────────────────────────────────────────────

async def notify_sensor_suspend(tenant_id: int) -> None:
    """Tell the sensor service to deactivate all active sensors for this tenant."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{settings.SENSOR_SERVICE_URL}/internal/sensors/suspend-tenant",
                json={"tenant_id": tenant_id},
            )
    except httpx.RequestError:
        pass  # best-effort; billing is already suspended in DB


# ─── Internal routes (sensor service → tenant service) ───────────────────────
# These are NOT exposed through the Nginx gateway.

@app.get("/internal/tenants/{tenant_id}/billing-status", response_model=schemas.BillingStatusResponse)
async def get_billing_status(tenant_id: int, db: Session = Depends(get_db)):
    billing = crud.get_billing_by_tenant(db, tenant_id)
    return schemas.BillingStatusResponse(
        tenant_id=tenant_id,
        billing_active=billing is not None and billing.status == models.BillingStatus.ACTIVE,
        billing_id=billing.id if billing else None,
    )


@app.patch("/internal/billings/sensor-count")
async def update_sensor_count(data: schemas.SensorCountUpdate, db: Session = Depends(get_db)):
    _, newly_suspended = crud.update_sensor_count(db, data.tenant_id, data.delta)
    if newly_suspended:
        await notify_sensor_suspend(data.tenant_id)
    return {"status": "ok"}


@app.patch("/internal/billings/message-count")
async def update_message_count(data: schemas.MessageCountUpdate, db: Session = Depends(get_db)):
    _, newly_suspended = crud.update_message_count(db, data.tenant_id, data.increment)
    if newly_suspended:
        await notify_sensor_suspend(data.tenant_id)
    return {"status": "ok"}


@app.patch("/internal/tenants/{tenant_id}/iot-devices")
async def sync_iot_devices(
    tenant_id: int,
    data: schemas.IoTDeviceSyncRequest,
    db: Session = Depends(get_db),
):
    from sqlalchemy import Column, Integer, ForeignKey, JSON
    from configs import Base
    tenant_profile = db.query(models.Tenant).filter(
        models.Tenant.tenant_id == tenant_id
    ).first()
    # Update via raw SQL to avoid importing TenantProfile (auth service owns it)
    db.execute(
        __import__("sqlalchemy").text(
            "UPDATE tenant_profiles SET iot_devices = :devices WHERE tenant_id = :tid"
        ),
        {"devices": __import__("json").dumps(data.devices), "tid": tenant_id},
    )
    db.commit()
    return {"status": "ok"}


@app.get("/health")
async def health():
    return {"service": "tenant", "status": "ok"}
