# schema for the database models
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List, Dict
from enum import Enum

class TenantStatus(str, Enum):
    active = "active"
    inactive = "inactive"
    suspended = "suspended"

class UserStatus(str, Enum):
    active = "active"
    inactive = "inactive"
    pending = "pending"

class SessionStatus(str, Enum):
    active = "active"
    expired = "expired"
    logged_out = "logged_out"

class TenantProfileCreate(BaseModel):
    country: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    farm_size: Optional[float] = None
    crop_types: Optional[List[str]] = None
    livestock_types: Optional[List[str]] = None
    farming_practices: Optional[str] = None
    irrigation_methods: Optional[str] = None
    soil_type: Optional[str] = None
    certifications: Optional[List[str]] = None
    business_type: Optional[str] = None
    years_in_operation: Optional[int] = None
    iot_devices: Optional[List[str]] = None

class TenantProfileResponse(BaseModel):
    tenant_id: int
    country: Optional[str]
    address: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    farm_size: Optional[float]
    crop_types: Optional[List[str]]
    livestock_types: Optional[List[str]]
    farming_practices: Optional[str]
    irrigation_methods: Optional[str]
    soil_type: Optional[str]
    certifications: Optional[List[str]]
    business_type: Optional[str]
    years_in_operation: Optional[int]
    iot_devices: Optional[List[str]]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    tenant_id: Optional[int] = None
    tenant_name: Optional[str] = None
    tenant_profile: Optional[TenantProfileCreate] = None
    user_profile: Optional[Dict] = None  # e.g., {"country": "Nigeria", "role": "manager"}

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    tenant_id: Optional[int] = None
    tenant_name: Optional[str] = None
    tenant_profile: Optional[TenantProfileCreate] = None
    user_profile: Optional[Dict] = None

class UserProfileResponse(BaseModel):
    user_id: int
    country: Optional[str]
    address: Optional[str]
    role: Optional[str]
    position: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class UserResponse(BaseModel):
    user_id: int
    email: EmailStr
    first_name: Optional[str]
    last_name: Optional[str]
    status: UserStatus
    created_at: datetime
    profile: Optional[UserProfileResponse]

    class Config:
        from_attributes = True

class UserUpdateRequest(UserCreate):
    user_profile: Optional[Dict] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str