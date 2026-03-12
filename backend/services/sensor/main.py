from fastapi import FastAPI, Depends, HTTPException, status, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
import httpx
import trino.exceptions
import models
import schemas
import crud
from authenticate import decode_access_token
from configs import get_db, settings

app = FastAPI(title="VerdantIQ Sensor Service", version="1.0.0")

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
    if not session or session.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    session.last_active = datetime.utcnow()
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
        pass  # Non-critical; billing will reconcile


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
                json={"devices": devices},
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


@app.get("/sensors/", response_model=List[schemas.SensorResponse])
async def list_sensors(
    tenant_id: int,
    skip: int = Query(default=0, ge=0, description="Number of records to skip"),
    limit: int = Query(default=10, ge=1, le=100, description="Maximum records to return"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this tenant")
    return crud.get_sensors_by_tenant(db, tenant_id, skip=skip, limit=limit)


@app.delete("/sensors/{sensor_id}", response_model=schemas.SensorResponse)
async def delete_sensor(
    sensor_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sensor = crud.get_sensor(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor not found")

    # Cross-tenant check: sensor must belong to the current user's tenant
    if sensor.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    user_role = crud.get_user_role(db, current_user.user_id, current_user.tenant_id)

    # Viewers are never allowed to delete
    if user_role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers cannot delete sensors",
        )

    # Non-admins can only delete their own sensors
    if user_role != "admin" and sensor.user_id != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    tenant_id = sensor.tenant_id
    deleted = crud.delete_sensor(db, sensor_id)
    await notify_sensor_delta(tenant_id, delta=-1)
    await sync_iot_devices(tenant_id, db)
    return deleted


@app.get("/sensors/{sensor_id}/data", response_model=schemas.SensorDataResponse)
async def get_sensor_data(
    sensor_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sensor = crud.get_sensor(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor not found")
    if sensor.user_id != current_user.user_id or sensor.tenant_id != current_user.tenant_id:
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
    sensor_id: int,
    body: schemas.MessageIncrementRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sensor = crud.get_sensor(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor not found")
    if sensor.user_id != current_user.user_id or sensor.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    updated = crud.increment_sensor_messages(db, sensor_id, body.message_increment)
    await notify_message_increment(sensor.tenant_id, body.message_increment)
    return updated


@app.get("/health")
async def health():
    return {"service": "sensor", "status": "ok"}
