from pydantic import BaseModel
from typing import Any, Optional
from datetime import datetime
from models import SensorStatus


class SensorCreate(BaseModel):
    tenant_id: int
    sensor_name: str
    sensor_type: str
    location: Optional[str] = None
    sensor_metadata: Optional[dict] = None


class SensorResponse(BaseModel):
    sensor_id: int
    tenant_id: int
    user_id: int
    sensor_name: str
    sensor_type: str
    location: Optional[str] = None
    sensor_metadata: Optional[dict] = None
    message_count: int
    status: SensorStatus
    last_message_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SensorDataPoint(BaseModel):
    timestamp: str
    value: Any
    unit: Optional[str] = None


class SensorDataResponse(BaseModel):
    sensor_id: int
    tenant_id: int
    data: list[SensorDataPoint]


class MessageIncrementRequest(BaseModel):
    message_increment: int = 1
