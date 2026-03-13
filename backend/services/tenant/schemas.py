from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List
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
    skrill = "skrill"
    revolut = "revolut"


class BillingCreate(BaseModel):
    tenant_id: int
    frequency: BillingFrequency
    payment_method: PaymentMethod
    due_date: datetime


class BillingResponse(BillingCreate):
    id: int
    status: BillingStatus
    balance: float = 0.0
    amount_due: float
    message_count: int
    sensor_count: int
    last_payment_date: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class BillingTopUpRequest(BaseModel):
    amount: float
    payment_method: str = "credit_card"
    # Credit / debit card fields
    cardholder_name: Optional[str] = None
    card_number: Optional[str] = None
    card_expiry: Optional[str] = None
    card_cvv: Optional[str] = None
    # PayPal / Skrill / Revolut
    payer_email: Optional[str] = None
    # Wire transfer
    reference: Optional[str] = None


class TransactionType(str, Enum):
    credit = "credit"
    debit = "debit"


class TransactionResponse(BaseModel):
    id: int
    billing_id: int
    type: TransactionType
    amount: float
    balance_after: float
    description: str
    payment_method: Optional[str] = None
    card_last4: Optional[str] = None
    card_brand: Optional[str] = None
    sensor_id: Optional[int] = None
    sensor_name: Optional[str] = None
    usage_period: Optional[str] = None
    data_points: Optional[int] = None
    reference: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TransactionPage(BaseModel):
    items: List[TransactionResponse]
    total: int
    page: int
    per_page: int
    pages: int


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
