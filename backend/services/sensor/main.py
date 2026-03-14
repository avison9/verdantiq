from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List
import httpx
import trino.exceptions
import models
import schemas
import crud
from authenticate import decode_access_token
from configs import get_db, settings, Base, engine, ALLOWED_ORIGINS


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Pre-create_all migrations (must run before create_all so FK types match) ──
    with engine.connect() as conn:
        # 1. Add pending/error to sensorstatus enum only if the type already exists
        #    (fresh DBs let create_all build the full enum; existing DBs may need backfill)
        conn.execute(text("""
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sensorstatus') THEN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_enum
                        WHERE enumlabel = 'pending'
                          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sensorstatus')
                    ) THEN
                        ALTER TYPE sensorstatus ADD VALUE 'pending';
                    END IF;
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_enum
                        WHERE enumlabel = 'error'
                          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sensorstatus')
                    ) THEN
                        ALTER TYPE sensorstatus ADD VALUE 'error';
                    END IF;
                END IF;
            END $$;
        """))

        # 2. Migrate sensor_id from integer PK to UUID VARCHAR(36) BEFORE create_all
        #    so that sensor_audit_logs FK (VARCHAR -> VARCHAR) is consistent.
        conn.execute(text("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='sensors'
                      AND column_name='sensor_id'
                      AND data_type='integer'
                ) THEN
                    ALTER TABLE sensors ADD COLUMN new_sensor_id VARCHAR(36);
                    UPDATE sensors SET new_sensor_id = gen_random_uuid()::text;
                    ALTER TABLE sensors ALTER COLUMN new_sensor_id SET NOT NULL;
                    ALTER TABLE sensors DROP CONSTRAINT sensors_pkey;
                    DROP INDEX IF EXISTS ix_sensors_sensor_id;
                    ALTER TABLE sensors DROP COLUMN sensor_id;
                    ALTER TABLE sensors RENAME COLUMN new_sensor_id TO sensor_id;
                    ALTER TABLE sensors ADD PRIMARY KEY (sensor_id);
                    CREATE INDEX ix_sensors_sensor_id ON sensors(sensor_id);
                END IF;
            END $$;
        """))

        conn.commit()

    # ── Create any missing tables (sensor_audit_logs, etc.) ───────────────────
    Base.metadata.create_all(bind=engine)

    # ── Post-create_all migrations ─────────────────────────────────────────────
    with engine.connect() as conn:
        # 3. Add last_message_at column if missing
        conn.execute(text(
            "ALTER TABLE sensors ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP NULL"
        ))
        # 4. Add first_name/last_name to users if missing (auth service owns the table;
        #    sensor service reads it for audit log display names)
        conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(50)"
        ))
        conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(50)"
        ))
        conn.commit()

    yield



app = FastAPI(title="VerdantIQ Sensor Service", version="1.0.0", lifespan=lifespan)

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


# ─── Tenant service helpers ───────────────────────────────────────────────────

async def check_billing_active(tenant_id: int) -> bool:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{settings.TENANT_SERVICE_URL}/internal/tenants/{tenant_id}/billing-status"
            )
            if response.status_code == 200:
                return response.json().get("billing_active", False)
    except httpx.RequestError:
        pass
    return False


async def notify_sensor_delta(tenant_id: int, delta: int) -> None:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.patch(
                f"{settings.TENANT_SERVICE_URL}/internal/billings/sensor-count",
                json={"tenant_id": tenant_id, "delta": delta},
            )
    except httpx.RequestError:
        pass


async def notify_message_increment(tenant_id: int, increment: int) -> None:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.patch(
                f"{settings.TENANT_SERVICE_URL}/internal/billings/message-count",
                json={"tenant_id": tenant_id, "increment": increment},
            )
    except httpx.RequestError:
        pass


async def sync_iot_devices(tenant_id: int, db: Session) -> None:
    sensors = crud.get_sensors_by_tenant(db, tenant_id)
    devices = [
        {"sensor_id": s.sensor_id, "name": s.sensor_name, "status": s.status.value}
        for s in sensors
    ]
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.patch(
                f"{settings.TENANT_SERVICE_URL}/internal/tenants/{tenant_id}/iot-devices",
                json={"tenant_id": tenant_id, "devices": devices},
            )
    except httpx.RequestError:
        pass


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.post("/sensors/", response_model=schemas.SensorResponse, status_code=status.HTTP_201_CREATED)
async def onboard_sensor(
    sensor: schemas.SensorCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.tenant_id != sensor.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this tenant")
    billing_active = await check_billing_active(sensor.tenant_id)
    if not billing_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Active billing required to onboard sensor",
        )
    db_sensor = crud.create_sensor(db, sensor, current_user.user_id)
    await notify_sensor_delta(sensor.tenant_id, delta=1)
    await sync_iot_devices(sensor.tenant_id, db)
    return db_sensor


@app.get("/sensors/audit/", response_model=schemas.SensorAuditPage)
async def list_sensor_audit(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=5, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return crud.get_audit_logs(db, current_user.tenant_id, page, per_page)


@app.get("/sensors/", response_model=schemas.SensorPage)
async def list_sensors(
    tenant_id: int,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=10, ge=1, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this tenant")
    return crud.get_sensors_paginated(db, tenant_id, page, per_page)


@app.get("/sensors/{sensor_id}", response_model=schemas.SensorResponse)
async def get_sensor(
    sensor_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sensor = crud.get_sensor(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor not found")
    if sensor.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return sensor


@app.patch("/sensors/{sensor_id}", response_model=schemas.SensorResponse)
async def update_sensor(
    sensor_id: str,
    body: schemas.SensorUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sensor = crud.get_sensor(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor not found")
    if sensor.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    updated = crud.update_sensor(db, sensor_id, body, current_user.user_id)
    await sync_iot_devices(sensor.tenant_id, db)
    return updated


@app.patch("/sensors/{sensor_id}/rename", response_model=schemas.SensorResponse)
async def rename_sensor(
    sensor_id: str,
    body: schemas.SensorRenameRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sensor = crud.get_sensor(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor not found")
    if sensor.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if not body.sensor_name.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Name cannot be empty")
    return crud.rename_sensor(db, sensor_id, body.sensor_name.strip(), current_user.user_id)


@app.patch("/sensors/{sensor_id}/status", response_model=schemas.SensorResponse)
async def update_sensor_status(
    sensor_id: str,
    body: schemas.SensorStatusUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sensor = crud.get_sensor(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor not found")
    if sensor.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return crud.update_sensor_status(db, sensor_id, body.status, current_user.user_id)


@app.delete("/sensors/{sensor_id}", response_model=schemas.SensorResponse)
async def delete_sensor(
    sensor_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sensor = crud.get_sensor(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor not found")
    if sensor.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    user_role = crud.get_user_role(db, current_user.user_id, current_user.tenant_id)
    if user_role == "viewer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Viewers cannot delete sensors")
    if user_role != "admin" and sensor.user_id != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    tenant_id = sensor.tenant_id
    deleted = crud.delete_sensor(db, sensor_id, current_user.user_id)
    await notify_sensor_delta(tenant_id, delta=-1)
    await sync_iot_devices(tenant_id, db)
    return deleted


@app.get("/sensors/{sensor_id}/data", response_model=schemas.SensorDataResponse)
async def get_sensor_data(
    sensor_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sensor = crud.get_sensor(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor not found")
    if sensor.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    try:
        data = crud.get_sensor_data(sensor_id, sensor.tenant_id)
    except trino.exceptions.DatabaseError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Data service temporarily unavailable",
        )
    return schemas.SensorDataResponse(sensor_id=sensor_id, tenant_id=sensor.tenant_id, data=data)


@app.post("/sensors/{sensor_id}/messages", response_model=schemas.SensorResponse)
async def update_sensor_messages(
    sensor_id: str,
    body: schemas.MessageIncrementRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sensor = crud.get_sensor(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor not found")
    if sensor.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    updated = crud.increment_sensor_messages(db, sensor_id, body.message_increment)
    await notify_message_increment(sensor.tenant_id, body.message_increment)
    return updated


@app.post("/sensors/{sensor_id}/connect", response_model=schemas.SensorConnectionEventResponse)
async def initiate_sensor_connection(
    sensor_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sensor = crud.get_sensor(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor not found")
    if sensor.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    event = crud.initiate_connection(db, sensor_id, sensor.tenant_id, current_user.user_id, sensor.sensor_name)
    return event


@app.get("/sensors/{sensor_id}/connection-events", response_model=schemas.SensorConnectionEventPage)
async def get_sensor_connection_events(
    sensor_id: str,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=5, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sensor = crud.get_sensor(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor not found")
    if sensor.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return crud.get_connection_events(db, sensor_id, page, per_page)


@app.post("/sensors/{sensor_id}/connection-events", response_model=schemas.SensorConnectionEventResponse)
async def log_sensor_connection_event(
    sensor_id: str,
    body: schemas.ConnectionEventCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Log a pipeline step event from the frontend after it confirms completion."""
    sensor = crud.get_sensor(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor not found")
    if sensor.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    crud.log_connection_event(
        db, sensor_id, sensor.tenant_id,
        event_type=body.event_type,
        status=body.status,
        message=body.message,
        details=body.details,
    )
    db.commit()
    latest = (
        db.query(models.SensorConnectionEvent)
        .filter(models.SensorConnectionEvent.sensor_id == sensor_id)
        .order_by(models.SensorConnectionEvent.created_at.desc())
        .first()
    )
    return latest


@app.post("/internal/sensors/{sensor_id}/messages")
async def internal_increment_messages(
    sensor_id: str,
    body: schemas.MessageIncrementRequest,
    db: Session = Depends(get_db),
):
    """Internal endpoint (no auth) — called by data service to count Kafka messages."""
    updated = crud.increment_sensor_messages(db, sensor_id, body.message_increment)
    if updated:
        await notify_message_increment(updated.tenant_id, body.message_increment)
    return {"ok": True}


@app.get("/health")
async def health():
    return {"service": "sensor", "status": "ok"}
