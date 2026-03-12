from pydantic import BaseModel, EmailStr, ConfigDict
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
    country: Optional[str] = None
    address: Optional[str] = None
    farm_size: Optional[float] = None
    crop_types: Optional[List[str]] = None
    soil_type: Optional[str] = None
    iot_devices: Optional[List[str]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class UserProfileCreate(BaseModel):
    country: Optional[str] = None
    address: Optional[str] = None
    role: Optional[str] = None
    position: Optional[str] = None


class UserProfileResponse(BaseModel):
    user_id: int
    country: Optional[str] = None
    address: Optional[str] = None
    role: Optional[str] = None
    position: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    tenant_id: Optional[int] = None
    tenant_name: Optional[str] = None
    tenant_profile: Optional[TenantProfileCreate] = None
    user_profile: Optional[Dict] = None


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    tenant_profile: Optional[TenantProfileCreate] = None
    user_profile: Optional[Dict] = None


class UserResponse(BaseModel):
    user_id: int
    tenant_id: int
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    status: UserStatus
    created_at: datetime
    updated_at: Optional[datetime] = None
    profile: Optional[UserProfileResponse] = None
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ForgotPasswordResponse(BaseModel):
    message: str
    reset_token: Optional[str] = None  # populated in dev; replace with email in prod


class RoleAssignRequest(BaseModel):
    role_name: str
