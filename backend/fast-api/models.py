from sqlalchemy import Column, Integer, String, Enum, DateTime, Float, ForeignKey, Numeric, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from configs import Base
import enum

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

class SensorStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"

class Tenant(Base):
    __tablename__ = "tenants"
    tenant_id = Column(Integer, primary_key=True, index=True)
    tenant_name = Column(String(100), nullable=False, unique=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, onupdate=func.now())
    status = Column(Enum(TenantStatus), nullable=False, default=TenantStatus.active)

    billings = relationship("Billing", back_populates="tenant")
    sensors = relationship("Sensor", back_populates="tenant")
    users = relationship("User", back_populates="tenant")

class TenantProfile(Base):
    __tablename__ = "tenant_profiles"
    tenant_id = Column(Integer, ForeignKey("tenants.tenant_id"), primary_key=True)
    country = Column(String(100))
    address = Column(String(255))
    latitude = Column(Numeric(9, 6))
    longitude = Column(Numeric(9, 6))
    farm_size = Column(Numeric(10, 2))
    crop_types = Column(JSON)
    livestock_types = Column(JSON)
    farming_practices = Column(String(50))
    irrigation_methods = Column(String(50))
    soil_type = Column(String(50))
    certifications = Column(JSON)
    business_type = Column(String(50))
    years_in_operation = Column(Integer)
    iot_devices = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, onupdate=func.now())

class User(Base):
    __tablename__ = "users"
    user_id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.tenant_id"), nullable=False, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(50))
    last_name = Column(String(50))
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, onupdate=func.now())
    status = Column(Enum(UserStatus), nullable=False, default=UserStatus.active)

    profile = relationship("UserProfile", uselist=False, back_populates="user")
    sensors = relationship("Sensor", back_populates="user")
    tenant = relationship("Tenant", back_populates="users")

class UserProfile(Base):
    __tablename__ = "user_profiles"
    user_id = Column(Integer, ForeignKey("users.user_id"), primary_key=True)
    country = Column(String(100))
    address = Column(String(255))
    role = Column(String(50))
    position = Column(String(50))
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, onupdate=func.now())

    user = relationship("User", back_populates="profile")

class Role(Base):
    __tablename__ = "roles"
    role_id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.tenant_id"), nullable=False, index=True)
    role_name = Column(String(50), nullable=False)
    description = Column(String)

class UserRole(Base):
    __tablename__ = "user_roles"
    user_id = Column(Integer, ForeignKey("users.user_id"), primary_key=True)
    role_id = Column(Integer, ForeignKey("roles.role_id"), primary_key=True)
    assigned_at = Column(DateTime, server_default=func.now(), nullable=False)

class Session(Base):
    __tablename__ = "sessions"
    session_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.tenant_id"), nullable=False, index=True)
    token = Column(String(500), nullable=False, index=True)
    start_time = Column(DateTime, server_default=func.now(), nullable=False)
    last_active = Column(DateTime, server_default=func.now(), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    device_info = Column(JSON)
    network_info = Column(JSON)
    agric_metadata = Column(JSON)
    status = Column(Enum(SessionStatus), nullable=False, default=SessionStatus.active)

class UserActivityLog(Base):
    __tablename__ = "user_activity_logs"
    log_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.tenant_id"), nullable=False, index=True)
    action = Column(String(50), nullable=False)
    details = Column(JSON)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

class Billing(Base):
    __tablename__ = "billings"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.tenant_id"), nullable=False)
    status = Column(Enum(BillingStatus), default=BillingStatus.ACTIVE, nullable=False)
    frequency = Column(Enum(BillingFrequency), default=BillingFrequency.MONTHLY, nullable=False)
    payment_method = Column(Enum(PaymentMethod), nullable=False)
    amount_due = Column(Float, default=0.0)
    message_count = Column(Integer, default=0)
    sensor_count = Column(Integer, default=0)
    due_date = Column(DateTime, nullable=False)
    last_payment_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, onupdate=func.now())

    tenant = relationship("Tenant", back_populates="billings")
    ml_features = relationship("MLFeatureSubscription", back_populates="billing")

class MLFeatureSubscription(Base):
    __tablename__ = "ml_feature_subscriptions"
    id = Column(Integer, primary_key=True, index=True)
    billing_id = Column(Integer, ForeignKey("billings.id"), nullable=False)
    feature_name = Column(String, nullable=False)
    cost = Column(Float, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    billing = relationship("Billing", back_populates="ml_features")

class Sensor(Base):
    __tablename__ = "sensors"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.tenant_id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    name = Column(String, nullable=False)
    mqtt_token = Column(String, unique=True, nullable=False)
    status = Column(Enum(SensorStatus), default=SensorStatus.INACTIVE, nullable=False)
    message_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, onupdate=func.now())

    tenant = relationship("Tenant", back_populates="sensors")
    user = relationship("User", back_populates="sensors")