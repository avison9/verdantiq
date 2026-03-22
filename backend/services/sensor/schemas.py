from pydantic import BaseModel, ConfigDict
from typing import Any, Optional, List
from datetime import datetime, date
from models import SensorStatus
import math


class SensorCreate(BaseModel):
    tenant_id: int
    sensor_name: str
    sensor_type: str
    location: Optional[str] = None
    farm_id: Optional[str] = None
    sensor_metadata: Optional[dict] = None
    # Hardware / identity fields (stored in sensor_metadata)
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    operating_system: Optional[str] = None
    power_type: Optional[str] = None   # "ac" | "dc"


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
    storage_bytes: int = 0
    farm_id: Optional[str] = None
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


class SensorUpdate(BaseModel):
    sensor_name: Optional[str] = None
    sensor_type: Optional[str] = None
    location: Optional[str] = None
    sensor_metadata: Optional[dict] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    operating_system: Optional[str] = None
    power_type: Optional[str] = None


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
    performed_by_name: Optional[str] = None  # first_name of the user
    details: Optional[dict] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SensorAuditPage(BaseModel):
    items: List[SensorAuditLogResponse]
    total: int
    page: int
    per_page: int
    pages: int


class SensorConnectionEventResponse(BaseModel):
    id: int
    sensor_id: str
    tenant_id: int
    event_type: str
    status: str
    message: Optional[str] = None
    details: Optional[dict] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SensorConnectionEventPage(BaseModel):
    items: List[SensorConnectionEventResponse]
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


class ConnectionEventCreate(BaseModel):
    event_type: str
    status: str = "success"
    message: Optional[str] = None
    details: Optional[dict] = None


class FarmCreate(BaseModel):
    farm_name: str
    address: Optional[str] = None
    country: Optional[str] = None
    farm_size_ha: Optional[float] = None
    farm_type: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    perimeter_km: Optional[float] = None
    crops: Optional[List[str]] = None
    rainfall_avg_mm: Optional[float] = None
    sunlight_avg_hrs: Optional[float] = None
    soil_type: Optional[str] = None
    crop_history: Optional[List[dict]] = None
    notes: Optional[str] = None


class FarmUpdate(BaseModel):
    farm_name: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    farm_size_ha: Optional[float] = None
    farm_type: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    perimeter_km: Optional[float] = None
    crops: Optional[List[str]] = None
    rainfall_avg_mm: Optional[float] = None
    sunlight_avg_hrs: Optional[float] = None
    soil_type: Optional[str] = None
    crop_history: Optional[List[dict]] = None
    notes: Optional[str] = None


class FarmResponse(BaseModel):
    farm_id: str
    tenant_id: int
    farm_name: str
    address: Optional[str] = None
    country: Optional[str] = None
    farm_size_ha: Optional[float] = None
    farm_type: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    perimeter_km: Optional[float] = None
    crops: Optional[List[str]] = None
    rainfall_avg_mm: Optional[float] = None
    sunlight_avg_hrs: Optional[float] = None
    soil_type: Optional[str] = None
    crop_history: Optional[List[dict]] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class FarmPage(BaseModel):
    items: List[FarmResponse]
    total: int
    page: int
    per_page: int
    pages: int


class SensorStorageCreate(BaseModel):
    sensor_id: Optional[str] = None
    allocated_gb: float


class SensorStorageResponse(BaseModel):
    storage_id: str
    tenant_id: int
    sensor_id: Optional[str] = None
    allocated_gb: float
    used_bytes: int
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class SensorStoragePage(BaseModel):
    items: List[SensorStorageResponse]
    total: int
    page: int
    per_page: int
    pages: int


class CropManagementCreate(BaseModel):
    farm_id: str
    crop_name: str
    area_ha: Optional[float] = None
    grain_type: Optional[str] = None
    grains_planted: Optional[int] = None
    planting_date: Optional[date] = None
    expected_harvest_date: Optional[date] = None
    notes: Optional[str] = None
    avg_sunlight_hrs: Optional[float] = None
    soil_ph: Optional[float] = None
    soil_humidity: Optional[float] = None


class CropManagementUpdate(BaseModel):
    crop_name: Optional[str] = None
    area_ha: Optional[float] = None
    grain_type: Optional[str] = None
    grains_planted: Optional[int] = None
    planting_date: Optional[date] = None
    expected_harvest_date: Optional[date] = None
    notes: Optional[str] = None
    avg_sunlight_hrs: Optional[float] = None
    soil_ph: Optional[float] = None
    soil_humidity: Optional[float] = None


class CropManagementResponse(BaseModel):
    id: str
    farm_id: str
    tenant_id: int
    crop_name: str
    area_ha: Optional[float] = None
    grain_type: Optional[str] = None
    grains_planted: Optional[int] = None
    planting_date: Optional[date] = None
    expected_harvest_date: Optional[date] = None
    notes: Optional[str] = None
    avg_sunlight_hrs: Optional[float] = None
    soil_ph: Optional[float] = None
    soil_humidity: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class CropManagementPage(BaseModel):
    items: List[CropManagementResponse]
    total: int
    page: int
    per_page: int
    pages: int


class TenantSuspendRequest(BaseModel):
    tenant_id: int


class QueryRequest(BaseModel):
    sql: str


class QueryResult(BaseModel):
    columns: List[str]
    rows: List[List[Any]]
    ms: int
    qu: float = 0.0     # Query Units consumed
    cost: float = 0.0   # dollar cost = qu × $0.01/QU


class SchemaColumn(BaseModel):
    name: str
    type: str


class SchemaTable(BaseModel):
    name: str
    cols: List[SchemaColumn]


class SchemaEntry(BaseModel):
    name: str
    tables: List[SchemaTable]


class CatalogEntry(BaseModel):
    name: str
    schemas: List[SchemaEntry]


class SchemaTree(BaseModel):
    catalogs: List[CatalogEntry]


class QueryHistoryItem(BaseModel):
    ts: str                     # ISO-8601 timestamp
    sql: str                    # full SQL text
    ms: int                     # execution time in ms
    qu: float = 0.0             # Query Units consumed
    cost: float = 0.0           # dollar cost
    columns: List[str] = []     # result column headers
    rows: List[List[Any]] = []  # result rows (for display on history click)


class QueryHistory(BaseModel):
    items: List[QueryHistoryItem]


class LastSqlResponse(BaseModel):
    sql: Optional[str] = None
