from sqlalchemy.orm import Session
from fastapi import HTTPException
from typing import Optional, Dict
from datetime import datetime, timedelta, timezone
import secrets
import models
import schemas
from authenticate import get_password_hash


def create_tenant(db: Session, tenant_name: str, tenant_profile: Optional[schemas.TenantProfileCreate] = None):
    existing = db.query(models.Tenant).filter(models.Tenant.tenant_name == tenant_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tenant name already exists")

    db_tenant = models.Tenant(tenant_name=tenant_name, status=models.TenantStatus.active)
    db.add(db_tenant)
    db.commit()
    db.refresh(db_tenant)

    if tenant_profile:
        db_profile = models.TenantProfile(
            tenant_id=db_tenant.tenant_id,
            **tenant_profile.model_dump(exclude_unset=True),
        )
        db.add(db_profile)
        db.commit()

    return db_tenant


def create_user(db: Session, user: schemas.UserCreate):
    if db.query(models.User).filter(models.User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    if user.tenant_id:
        if not db.query(models.Tenant).filter(models.Tenant.tenant_id == user.tenant_id).first():
            raise HTTPException(status_code=400, detail="Invalid tenant_id")
        tenant_id = user.tenant_id
    elif user.tenant_name:
        db_tenant = create_tenant(db, user.tenant_name, user.tenant_profile)
        tenant_id = db_tenant.tenant_id
    else:
        raise HTTPException(status_code=400, detail="Either tenant_id or tenant_name must be provided")

    db_user = models.User(
        tenant_id=tenant_id,
        email=user.email,
        password_hash=get_password_hash(user.password),
        first_name=user.first_name,
        last_name=user.last_name,
        status=models.UserStatus.active,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    if user.user_profile:
        db_profile = models.UserProfile(user_id=db_user.user_id, **user.user_profile)
        db.add(db_profile)
        db.commit()

    if user.tenant_name:
        db_role = models.Role(tenant_id=tenant_id, role_name="Admin", description="Tenant admin")
        db.add(db_role)
        db.commit()
        db.refresh(db_role)
        db.add(models.UserRole(user_id=db_user.user_id, role_id=db_role.role_id))
        db.commit()

    return db_user


def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def update_user(db: Session, user_id: int, tenant_id: int, user_update: schemas.UserUpdate):
    user = db.query(models.User).filter(
        models.User.user_id == user_id, models.User.tenant_id == tenant_id
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = user_update.model_dump(exclude_unset=True)
    if "email" in update_data:
        user.email = update_data["email"]
    if "password" in update_data:
        user.password_hash = get_password_hash(update_data["password"])
    if "first_name" in update_data:
        user.first_name = update_data["first_name"]
    if "last_name" in update_data:
        user.last_name = update_data["last_name"]

    if "tenant_profile" in update_data and update_data["tenant_profile"]:
        profile_data = update_data["tenant_profile"]
        tenant_profile = db.query(models.TenantProfile).filter(
            models.TenantProfile.tenant_id == user.tenant_id
        ).first()
        if tenant_profile is None:
            tenant_profile = models.TenantProfile(tenant_id=user.tenant_id)
            db.add(tenant_profile)
        for key, value in profile_data.items():
            if hasattr(tenant_profile, key):
                setattr(tenant_profile, key, value)

    if "user_profile" in update_data and update_data["user_profile"]:
        profile = db.query(models.UserProfile).filter(
            models.UserProfile.user_id == user.user_id
        ).first()
        if profile is None:
            profile = models.UserProfile(user_id=user.user_id)
            db.add(profile)
        for key, value in update_data["user_profile"].items():
            if hasattr(profile, key):
                setattr(profile, key, value)

    db.commit()
    db.refresh(user)
    return user


def log_activity(db: Session, user_id: int, tenant_id: int, action: str, details: Dict):
    db.add(models.UserActivityLog(
        user_id=user_id, tenant_id=tenant_id, action=action, details=details
    ))
    db.commit()


def get_user_role(db: Session, user_id: int, tenant_id: int) -> Optional[str]:
    """Returns the lowercase role name for user in the tenant, or None."""
    role = (
        db.query(models.Role)
        .join(models.UserRole, models.Role.role_id == models.UserRole.role_id)
        .filter(
            models.UserRole.user_id == user_id,
            models.Role.tenant_id == tenant_id,
        )
        .first()
    )
    return role.role_name.lower() if role else None


def assign_role(db: Session, user_id: int, tenant_id: int, role_name: str) -> None:
    """Assign (replace) the role for a user within a tenant."""
    role = db.query(models.Role).filter(
        models.Role.tenant_id == tenant_id,
        models.Role.role_name.ilike(role_name),
    ).first()
    if not role:
        role = models.Role(tenant_id=tenant_id, role_name=role_name.title())
        db.add(role)
        db.flush()

    # Remove existing role assignments for this user in this tenant
    existing_role_ids = db.query(models.Role.role_id).filter(
        models.Role.tenant_id == tenant_id
    ).scalar_subquery()
    db.query(models.UserRole).filter(
        models.UserRole.user_id == user_id,
        models.UserRole.role_id.in_(existing_role_ids),
    ).delete(synchronize_session="fetch")

    db.add(models.UserRole(user_id=user_id, role_id=role.role_id))
    db.commit()


def create_password_reset_token(db: Session, user_id: int) -> models.PasswordResetToken:
    """Invalidate prior unused tokens and create a fresh 15-minute reset token."""
    db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.user_id == user_id,
        models.PasswordResetToken.used == False,  # noqa: E712
    ).update({"used": True})
    db.commit()

    token = secrets.token_hex(32)
    expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=15)
    db_token = models.PasswordResetToken(
        user_id=user_id, token=token, expires_at=expires_at
    )
    db.add(db_token)
    db.commit()
    db.refresh(db_token)
    return db_token


def get_valid_reset_token(db: Session, token: str) -> Optional[models.PasswordResetToken]:
    """Return token row if it exists, is unused, and has not expired."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    return db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.token == token,
        models.PasswordResetToken.used == False,  # noqa: E712
        models.PasswordResetToken.expires_at > now,
    ).first()


def use_reset_token(db: Session, token_id: int, user_id: int, new_password: str) -> None:
    """Mark token used and update the user's password hash atomically."""
    db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.token_id == token_id
    ).update({"used": True})
    db.query(models.User).filter(
        models.User.user_id == user_id
    ).update({"password_hash": get_password_hash(new_password)})
    db.commit()
