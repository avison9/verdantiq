from sqlalchemy.orm import Session
import models
import schemas
import trino
import uuid
from configs import settings
from typing import List


def create_sensor(db: Session, sensor: schemas.SensorCreate, user_id: int) -> models.Sensor:
    mqtt_token = str(uuid.uuid4())
    db_sensor = models.Sensor(
        tenant_id=sensor.tenant_id,
        user_id=user_id,
        sensor_name=sensor.sensor_name,
        sensor_type=sensor.sensor_type,
        location=sensor.location,
        sensor_metadata=sensor.sensor_metadata,
        mqtt_token=mqtt_token,
    )
    db.add(db_sensor)
    db.commit()
    db.refresh(db_sensor)
    return db_sensor


def get_sensor(db: Session, sensor_id: int) -> models.Sensor | None:
    return db.query(models.Sensor).filter(models.Sensor.sensor_id == sensor_id).first()


def get_sensors_by_tenant(db: Session, tenant_id: int) -> List[models.Sensor]:
    return db.query(models.Sensor).filter(models.Sensor.tenant_id == tenant_id).all()


def delete_sensor(db: Session, sensor_id: int) -> models.Sensor:
    db_sensor = db.query(models.Sensor).filter(models.Sensor.sensor_id == sensor_id).first()
    db.delete(db_sensor)
    db.commit()
    return db_sensor


def increment_sensor_messages(db: Session, sensor_id: int, increment: int) -> models.Sensor:
    db_sensor = db.query(models.Sensor).filter(models.Sensor.sensor_id == sensor_id).first()
    if db_sensor:
        db_sensor.message_count += increment
        db.commit()
        db.refresh(db_sensor)
    return db_sensor


def get_sensor_data(sensor_id: int, tenant_id: int) -> List[schemas.SensorDataPoint]:
    conn = trino.dbapi.connect(
        host=settings.TRINO_HOST,
        port=settings.TRINO_PORT,
        user=settings.TRINO_USER,
        catalog=settings.TRINO_CATALOG,
        schema=settings.TRINO_SCHEMA,
    )
    cur = conn.cursor()
    cur.execute(
        "SELECT timestamp, payload FROM sensor_data WHERE sensor_id = %s AND tenant_id = %s "
        "ORDER BY timestamp DESC LIMIT 100",
        (sensor_id, tenant_id),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [schemas.SensorDataPoint(timestamp=str(row[0]), value=row[1]) for row in rows]
