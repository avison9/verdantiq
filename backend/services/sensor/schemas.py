from pydantic import BaseModel
from typing import Any, Optional, List
from datetime import datetime
from models import SensorStatus
import math


class SensorCreate(BaseModel):
    tenant_id: int
    sensor_name: str
    sensor_type: str
    location: Optional[str] = None
    sensor_metadata: Optional[dict] = None


class SensorResponse(BaseModel):
    sensor_id: str
    tenant_id: int
    user_id: int
    sensor_name: str
    sensor_type: str
    location: Optional[str] = None
    sensor_metadata: Optional[dict] = None
    mqtt_token: str
    message_count: int
    status: SensorStatus
    last_message_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SensorPage(BaseModel):
    items: List[SensorResponse]
    total: int
    page: int
    per_page: int
    pages: int


class SensorRenameRequest(BaseModel):
    sensor_name: str


class SensorStatusUpdateRequest(BaseModel):
    status: SensorStatus


class SensorAuditLogResponse(BaseModel):
    id: int
    tenant_id: int
    sensor_id: Optional[str] = None
    sensor_name: str
    action: str
    performed_by: int
    details: Optional[dict] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SensorAuditPage(BaseModel):
    items: List[SensorAuditLogResponse]
    total: int
    page: int
    per_page: int
    pages: int


class SensorDataPoint(BaseModel):
    timestamp: str
    value: Any
    unit: Optional[str] = None


class SensorDataResponse(BaseModel):
    sensor_id: str
    tenant_id: int
    data: List[SensorDataPoint]


class MessageIncrementRequest(BaseModel):
    message_increment: int = 1
