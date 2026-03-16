from sqlalchemy import Column, Integer, BigInteger, String, Enum, DateTime, Float, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from configs import Base
import enum
import uuid


class SensorStatus(str, enum.Enum):
    pending     = "pending"
    active      = "active"
    inactive    = "inactive"
    error       = "error"
    maintenance = "maintenance"


class SessionStatus(str, enum.Enum):
    active     = "active"
    expired    = "expired"
    logged_out = "logged_out"


class Sensor(Base):
    __tablename__ = "sensors"
    sensor_id      = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    tenant_id      = Column(Integer, nullable=False, index=True)
    user_id        = Column(Integer, nullable=False, index=True)
    sensor_name    = Column(String(100), nullable=False)
    sensor_type    = Column(String(50), nullable=False)
    location       = Column(String(255))
    sensor_metadata = Column(JSON, nullable=True)
    mqtt_token     = Column(String(36), nullable=False, unique=True)
    message_count  = Column(Integer, default=0, nullable=False)
    storage_bytes  = Column(BigInteger, default=0, nullable=False)
    status         = Column(Enum(SensorStatus), nullable=False, default=SensorStatus.pending)
    last_message_at = Column(DateTime, nullable=True)
    created_at     = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at     = Column(DateTime, onupdate=func.now())

    audit_logs        = relationship("SensorAuditLog", back_populates="sensor", passive_deletes=True)
    connection_events = relationship("SensorConnectionEvent", back_populates="sensor", passive_deletes=True)


class SensorAuditLog(Base):
    __tablename__ = "sensor_audit_logs"
    id           = Column(Integer, primary_key=True, index=True)
    tenant_id    = Column(Integer, nullable=False, index=True)
    sensor_id    = Column(String(36), ForeignKey("sensors.sensor_id", ondelete="SET NULL"), nullable=True, index=True)
    sensor_name  = Column(String(100), nullable=False)   # snapshot at time of action
    action       = Column(String(20), nullable=False)    # "created" | "renamed" | "deleted" | "status_changed"
    performed_by = Column(Integer, nullable=False)        # user_id
    details      = Column(JSON, nullable=True)            # e.g. {"old_name": "...", "new_name": "..."}
    created_at   = Column(DateTime, server_default=func.now(), nullable=False)

    sensor = relationship("Sensor", back_populates="audit_logs")


class SensorConnectionEvent(Base):
    """Immutable event log tracking the lifecycle of a sensor's data pipeline connection."""
    __tablename__ = "sensor_connection_events"
    id          = Column(Integer, primary_key=True, autoincrement=True, index=True)
    sensor_id   = Column(String(36), ForeignKey("sensors.sensor_id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id   = Column(Integer, nullable=False, index=True)
    # event_type: sensor_registered | connection_initiated | data_received | data_streaming | warehouse_synced
    event_type  = Column(String(50), nullable=False)
    # status: success | pending | failed
    status      = Column(String(20), nullable=False, default="success")
    message     = Column(String(500), nullable=True)
    details     = Column(JSON, nullable=True)
    created_at  = Column(DateTime, server_default=func.now(), nullable=False)

    sensor = relationship("Sensor", back_populates="connection_events")


# ── Read-only references — auth service owns these tables ─────────────────────

class User(Base):
    __tablename__ = "users"
    user_id       = Column(Integer, primary_key=True, index=True)
    tenant_id     = Column(Integer, nullable=False, index=True)
    email         = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    first_name    = Column(String(50), nullable=True)
    last_name     = Column(String(50), nullable=True)
    status        = Column(String(20), nullable=False)


class Session(Base):
    __tablename__ = "sessions"
    session_id = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)
    tenant_id  = Column(Integer, nullable=False, index=True)
    token      = Column(String(500), nullable=False, index=True)
    last_active = Column(DateTime, server_default=func.now(), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    status     = Column(Enum(SessionStatus), nullable=False, default=SessionStatus.active)


class Role(Base):
    __tablename__ = "roles"
    role_id   = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False, index=True)
    role_name = Column(String(50), nullable=False)


class UserRole(Base):
    __tablename__ = "user_roles"
    user_id = Column(Integer, ForeignKey("users.user_id"), primary_key=True)
    role_id = Column(Integer, ForeignKey("roles.role_id"), primary_key=True)


class SensorStorage(Base):
    __tablename__ = "sensor_storage"
    storage_id   = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    tenant_id    = Column(Integer, nullable=False, index=True)
    sensor_id    = Column(String(36), ForeignKey("sensors.sensor_id", ondelete="CASCADE"), nullable=True, index=True)
    allocated_gb = Column(Float, nullable=False, default=0.0)
    used_bytes   = Column(BigInteger, nullable=False, default=0)
    status       = Column(String(20), nullable=False, default="active")
    created_at   = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at   = Column(DateTime, onupdate=func.now())
