# performing crud operations
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from models import Tenant, User, UserProfile, TenantProfile, Role, UserRole, UserActivityLog, TenantStatus, UserStatus
from schemas import UserCreate
from authenticate import get_password_hash, verify_password
from sqlalchemy.sql import func
from typing import Optional, Dict

def create_tenant(db: Session, tenant_name: str, tenant_profile: Optional[Dict] = None):
    db_tenant = db.query(Tenant).filter(Tenant.tenant_name == tenant_name).first()
    if db_tenant:
        raise HTTPException(status_code=400, detail="Tenant name already exists")
    db_tenant = Tenant(tenant_name=tenant_name, status=TenantStatus.active)
    db.add(db_tenant)
    db.commit()
    db.refresh(db_tenant)

    if tenant_profile:
        db_tenant_profile = TenantProfile(tenant_id=db_tenant.tenant_id, **tenant_profile.dict())
        db.add(db_tenant_profile)
        db.commit()

    return db_tenant

def create_user(db: Session, user: UserCreate):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
   
    # Handle tenant creation or validation
    if user.tenant_id:
        db_tenant = db.query(Tenant).filter(Tenant.tenant_id == user.tenant_id).first()
        if not db_tenant:
            raise HTTPException(status_code=400, detail="Invalid tenant_id")
        tenant_id = user.tenant_id
    elif user.tenant_name:
        db_tenant = create_tenant(db, user.tenant_name, user.tenant_profile)
        tenant_id = db_tenant.tenant_id
    else:
        raise HTTPException(status_code=400, detail="Either tenant_id or tenant_name must be provided")

    # Create user
    db_user = User(
        tenant_id=tenant_id,
        email=user.email,
        password_hash=get_password_hash(user.password),
        first_name=user.first_name,
        last_name=user.last_name,
        status=UserStatus.active
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Create user profile if provided
    if user.user_profile:
        db_profile = UserProfile(user_id=db_user.user_id, **user.user_profile)
        db.add(db_profile)
        db.commit()

    # Assign Admin role if new tenant
    if user.tenant_name:
        db_role = Role(tenant_id=tenant_id, role_name="Admin", description="Tenant admin")
        db.add(db_role)
        db.commit()
        db.refresh(db_role)
        db_user_role = UserRole(user_id=db_user.user_id, role_id=db_role.role_id)
        db.add(db_user_role)
        db.commit()

    return db_user

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

# def update_user(db: Session, user_id: int, tenant_id: int, user_update: UserCreate, user_profile: Optional[Dict] = None):
#     db_user = db.query(User).filter(User.user_id == user_id, User.tenant_id == tenant_id).first()
#     if not db_user:
#         raise HTTPException(status_code=404, detail="User not found")
#     if user_update.first_name:
#         db_user.first_name = user_update.first_name
#     if user_update.last_name:
#         db_user.last_name = user_update.last_name
#     if user_update.password:
#         db_user.password_hash = get_password_hash(user_update.password)
#     db_user.updated_at = func.now()
#     db.commit()

#     if user_profile:
#         db_profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
#         if db_profile:
#             for key, value in user_profile.items():
#                 setattr(db_profile, key, value)
#             db_profile.updated_at = func.now()
#         else:
#             db_profile = UserProfile(user_id=user_id, **user_profile)
#             db.add(db_profile)
#         db.commit()

#     db.refresh(db_user)
#     return db_user

def update_user(db: Session, user_id: int, tenant_id: int, user_update):
    user = db.query(User).filter(User.user_id == user_id, User.tenant_id == tenant_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = user_update.dict(exclude_unset=True)

    # Update basic User fields
    if "email" in update_data:
        user.email = update_data["email"]
    if "password" in update_data:
        user.password_hash = hash_password(update_data["password"])
    if "first_name" in update_data:
        user.first_name = update_data["first_name"]
    if "last_name" in update_data:
        user.last_name = update_data["last_name"]

    # tenant_id is usually fixed, but if you want to allow change:
    if "tenant_id" in update_data:
        user.tenant_id = update_data["tenant_id"]

    # Update tenant profile if provided
    if "tenant_profile" in update_data and update_data["tenant_profile"]:
        tenant_profile_data = update_data["tenant_profile"]
        tenant_profile = db.query(TenantProfile).filter(TenantProfile.tenant_id == user.tenant_id).first()
        if tenant_profile is None:
            tenant_profile = TenantProfile(tenant_id=user.tenant_id)
            db.add(tenant_profile)
        for key, value in tenant_profile_data.items():
            if hasattr(tenant_profile, key):
                setattr(tenant_profile, key, value)

    # Update user profile if provided
    if "user_profile" in update_data and update_data["user_profile"]:
        user_profile_data = update_data["user_profile"]
        profile = db.query(UserProfile).filter(UserProfile.user_id == user.user_id).first()
        if profile is None:
            profile = UserProfile(user_id=user.user_id)
            db.add(profile)
        for key, value in user_profile_data.items():
            if hasattr(profile, key):
                setattr(profile, key, value)

    db.commit()
    db.refresh(user)
    return user

def log_activity(db: Session, user_id: int, tenant_id: int, action: str, details: Dict):
    db_log = UserActivityLog(
        user_id=user_id,
        tenant_id=tenant_id,
        action=action,
        details=details
    )
    db.add(db_log)
    db.commit()