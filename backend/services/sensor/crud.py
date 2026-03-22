from sqlalchemy.orm import Session
import models
import schemas
import trino
import trino.exceptions
import uuid
import math
import re
from configs import settings
from typing import List, Optional
from datetime import datetime, timezone


# ── Audit helper ──────────────────────────────────────────────────────────────

def log_audit(
    db: Session,
    tenant_id: int,
    sensor_id: Optional[str],
    sensor_name: str,
    action: str,
    performed_by: int,
    details: Optional[dict] = None,
) -> None:
    entry = models.SensorAuditLog(
        tenant_id=tenant_id,
        sensor_id=sensor_id,
        sensor_name=sensor_name,
        action=action,
        performed_by=performed_by,
        details=details,
    )
    db.add(entry)
    # caller is responsible for commit


# ── Sensor CRUD ───────────────────────────────────────────────────────────────

def log_connection_event(
    db: Session,
    sensor_id: str,
    tenant_id: int,
    event_type: str,
    status: str = "success",
    message: Optional[str] = None,
    details: Optional[dict] = None,
) -> None:
    entry = models.SensorConnectionEvent(
        sensor_id=sensor_id,
        tenant_id=tenant_id,
        event_type=event_type,
        status=status,
        message=message,
        details=details,
    )
    db.add(entry)
    # caller is responsible for commit


def create_sensor(db: Session, sensor: schemas.SensorCreate, user_id: int) -> models.Sensor:
    sensor_id = str(uuid.uuid4())
    # Merge explicit hardware fields into sensor_metadata
    meta: dict = dict(sensor.sensor_metadata or {})
    for field in ("manufacturer", "model", "serial_number", "operating_system", "power_type"):
        val = getattr(sensor, field, None)
        if val is not None:
            meta[field] = val

    db_sensor = models.Sensor(
        sensor_id=sensor_id,
        tenant_id=sensor.tenant_id,
        user_id=user_id,
        sensor_name=sensor.sensor_name,
        sensor_type=sensor.sensor_type,
        location=sensor.location,
        sensor_metadata=meta or None,
        mqtt_token=str(uuid.uuid4()),
        status=models.SensorStatus.pending,
    )
    db.add(db_sensor)
    log_audit(
        db, sensor.tenant_id, sensor_id, sensor.sensor_name,
        "created", user_id,
        {"sensor_type": sensor.sensor_type, "location": sensor.location},
    )
    log_connection_event(
        db, sensor_id, sensor.tenant_id,
        event_type="sensor_registered",
        message=f"Sensor \"{sensor.sensor_name}\" registered on the platform.",
        details={"sensor_type": sensor.sensor_type, "location": sensor.location},
    )
    db.commit()
    db.refresh(db_sensor)
    return db_sensor


def get_sensor(db: Session, sensor_id: str) -> Optional[models.Sensor]:
    return db.query(models.Sensor).filter(models.Sensor.sensor_id == sensor_id).first()


def get_sensors_by_tenant(
    db: Session, tenant_id: int, skip: int = 0, limit: int = 100
) -> List[models.Sensor]:
    return (
        db.query(models.Sensor)
        .filter(models.Sensor.tenant_id == tenant_id)
        .order_by(models.Sensor.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_sensors_paginated(
    db: Session, tenant_id: int, page: int = 1, per_page: int = 10
) -> schemas.SensorPage:
    query = (
        db.query(models.Sensor)
        .filter(models.Sensor.tenant_id == tenant_id)
        .order_by(models.Sensor.created_at.desc())
    )
    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    return schemas.SensorPage(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, math.ceil(total / per_page)),
    )


def update_sensor(
    db: Session, sensor_id: str, update: schemas.SensorUpdate, performed_by: int
) -> Optional[models.Sensor]:
    db_sensor = db.query(models.Sensor).filter(models.Sensor.sensor_id == sensor_id).first()
    if not db_sensor:
        return None

    old_name = db_sensor.sensor_name

    if update.sensor_name is not None and update.sensor_name.strip():
        db_sensor.sensor_name = update.sensor_name.strip()
    if update.sensor_type is not None and update.sensor_type.strip():
        db_sensor.sensor_type = update.sensor_type.strip()
    if update.location is not None:
        db_sensor.location = update.location.strip() or None

    # Merge hardware fields into existing sensor_metadata
    meta: dict = dict(db_sensor.sensor_metadata or {})
    for field in ("manufacturer", "model", "serial_number", "operating_system", "power_type"):
        val = getattr(update, field, None)
        if val is not None:
            if val.strip():
                meta[field] = val.strip()
            else:
                meta.pop(field, None)
    if update.sensor_metadata is not None:
        meta.update(update.sensor_metadata)
    db_sensor.sensor_metadata = meta or None

    log_audit(
        db, db_sensor.tenant_id, sensor_id, db_sensor.sensor_name,
        "updated", performed_by,
        {"old_name": old_name, "new_name": db_sensor.sensor_name},
    )
    db.commit()
    db.refresh(db_sensor)
    return db_sensor


def rename_sensor(
    db: Session, sensor_id: str, sensor_name: str, performed_by: int
) -> Optional[models.Sensor]:
    db_sensor = db.query(models.Sensor).filter(models.Sensor.sensor_id == sensor_id).first()
    if db_sensor:
        old_name = db_sensor.sensor_name
        db_sensor.sensor_name = sensor_name
        log_audit(
            db, db_sensor.tenant_id, sensor_id, sensor_name,
            "renamed", performed_by,
            {"old_name": old_name, "new_name": sensor_name},
        )
        db.commit()
        db.refresh(db_sensor)
    return db_sensor


def update_sensor_status(
    db: Session, sensor_id: str, new_status: models.SensorStatus, performed_by: int
) -> Optional[models.Sensor]:
    db_sensor = db.query(models.Sensor).filter(models.Sensor.sensor_id == sensor_id).first()
    if db_sensor:
        old_status = db_sensor.status.value
        db_sensor.status = new_status
        log_audit(
            db, db_sensor.tenant_id, sensor_id, db_sensor.sensor_name,
            "status_changed", performed_by,
            {"old_status": old_status, "new_status": new_status.value},
        )
        db.commit()
        db.refresh(db_sensor)
    return db_sensor


def delete_sensor(db: Session, sensor_id: str, performed_by: int) -> Optional[models.Sensor]:
    db_sensor = db.query(models.Sensor).filter(models.Sensor.sensor_id == sensor_id).first()
    if db_sensor:
        log_audit(
            db, db_sensor.tenant_id, sensor_id, db_sensor.sensor_name,
            "deleted", performed_by,
            {"sensor_type": db_sensor.sensor_type, "location": db_sensor.location},
        )
        db.delete(db_sensor)
        db.commit()
    return db_sensor


def increment_sensor_messages(db: Session, sensor_id: str, increment: int) -> Optional[models.Sensor]:
    db_sensor = db.query(models.Sensor).filter(models.Sensor.sensor_id == sensor_id).first()
    if db_sensor:
        was_pending = db_sensor.status == models.SensorStatus.pending
        db_sensor.message_count += increment
        db_sensor.last_message_at = datetime.now(timezone.utc).replace(tzinfo=None)
        if was_pending:
            db_sensor.status = models.SensorStatus.active
            log_connection_event(
                db, sensor_id, db_sensor.tenant_id,
                event_type="data_received",
                message="First data message received. Sensor is now active.",
                details={"messages": increment},
            )
        db.commit()
        db.refresh(db_sensor)
    return db_sensor


# ── Audit log queries ─────────────────────────────────────────────────────────

def get_audit_logs(
    db: Session, tenant_id: int, page: int = 1, per_page: int = 20
) -> schemas.SensorAuditPage:
    query = (
        db.query(models.SensorAuditLog)
        .filter(models.SensorAuditLog.tenant_id == tenant_id)
        .order_by(models.SensorAuditLog.created_at.desc())
    )
    total = query.count()
    rows = query.offset((page - 1) * per_page).limit(per_page).all()

    # Resolve user first names in one query
    user_ids = {r.performed_by for r in rows}
    users = {
        u.user_id: (u.first_name or u.email.split("@")[0])
        for u in db.query(models.User).filter(models.User.user_id.in_(user_ids)).all()
    }

    items = [
        schemas.SensorAuditLogResponse(
            id=r.id,
            tenant_id=r.tenant_id,
            sensor_id=r.sensor_id,
            sensor_name=r.sensor_name,
            action=r.action,
            performed_by=r.performed_by,
            performed_by_name=users.get(r.performed_by),
            details=r.details,
            created_at=r.created_at,
        )
        for r in rows
    ]
    return schemas.SensorAuditPage(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, math.ceil(total / per_page)),
    )


# ── Connection event queries ───────────────────────────────────────────────────

def initiate_connection(
    db: Session, sensor_id: str, tenant_id: int, user_id: int, sensor_name: str
) -> models.SensorConnectionEvent:
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    actor = user.first_name if (user and user.first_name) else f"User #{user_id}"
    log_connection_event(
        db, sensor_id, tenant_id,
        event_type="connection_initiated",
        message=f"Connection setup initiated by {actor}. Configure your device with the token below.",
        details={"initiated_by": actor},
    )
    db.commit()
    return db.query(models.SensorConnectionEvent).filter(
        models.SensorConnectionEvent.sensor_id == sensor_id,
        models.SensorConnectionEvent.event_type == "connection_initiated",
    ).order_by(models.SensorConnectionEvent.created_at.desc()).first()


def get_connection_events(
    db: Session, sensor_id: str, page: int = 1, per_page: int = 20
) -> schemas.SensorConnectionEventPage:
    query = (
        db.query(models.SensorConnectionEvent)
        .filter(models.SensorConnectionEvent.sensor_id == sensor_id)
        .order_by(models.SensorConnectionEvent.created_at.desc())
    )
    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    return schemas.SensorConnectionEventPage(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, math.ceil(total / per_page)),
    )


# ── Trino sensor data ─────────────────────────────────────────────────────────

def get_sensor_data(sensor_id: str, tenant_id: int) -> List[schemas.SensorDataPoint]:
    """Query Trino for recent sensor readings. Raises trino.exceptions.DatabaseError on failure."""
    conn = trino.dbapi.connect(
        host=settings.TRINO_HOST,
        port=settings.TRINO_PORT,
        user=settings.TRINO_USER,
        catalog=settings.TRINO_CATALOG,
        schema=settings.TRINO_SCHEMA,
    )
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT timestamp, payload FROM sensor_data "
            "WHERE sensor_id = ? AND tenant_id = ? "
            "ORDER BY timestamp DESC LIMIT 100",
            (sensor_id, tenant_id),
        )
        rows = cur.fetchall()
        cur.close()
        return [schemas.SensorDataPoint(timestamp=str(row[0]), value=row[1]) for row in rows]
    except Exception as exc:
        raise trino.exceptions.DatabaseError(str(exc)) from exc
    finally:
        conn.close()


def suspend_tenant_sensors(db: Session, tenant_id: int) -> list[str]:
    """Mark every active sensor for a tenant as inactive and stamp billing_suspended metadata.

    Returns the list of sensor_ids that were deactivated.
    """
    active_sensors = (
        db.query(models.Sensor)
        .filter(
            models.Sensor.tenant_id == tenant_id,
            models.Sensor.status == models.SensorStatus.active,
        )
        .all()
    )
    for sensor in active_sensors:
        meta = dict(sensor.sensor_metadata or {})
        meta["billing_suspended"] = True
        sensor.sensor_metadata = meta
        sensor.status = models.SensorStatus.inactive
        log_audit(
            db, tenant_id, sensor.sensor_id, sensor.sensor_name,
            "status_changed", sensor.user_id,
            {"old_status": "active", "new_status": "inactive", "reason": "billing_suspended"},
        )
        log_connection_event(
            db, sensor.sensor_id, tenant_id,
            event_type="sensor_suspended",
            status="success",
            message="Disconnected: billing auto-suspended — running cost exceeded balance",
            details={"reason": "billing_suspended"},
        )
    db.commit()
    return [s.sensor_id for s in active_sensors]


def run_query(sql: str, tenant_id: int) -> tuple[list[str], list[list[str | None]]]:
    """Execute user SQL on Trino. Replaces current_user_tenant() with the real tenant_id.

    Returns (columns, rows) where every cell is a string or None.
    Raises ValueError for bad SQL (user error), trino.exceptions.DatabaseError for connectivity.
    """
    # Trino DBAPI rejects a trailing semicolon — strip it before executing
    safe_sql = sql.strip().rstrip(";").strip()
    # tenant_id is stored as STRING in Iceberg — must be a quoted literal, not an integer
    safe_sql = re.sub(r"current_user_tenant\s*\(\)", f"'{int(tenant_id)}'", safe_sql, flags=re.IGNORECASE)
    conn = trino.dbapi.connect(
        host=settings.TRINO_HOST,
        port=settings.TRINO_PORT,
        user=settings.TRINO_USER,
        catalog=settings.TRINO_CATALOG,
        schema=settings.TRINO_SCHEMA,
    )
    try:
        cur = conn.cursor()
        cur.execute(safe_sql)
        rows = cur.fetchmany(1000)
        columns = [desc[0] for desc in (cur.description or [])]
        str_rows: list[list[str | None]] = [
            [str(cell) if cell is not None else None for cell in row]
            for row in rows
        ]
        cur.close()
        return columns, str_rows
    except trino.exceptions.TrinoUserError as exc:
        raise ValueError(str(exc)) from exc
    except Exception as exc:
        raise trino.exceptions.DatabaseError(str(exc)) from exc
    finally:
        conn.close()


# ── Role helper ───────────────────────────────────────────────────────────────

def get_user_role(db: Session, user_id: int, tenant_id: int) -> Optional[str]:
    role = (
        db.query(models.Role)
        .join(models.UserRole, models.Role.role_id == models.UserRole.role_id)
        .filter(
            models.UserRole.user_id == user_id,
            models.Role.tenant_id == tenant_id,
        )
        .first()
    )
    return role.role_name.lower() if role else None


def create_sensor_storage(db: Session, tenant_id: int, data: schemas.SensorStorageCreate) -> models.SensorStorage:
    storage = models.SensorStorage(
        tenant_id=tenant_id,
        sensor_id=data.sensor_id,
        allocated_gb=data.allocated_gb,
    )
    db.add(storage)
    db.commit()
    db.refresh(storage)
    return storage


def get_sensor_storage_list(
    db: Session, tenant_id: int, page: int = 1, per_page: int = 20
) -> schemas.SensorStoragePage:
    import math
    q = db.query(models.SensorStorage).filter(models.SensorStorage.tenant_id == tenant_id)
    total = q.count()
    items = q.order_by(models.SensorStorage.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return schemas.SensorStoragePage(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, math.ceil(total / per_page)),
    )


def delete_sensor_storage(db: Session, tenant_id: int, storage_id: str) -> bool:
    storage = db.query(models.SensorStorage).filter(
        models.SensorStorage.storage_id == storage_id,
        models.SensorStorage.tenant_id == tenant_id,
    ).first()
    if not storage:
        return False
    db.delete(storage)
    db.commit()
    return True


# ── Farm CRUD ─────────────────────────────────────────────────────────────────

def create_farm(db: Session, tenant_id: int, data: schemas.FarmCreate) -> models.Farm:
    farm = models.Farm(tenant_id=tenant_id, **data.model_dump(exclude_none=False))
    db.add(farm)
    db.flush()  # get farm_id before commit

    # Seed a CropManagement record for each crop selected during farm creation
    # so they immediately appear in the crop management page.
    for crop_name in (data.crops or []):
        db.add(models.CropManagement(
            farm_id=farm.farm_id,
            tenant_id=tenant_id,
            crop_name=crop_name,
        ))

    db.commit()
    db.refresh(farm)
    return farm


def get_farm(db: Session, tenant_id: int, farm_id: str) -> Optional[models.Farm]:
    return db.query(models.Farm).filter(
        models.Farm.farm_id == farm_id,
        models.Farm.tenant_id == tenant_id,
    ).first()


def list_farms(
    db: Session, tenant_id: int, page: int = 1, per_page: int = 20
) -> schemas.FarmPage:
    q = db.query(models.Farm).filter(models.Farm.tenant_id == tenant_id)
    total = q.count()
    items = q.order_by(models.Farm.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return schemas.FarmPage(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, math.ceil(total / per_page)),
    )


def update_farm(
    db: Session, tenant_id: int, farm_id: str, data: schemas.FarmUpdate
) -> Optional[models.Farm]:
    farm = get_farm(db, tenant_id, farm_id)
    if not farm:
        return None

    update_dict = data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(farm, field, value)

    # If crops list was updated, seed CropManagement records for any new crops.
    # Existing records are never deleted — removals from Farm.crops only affect
    # the farm metadata, not real planting/management data.
    if "crops" in update_dict and update_dict["crops"]:
        existing_names = {
            row.crop_name
            for row in db.query(models.CropManagement.crop_name)
            .filter(
                models.CropManagement.farm_id == farm_id,
                models.CropManagement.tenant_id == tenant_id,
            )
            .all()
        }
        for crop_name in update_dict["crops"]:
            if crop_name not in existing_names:
                db.add(models.CropManagement(
                    farm_id=farm_id,
                    tenant_id=tenant_id,
                    crop_name=crop_name,
                ))

    db.commit()
    db.refresh(farm)
    return farm


def delete_farm(db: Session, tenant_id: int, farm_id: str) -> bool:
    farm = get_farm(db, tenant_id, farm_id)
    if not farm:
        return False
    db.delete(farm)
    db.commit()
    return True


# ── Crop Management CRUD ──────────────────────────────────────────────────────

def create_crop(
    db: Session, tenant_id: int, data: schemas.CropManagementCreate
) -> models.CropManagement:
    crop = models.CropManagement(tenant_id=tenant_id, **data.model_dump())
    db.add(crop)
    db.commit()
    db.refresh(crop)
    return crop


def get_crop(db: Session, tenant_id: int, crop_id: str) -> Optional[models.CropManagement]:
    return db.query(models.CropManagement).filter(
        models.CropManagement.id == crop_id,
        models.CropManagement.tenant_id == tenant_id,
    ).first()


def list_crops(
    db: Session, tenant_id: int, farm_id: Optional[str] = None,
    page: int = 1, per_page: int = 50,
) -> schemas.CropManagementPage:
    q = db.query(models.CropManagement).filter(models.CropManagement.tenant_id == tenant_id)
    if farm_id:
        q = q.filter(models.CropManagement.farm_id == farm_id)
    total = q.count()
    items = q.order_by(models.CropManagement.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return schemas.CropManagementPage(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, math.ceil(total / per_page)),
    )


def update_crop(
    db: Session, tenant_id: int, crop_id: str, data: schemas.CropManagementUpdate
) -> Optional[models.CropManagement]:
    crop = get_crop(db, tenant_id, crop_id)
    if not crop:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(crop, field, value)
    db.commit()
    db.refresh(crop)
    return crop


def delete_crop(db: Session, tenant_id: int, crop_id: str) -> bool:
    crop = get_crop(db, tenant_id, crop_id)
    if not crop:
        return False
    db.delete(crop)
    db.commit()
    return True
