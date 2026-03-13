from sqlalchemy.orm import Session
import models
import schemas
import trino
import trino.exceptions
import uuid
import math
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

def create_sensor(db: Session, sensor: schemas.SensorCreate, user_id: int) -> models.Sensor:
    sensor_id = str(uuid.uuid4())
    db_sensor = models.Sensor(
        sensor_id=sensor_id,
        tenant_id=sensor.tenant_id,
        user_id=user_id,
        sensor_name=sensor.sensor_name,
        sensor_type=sensor.sensor_type,
        location=sensor.location,
        sensor_metadata=sensor.sensor_metadata,
        mqtt_token=str(uuid.uuid4()),
        status=models.SensorStatus.pending,
    )
    db.add(db_sensor)
    log_audit(
        db, sensor.tenant_id, sensor_id, sensor.sensor_name,
        "created", user_id,
        {"sensor_type": sensor.sensor_type, "location": sensor.location},
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
        db_sensor.message_count += increment
        db_sensor.last_message_at = datetime.now(timezone.utc).replace(tzinfo=None)
        # First message received → transition from pending to active
        if db_sensor.status == models.SensorStatus.pending:
            db_sensor.status = models.SensorStatus.active
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
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    return schemas.SensorAuditPage(
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
