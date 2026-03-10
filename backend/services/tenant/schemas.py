from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional
from enum import Enum


class BillingFrequency(str, Enum):
    monthly = "monthly"
    quarterly = "quarterly"
    yearly = "yearly"


class BillingStatus(str, Enum):
    active = "active"
    inactive = "inactive"
    suspended = "suspended"


class PaymentMethod(str, Enum):
    credit_card = "credit_card"
    bank_transfer = "bank_transfer"
    paypal = "paypal"


class BillingCreate(BaseModel):
    tenant_id: int
    frequency: BillingFrequency
    payment_method: PaymentMethod
    due_date: datetime


class BillingResponse(BillingCreate):
    id: int
    status: BillingStatus
    amount_due: float
    message_count: int
    sensor_count: int
    last_payment_date: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class MLFeatureSubscriptionCreate(BaseModel):
    feature_name: str
    cost: float


class MLFeatureSubscriptionResponse(MLFeatureSubscriptionCreate):
    id: int
    billing_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ─── Internal schemas (used by sensor service cross-service calls) ────────────

class BillingStatusResponse(BaseModel):
    tenant_id: int
    billing_active: bool
    billing_id: Optional[int] = None


class SensorCountUpdate(BaseModel):
    tenant_id: int
    delta: int


class MessageCountUpdate(BaseModel):
    tenant_id: int
    increment: int


class IoTDeviceSyncRequest(BaseModel):
    tenant_id: int
    devices: list
