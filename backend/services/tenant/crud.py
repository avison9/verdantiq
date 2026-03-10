from sqlalchemy.orm import Session
import models
import schemas
from datetime import datetime
from dateutil.relativedelta import relativedelta


SENSOR_MESSAGE_COST = 0.10 / 100000
SENSOR_ONBOARD_FEE = 1.00


def calculate_amount_due(message_count: int, sensor_count: int, ml_features: list) -> float:
    return (
        message_count * SENSOR_MESSAGE_COST
        + sensor_count * SENSOR_ONBOARD_FEE
        + sum(f.cost for f in ml_features)
    )


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


def get_billing_by_tenant(db: Session, tenant_id: int):
    return db.query(models.Billing).filter(models.Billing.tenant_id == tenant_id).first()


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


def create_ml_feature_subscription(
    db: Session,
    ml_feature: schemas.MLFeatureSubscriptionCreate,
    billing_id: int,
):
    db_ml = models.MLFeatureSubscription(**ml_feature.model_dump(), billing_id=billing_id)
    db.add(db_ml)
    db.commit()
    db.refresh(db_ml)
    return db_ml


def update_sensor_count(db: Session, tenant_id: int, delta: int):
    billing = get_billing_by_tenant(db, tenant_id)
    if billing:
        billing.sensor_count = max(0, billing.sensor_count + delta)
        billing.amount_due = calculate_amount_due(
            billing.message_count, billing.sensor_count, billing.ml_features
        )
        db.commit()
        db.refresh(billing)
    return billing


def update_message_count(db: Session, tenant_id: int, increment: int):
    billing = get_billing_by_tenant(db, tenant_id)
    if billing:
        billing.message_count += increment
        billing.amount_due = calculate_amount_due(
            billing.message_count, billing.sensor_count, billing.ml_features
        )
        db.commit()
        db.refresh(billing)
    return billing
