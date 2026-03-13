from sqlalchemy import Column, Integer, String, Enum, DateTime, Float, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from configs import Base
import enum
import uuid


class TenantStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    suspended = "suspended"


class UserStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    pending = "pending"


class SessionStatus(str, enum.Enum):
    active = "active"
    expired = "expired"
    logged_out = "logged_out"


class BillingFrequency(str, enum.Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class BillingStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class PaymentMethod(str, enum.Enum):
    CREDIT_CARD = "credit_card"
    BANK_TRANSFER = "bank_transfer"
    PAYPAL = "paypal"
    SKRILL = "skrill"
    REVOLUT = "revolut"


class TransactionType(str, enum.Enum):
    CREDIT = "credit"
    DEBIT = "debit"


# ─── Read-only references (owned by Auth service) ────────────────────────────

class Tenant(Base):
    __tablename__ = "tenants"
    tenant_id = Column(Integer, primary_key=True, index=True)
    tenant_name = Column(String(100), nullable=False, unique=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, onupdate=func.now())
    status = Column(Enum(TenantStatus), nullable=False, default=TenantStatus.active)

    billings = relationship("Billing", back_populates="tenant")


class User(Base):
    __tablename__ = "users"
    user_id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.tenant_id"), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    status = Column(Enum(UserStatus), nullable=False, default=UserStatus.active)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, onupdate=func.now())


class Session(Base):
    __tablename__ = "sessions"
    session_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.tenant_id"), nullable=False)
    token = Column(String(500), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    last_active = Column(DateTime, server_default=func.now(), nullable=False)
    device_info = Column(JSON)
    network_info = Column(JSON)
    agric_metadata = Column(JSON)
    status = Column(Enum(SessionStatus), nullable=False, default=SessionStatus.active)


# ─── Tenant service owns these ───────────────────────────────────────────────

class Billing(Base):
    __tablename__ = "billings"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.tenant_id"), nullable=False)
    status = Column(Enum(BillingStatus), default=BillingStatus.ACTIVE, nullable=False)
    frequency = Column(Enum(BillingFrequency), default=BillingFrequency.MONTHLY, nullable=False)
    payment_method = Column(String(50), nullable=False)
    balance = Column(Float, default=0.0, nullable=False)
    amount_due = Column(Float, default=0.0)
    message_count = Column(Integer, default=0)
    sensor_count = Column(Integer, default=0)
    due_date = Column(DateTime, nullable=False)
    last_payment_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, onupdate=func.now())

    tenant = relationship("Tenant", back_populates="billings")
    ml_features = relationship("MLFeatureSubscription", back_populates="billing")
    transactions = relationship("Transaction", back_populates="billing", order_by="Transaction.created_at.desc()")


class Transaction(Base):
    __tablename__ = "billing_transactions"
    id = Column(Integer, primary_key=True, index=True)
    billing_id = Column(Integer, ForeignKey("billings.id"), nullable=False)
    type = Column(Enum(TransactionType), nullable=False)
    amount = Column(Float, nullable=False)
    balance_after = Column(Float, nullable=False)
    description = Column(String, nullable=False)
    payment_method = Column(String, nullable=True)
    card_last4 = Column(String(4), nullable=True)
    card_brand = Column(String(20), nullable=True)
    sensor_id = Column(Integer, nullable=True)
    sensor_name = Column(String, nullable=True)
    usage_period = Column(String, nullable=True)
    data_points = Column(Integer, nullable=True)
    reference = Column(String(20), nullable=True, default=lambda: f"TXN-{uuid.uuid4().hex[:8].upper()}")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    billing = relationship("Billing", back_populates="transactions")


class MLFeatureSubscription(Base):
    __tablename__ = "ml_feature_subscriptions"
    id = Column(Integer, primary_key=True, index=True)
    billing_id = Column(Integer, ForeignKey("billings.id"), nullable=False)
    feature_name = Column(String, nullable=False)
    cost = Column(Float, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    billing = relationship("Billing", back_populates="ml_features")
