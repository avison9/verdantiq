# database models
from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, Numeric, JSON
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

class Tenant(Base):
    __tablename__ = "tenants"
    tenant_id = Column(Integer, primary_key=True, index=True)
    tenant_name = Column(String(100), nullable=False, unique=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, onupdate=func.now())
    status = Column(Enum(TenantStatus), nullable=False, default=TenantStatus.active)

class TenantProfile(Base):
    __tablename__ = "tenant_profiles"
    tenant_id = Column(Integer, ForeignKey("tenants.tenant_id"), primary_key=True)
    country = Column(String(100))
    address = Column(String(255))
    latitude = Column(Numeric(9, 6))
    longitude = Column(Numeric(9, 6))
    farm_size = Column(Numeric(10, 2))
    crop_types = Column(JSON)  # e.g., ["maize", "cassava"]
    livestock_types = Column(JSON)  # e.g., ["poultry", "cattle"]
    farming_practices = Column(String(50))  # e.g., "organic"
    irrigation_methods = Column(String(50))  # e.g., "drip"
    soil_type = Column(String(50))  # e.g., "loamy"
    certifications = Column(JSON)  # e.g., ["organic"]
    business_type = Column(String(50))  # e.g., "cooperative"
    years_in_operation = Column(Integer)
    iot_devices = Column(JSON)  # e.g., ["soil_sensor"]
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
    profile = relationship("UserProfile", uselist=False, backref="user")

class UserProfile(Base):
    __tablename__ = "user_profiles"
    user_id = Column(Integer, ForeignKey("users.user_id"), primary_key=True)
    country = Column(String(100))  # User's country
    address = Column(String(255))  # User's personal address
    role = Column(String(50))  # e.g., "manager", "field worker"
    position = Column(String(50))  # e.g., "senior agronomist"
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, onupdate=func.now())

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
    device_info = Column(JSON)  # e.g., {"browser": "Chrome", "os": "Android"}
    network_info = Column(JSON)  # e.g., {"ip": "192.168.1.1", "network_type": "4G"}
    agric_metadata = Column(JSON)  # e.g., {"action": "login"}
    status = Column(Enum(SessionStatus), nullable=False, default=SessionStatus.active)

class UserActivityLog(Base):
    __tablename__ = "user_activity_logs"
    log_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.tenant_id"), nullable=False, index=True)
    action = Column(String(50), nullable=False)
    details = Column(JSON)  # e.g., {"updated_fields": {...}}
    created_at = Column(DateTime, server_default=func.now(), nullable=False)