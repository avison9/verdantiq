from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List
import models
import schemas
import crud
from authenticate import decode_access_token
from configs import get_db

app = FastAPI(title="VerdantIQ Tenant Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    crud.update_sensor_count(db, data.tenant_id, data.delta)
    return {"status": "ok"}


@app.patch("/internal/billings/message-count")
async def update_message_count(data: schemas.MessageCountUpdate, db: Session = Depends(get_db)):
    crud.update_message_count(db, data.tenant_id, data.increment)
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
