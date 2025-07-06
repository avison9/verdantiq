from sqlalchemy.orm import Session
from fastapi import HTTPException, status
import models 
import schemas
from authenticate import get_password_hash
from sqlalchemy.sql import func
from typing import Optional, Dict, List
import uuid
from datetime import datetime
from dateutil.relativedelta import relativedelta
import trino

# Pricing
SENSOR_MESSAGE_COST = 0.10 / 100000  # $0.10 per 100,000 messages
SENSOR_ONBOARD_FEE = 1.00  # $1 per sensor

def update_tenant_iot_devices(db: Session, tenant_id: int):
    """Update iot_devices in TenantProfile based on tenant's sensors."""
    sensors = db.query(models.Sensor).filter(models.Sensor.tenant_id == tenant_id).all()
    iot_devices = [
        {
            "sensor_id": sensor.id,
            "name": sensor.name,
            "status": sensor.status.value
        }
        for sensor in sensors
    ]
    tenant_profile = db.query(models.TenantProfile).filter(models.TenantProfile.tenant_id == tenant_id).first()
    if tenant_profile:
        tenant_profile.iot_devices = iot_devices
        db.commit()
        db.refresh(tenant_profile)
    return iot_devices

def create_tenant(db: Session, tenant_name: str, tenant_profile: Optional[schemas.TenantProfileCreate] = None):
    db_tenant = db.query(models.Tenant).filter(models.Tenant.tenant_name == tenant_name).first()
    if db_tenant:
        raise HTTPException(status_code=400, detail="Tenant name already exists")
    db_tenant = models.Tenant(tenant_name=tenant_name, status=models.TenantStatus.active)
    db.add(db_tenant)
    db.commit()
    db.refresh(db_tenant)

    if tenant_profile:
        db_tenant_profile = models.TenantProfile(tenant_id=db_tenant.tenant_id, **tenant_profile.model_dump(exclude_unset=True))
        db.add(db_tenant_profile)
        db.commit()

    return db_tenant

def create_user(db: Session, user: schemas.UserCreate):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    if user.tenant_id:
        db_tenant = db.query(models.Tenant).filter(models.Tenant.tenant_id == user.tenant_id).first()
        if not db_tenant:
            raise HTTPException(status_code=400, detail="Invalid tenant_id")
        tenant_id = user.tenant_id
    elif user.tenant_name:
        db_tenant = create_tenant(db, user.tenant_name, user.tenant_profile)
        tenant_id = db_tenant.tenant_id
    else:
        raise HTTPException(status_code=400, detail="Either tenant_id or tenant_name must be provided")

    db_user = models.User(
        tenant_id=tenant_id,
        email=user.email,
        password_hash=get_password_hash(user.password),
        first_name=user.first_name,
        last_name=user.last_name,
        status=models.UserStatus.active
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    if user.user_profile:
        db_profile = models.UserProfile(user_id=db_user.user_id, **user.user_profile)
        db.add(db_profile)
        db.commit()

    if user.tenant_name:
        db_role = models.Role(tenant_id=tenant_id, role_name="Admin", description="Tenant admin")
        db.add(db_role)
        db.commit()
        db.refresh(db_role)
        db_user_role = models.UserRole(user_id=db_user.user_id, role_id=db_role.role_id)
        db.add(db_user_role)
        db.commit()

    return db_user

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def update_user(db: Session, user_id: int, tenant_id: int, user_update: schemas.UserUpdate):
    user = db.query(models.User).filter(models.User.user_id == user_id, models.User.tenant_id == tenant_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = user_update.model_dump(exclude_unset=True)

    if "email" in update_data:
        user.email = update_data["email"]
    if "password" in update_data:
        user.password_hash = get_password_hash(update_data["password"])
    if "first_name" in update_data:
        user.first_name = update_data["first_name"]
    if "last_name" in update_data:
        user.last_name = update_data["last_name"]
    if "tenant_id" in update_data:
        user.tenant_id = update_data["tenant_id"]

    if "tenant_profile" in update_data and update_data["tenant_profile"]:
        tenant_profile_data = update_data["tenant_profile"].model_dump(exclude_unset=True)
        tenant_profile = db.query(models.TenantProfile).filter(models.TenantProfile.tenant_id == user.tenant_id).first()
        if tenant_profile is None:
            tenant_profile = models.TenantProfile(tenant_id=user.tenant_id)
            db.add(tenant_profile)
        for key, value in tenant_profile_data.items():
            if hasattr(tenant_profile, key):
                setattr(tenant_profile, key, value)

    if "user_profile" in update_data and update_data["user_profile"]:
        user_profile_data = update_data["user_profile"]
        profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == user.user_id).first()
        if profile is None:
            profile = models.UserProfile(user_id=user.user_id)
            db.add(profile)
        for key, value in user_profile_data.items():
            if hasattr(profile, key):
                setattr(profile, key, value)

    db.commit()
    db.refresh(user)
    return user

def log_activity(db: Session, user_id: int, tenant_id: int, action: str, details: Dict):
    db_log = models.UserActivityLog(
        user_id=user_id,
        tenant_id=tenant_id,
        action=action,
        details=details
    )
    db.add(db_log)
    db.commit()

def calculate_amount_due(message_count: int, sensor_count: int, ml_features: list[models.MLFeatureSubscription]) -> float:
    message_cost = message_count * SENSOR_MESSAGE_COST
    sensor_cost = sensor_count * SENSOR_ONBOARD_FEE
    ml_feature_cost = sum(feature.cost for feature in ml_features)
    return message_cost + sensor_cost + ml_feature_cost

def calculate_next_due_date(frequency: models.BillingFrequency, last_date: datetime) -> datetime:
    if frequency == models.BillingFrequency.MONTHLY:
        return last_date + relativedelta(months=1)
    elif frequency == models.BillingFrequency.QUARTERLY:
        return last_date + relativedelta(months=3)
    elif frequency == models.BillingFrequency.YEARLY:
        return last_date + relativedelta(years=1)
    return last_date

def create_billing(db: Session, billing: schemas.BillingCreate):
    db_billing = models.Billing(**billing.model_dump(), amount_due=0.0)
    db.add(db_billing)
    db.commit()
    db.refresh(db_billing)
    return db_billing

def update_billing_on_payment(db: Session, billing: models.Billing):
    billing.message_count = 0
    billing.sensor_count = 0
    billing.amount_due = 0.0
    billing.last_payment_date = datetime.utcnow()
    billing.due_date = calculate_next_due_date(billing.frequency, billing.last_payment_date)
    billing.status = models.BillingStatus.ACTIVE
    db.commit()
    db.refresh(billing)
    return billing

def get_billing_by_tenant(db: Session, tenant_id: int):
    return db.query(models.Billing).filter(models.Billing.tenant_id == tenant_id).first()

def create_ml_feature_subscription(db: Session, ml_feature: schemas.MLFeatureSubscriptionCreate, billing_id: int):
    db_ml_feature = models.MLFeatureSubscription(**ml_feature.model_dump(), billing_id=billing_id)
    db.add(db_ml_feature)
    db.commit()
    db.refresh(db_ml_feature)
    return db_ml_feature

def create_sensor(db: Session, sensor: schemas.SensorCreate):
    mqtt_token = str(uuid.uuid4())
    db_sensor = models.Sensor(**sensor.model_dump(), mqtt_token=mqtt_token)
    db.add(db_sensor)
    
    billing = get_billing_by_tenant(db, sensor.tenant_id)
    if billing:
        billing.sensor_count += 1
        billing.amount_due = calculate_amount_due(billing.message_count, billing.sensor_count, billing.ml_features)
        db.commit()
        db.refresh(billing)
    
    db.commit()
    db.refresh(db_sensor)
    update_tenant_iot_devices(db, sensor.tenant_id)
    return db_sensor

def get_sensors_by_tenant(db: Session, tenant_id: int):
    return db.query(models.Sensor).filter(models.Sensor.tenant_id == tenant_id).all()

def get_sensor(db: Session, sensor_id: int):
    return db.query(models.Sensor).filter(models.Sensor.id == sensor_id).first()

def update_tenant_iot_devices(db: Session, tenant_id: int):
    """Update iot_devices in TenantProfile based on tenant's sensors."""
    sensors = db.query(models.Sensor).filter(models.Sensor.tenant_id == tenant_id).all()
    iot_devices = [
        {
            "sensor_id": sensor.id,
            "name": sensor.name,
            "status": sensor.status.value
        }
        for sensor in sensors 
    ]
    db.expire_all()
    tenant_profile = db.query(models.TenantProfile).filter(models.TenantProfile.tenant_id == tenant_id).first()
    if tenant_profile:
        tenant_profile.iot_devices = iot_devices if iot_devices else []  
        db.add(tenant_profile)  
        db.commit()
        db.refresh(tenant_profile)
    else:
        # If no tenant profile exists, create one with empty iot_devices
        tenant_profile = models.TenantProfile(tenant_id=tenant_id, iot_devices=[])
        db.add(tenant_profile)
        db.commit()
    return iot_devices

def delete_sensor(db: Session, sensor_id: int):
    db_sensor = db.query(models.Sensor).filter(models.Sensor.id == sensor_id).first()
    if not db_sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")
    tenant_id = db_sensor.tenant_id
    db.delete(db_sensor)
    db.commit()
    billing = db.query(models.Billing).filter(models.Billing.tenant_id == tenant_id).first()
    if billing:
        billing.sensor_count = db.query(models.Sensor).filter(models.Sensor.tenant_id == tenant_id).count()
        billing.amount_due = calculate_amount_due(billing.message_count, billing.sensor_count, billing.ml_features)
        db.commit()
        db.refresh(billing)
    update_tenant_iot_devices(db, tenant_id)
    return db_sensor

def update_sensor_message_count(db: Session, sensor_id: int, message_increment: int):
    db_sensor = get_sensor(db, sensor_id)
    if db_sensor:
        db_sensor.message_count += message_increment
        billing = get_billing_by_tenant(db, db_sensor.tenant_id)
        if billing:
            billing.message_count += message_increment
            billing.amount_due = calculate_amount_due(billing.message_count, billing.sensor_count, billing.ml_features)
            db.commit()
            db.refresh(billing)
        db.commit()
        db.refresh(db_sensor)
        update_tenant_iot_devices(db, db_sensor.tenant_id)
    return db_sensor

def get_sensor_data(sensor_id: int, tenant_id: int) -> List[schemas.SensorDataPoint]:
    conn = trino.dbapi.connect(
        host="trino_host",  
        port=8080,
        user="user",
        catalog="iceberg",
        schema="default"
    )
    cur = conn.cursor()
    query = """
        SELECT timestamp, payload
        FROM sensor_data
        WHERE sensor_id = %s AND tenant_id = %s
        ORDER BY timestamp DESC
        LIMIT 100
    """
    cur.execute(query, (sensor_id, tenant_id))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [schemas.SensorDataPoint(timestamp=row[0], payload=row[1]) for row in rows]