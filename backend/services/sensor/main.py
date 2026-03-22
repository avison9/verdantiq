from contextlib import asynccontextmanager
from collections import defaultdict
from fastapi import FastAPI, Depends, HTTPException, status, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List, Optional
import asyncio
import httpx
import json
import logging
import redis.asyncio as aioredis
import time
import trino.exceptions
import models
import schemas
import crud
from authenticate import decode_access_token
from configs import get_db, settings, Base, engine, ALLOWED_ORIGINS


_log = logging.getLogger(__name__)

# ── Redis client (initialized in lifespan) ────────────────────────────────────
_redis: aioredis.Redis | None = None

_HIST_TTL   = 86_400   # 24 hours
_HIST_MAX   = 20       # keep last 20 queries per tenant


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
        conn.execute(text(
            "ALTER TABLE sensors ADD COLUMN IF NOT EXISTS storage_bytes BIGINT NOT NULL DEFAULT 0"
        ))
        conn.execute(text(
            "ALTER TABLE sensors ADD COLUMN IF NOT EXISTS farm_id VARCHAR(36)"
        ))
        # 5. Create crop_management table if missing
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS crop_management (
                id VARCHAR(36) PRIMARY KEY,
                farm_id VARCHAR(36) NOT NULL REFERENCES farms(farm_id) ON DELETE CASCADE,
                tenant_id INTEGER NOT NULL,
                crop_name VARCHAR(100) NOT NULL,
                area_ha FLOAT,
                grain_type VARCHAR(100),
                grains_planted INTEGER,
                planting_date DATE,
                expected_harvest_date DATE,
                notes VARCHAR(1000),
                avg_sunlight_hrs FLOAT,
                soil_ph FLOAT,
                soil_humidity FLOAT,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP
            )
        """))
        conn.commit()

    # ── Redis client ───────────────────────────────────────────────────────────
    global _redis
    try:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await _redis.ping()
        _log.info("Redis connected: %s", settings.REDIS_URL)
    except Exception as exc:
        _log.warning("Redis unavailable — query history disabled: %s", exc)
        _redis = None

    yield

    if _redis:
        await _redis.aclose()



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


@app.post("/storage/", response_model=schemas.SensorStorageResponse)
async def create_storage(
    body: schemas.SensorStorageCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return crud.create_sensor_storage(db, current_user.tenant_id, body)


@app.get("/storage/", response_model=schemas.SensorStoragePage)
async def list_storage(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return crud.get_sensor_storage_list(db, current_user.tenant_id, page, per_page)


@app.delete("/storage/{storage_id}", status_code=204)
async def delete_storage(
    storage_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deleted = crud.delete_sensor_storage(db, current_user.tenant_id, storage_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Storage allocation not found")


@app.post("/internal/sensors/suspend-tenant")
async def internal_suspend_tenant(
    body: schemas.TenantSuspendRequest,
    db: Session = Depends(get_db),
):
    """Called by tenant service when billing is auto-suspended due to overdrawn balance.
    Marks all active sensors for the tenant as inactive, stamps billing_suspended metadata,
    and stops their MQTT simulators in the data service.
    """
    suspended_sensors = crud.suspend_tenant_sensors(db, body.tenant_id)

    # Disconnect all simulators in parallel — sequential disconnects block for
    # N × (thread-join + bridge-unregister) seconds and can starve health checks.
    async def _disconnect_one(sensor_id: str) -> None:
        url = (
            f"{settings.DATA_SERVICE_URL}/sensors"
            f"/{body.tenant_id}/{sensor_id}/disconnect"
        )
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.delete(url)
        except Exception as exc:
            logging.getLogger(__name__).warning(
                "Failed to disconnect simulator for sensor %s: %s", sensor_id, exc
            )

    if suspended_sensors:
        await asyncio.gather(*[_disconnect_one(sid) for sid in suspended_sensors])

    return {"suspended": len(suspended_sensors)}


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


@app.post("/farms/", response_model=schemas.FarmResponse, status_code=201)
async def create_farm(
    body: schemas.FarmCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return crud.create_farm(db, current_user.tenant_id, body)


@app.get("/farms/", response_model=schemas.FarmPage)
async def list_farms(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return crud.list_farms(db, current_user.tenant_id, page, per_page)


@app.get("/farms/{farm_id}", response_model=schemas.FarmResponse)
async def get_farm(
    farm_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    farm = crud.get_farm(db, current_user.tenant_id, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    return farm


@app.patch("/farms/{farm_id}", response_model=schemas.FarmResponse)
async def update_farm(
    farm_id: str,
    body: schemas.FarmUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    farm = crud.update_farm(db, current_user.tenant_id, farm_id, body)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    return farm


@app.delete("/farms/{farm_id}", status_code=204)
async def delete_farm(
    farm_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deleted = crud.delete_farm(db, current_user.tenant_id, farm_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Farm not found")


@app.post("/crop-management/", response_model=schemas.CropManagementResponse, status_code=201)
async def create_crop(
    body: schemas.CropManagementCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return crud.create_crop(db, current_user.tenant_id, body)


@app.get("/crop-management/", response_model=schemas.CropManagementPage)
async def list_crops(
    farm_id: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return crud.list_crops(db, current_user.tenant_id, farm_id, page, per_page)


@app.get("/crop-management/{crop_id}", response_model=schemas.CropManagementResponse)
async def get_crop(
    crop_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    crop = crud.get_crop(db, current_user.tenant_id, crop_id)
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
    return crop


@app.patch("/crop-management/{crop_id}", response_model=schemas.CropManagementResponse)
async def update_crop(
    crop_id: str,
    body: schemas.CropManagementUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    crop = crud.update_crop(db, current_user.tenant_id, crop_id, body)
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
    return crop


@app.delete("/crop-management/{crop_id}", status_code=204)
async def delete_crop(
    crop_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deleted = crud.delete_crop(db, current_user.tenant_id, crop_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Crop not found")


@app.get("/query/schema", response_model=schemas.SchemaTree)
async def get_query_schema(
    current_user: models.User = Depends(get_current_user),
):
    """Return the live Iceberg catalog tree (schemas → tables → columns) from Trino."""
    _sql = (
        "SELECT table_schema, table_name, column_name, data_type "
        "FROM iceberg.information_schema.columns "
        "WHERE table_schema NOT IN ('information_schema') "
        "ORDER BY table_schema, table_name, ordinal_position"
    )
    try:
        _, rows, _ = crud.run_query(_sql, current_user.tenant_id)
    except trino.exceptions.DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Query engine unavailable: {exc}",
        )

    # Build nested tree from flat rows
    tree: dict[str, dict[str, list[schemas.SchemaColumn]]] = defaultdict(lambda: defaultdict(list))
    for row in rows:
        schema_name, table_name, col_name, col_type = row[0], row[1], row[2], row[3]
        tree[schema_name][table_name].append(schemas.SchemaColumn(name=col_name, type=col_type))

    schema_entries = [
        schemas.SchemaEntry(
            name=schema_name,
            tables=[
                schemas.SchemaTable(name=tbl, cols=cols)
                for tbl, cols in sorted(tables.items())
            ],
        )
        for schema_name, tables in sorted(tree.items())
    ]
    return schemas.SchemaTree(
        catalogs=[schemas.CatalogEntry(name="iceberg", schemas=schema_entries)]
    )


@app.post("/query/", response_model=schemas.QueryResult)
async def execute_query(
    body: schemas.QueryRequest,
    current_user: models.User = Depends(get_current_user),
):
    if not body.sql.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="SQL query cannot be empty")
    billing_active = await check_billing_active(current_user.tenant_id)
    if not billing_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Active billing required to run queries")
    t0 = time.monotonic()
    try:
        columns, rows, trino_stats = crud.run_query(body.sql, current_user.tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except trino.exceptions.DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Query engine unavailable: {exc}",
        )
    ms = int((time.monotonic() - t0) * 1000)

    # ── Compute QU and deduct charge from tenant billing (best-effort) ──────
    qu   = crud.calculate_qu(trino_stats)
    cost = round(qu * crud.QUERY_RATE_PER_QU, 6)
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{settings.TENANT_SERVICE_URL}/internal/billings/query-charge",
                json={
                    "tenant_id":   current_user.tenant_id,
                    "qu":          qu,
                    "cost":        cost,
                    "sql_preview": body.sql[:120],
                },
            )
    except httpx.RequestError as exc:
        _log.warning("Failed to record query charge for tenant %s: %s", current_user.tenant_id, exc)

    # ── Persist history + last SQL to Redis (non-fatal if Redis is down) ────
    if _redis:
        try:
            hist_key = f"viq:query:history:{current_user.tenant_id}:{current_user.user_id}"
            last_key = f"viq:query:last_sql:{current_user.tenant_id}:{current_user.user_id}"
            item = json.dumps({
                "ts":      datetime.now(timezone.utc).isoformat(),
                "sql":     body.sql,
                "ms":      ms,
                "qu":      qu,
                "cost":    cost,
                "columns": columns,
                "rows":    rows,
            })
            await _redis.lpush(hist_key, item)
            await _redis.ltrim(hist_key, 0, _HIST_MAX - 1)
            await _redis.expire(hist_key, _HIST_TTL)
            await _redis.set(last_key, body.sql, ex=_HIST_TTL)
        except Exception as exc:
            _log.warning("Failed to save query history to Redis: %s", exc)

    return schemas.QueryResult(columns=columns, rows=rows, ms=ms, qu=qu, cost=cost)


@app.get("/query/history", response_model=schemas.QueryHistory)
async def get_query_history(
    current_user: models.User = Depends(get_current_user),
):
    """Return the last 20 queries run by this tenant (from Redis cache)."""
    if not _redis:
        return schemas.QueryHistory(items=[])
    try:
        hist_key = f"viq:query:history:{current_user.tenant_id}:{current_user.user_id}"
        raw = await _redis.lrange(hist_key, 0, -1)
        items = [schemas.QueryHistoryItem(**json.loads(r)) for r in raw]
        return schemas.QueryHistory(items=items)
    except Exception as exc:
        _log.warning("Failed to fetch query history from Redis: %s", exc)
        return schemas.QueryHistory(items=[])


@app.get("/query/last-sql", response_model=schemas.LastSqlResponse)
async def get_last_sql(
    current_user: models.User = Depends(get_current_user),
):
    """Return the last SQL query run by this tenant (from Redis cache)."""
    if not _redis:
        return schemas.LastSqlResponse(sql=None)
    try:
        last_key = f"viq:query:last_sql:{current_user.tenant_id}:{current_user.user_id}"
        sql = await _redis.get(last_key)
        return schemas.LastSqlResponse(sql=sql)
    except Exception as exc:
        _log.warning("Failed to fetch last SQL from Redis: %s", exc)
        return schemas.LastSqlResponse(sql=None)


@app.delete("/query/history", status_code=204)
async def clear_query_history(
    current_user: models.User = Depends(get_current_user),
):
    """Delete this user's query history and last-SQL from Redis. Called on logout."""
    if not _redis:
        return
    try:
        hist_key = f"viq:query:history:{current_user.tenant_id}:{current_user.user_id}"
        last_key = f"viq:query:last_sql:{current_user.tenant_id}:{current_user.user_id}"
        await _redis.delete(hist_key, last_key)
    except Exception as exc:
        _log.warning("Failed to clear query history from Redis: %s", exc)


@app.get("/health")
async def health():
    return {"service": "sensor", "status": "ok"}
