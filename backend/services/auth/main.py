from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status, Request, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import models
import schemas
import crud
from authenticate import verify_password, create_session, expire_session, decode_access_token
from configs import get_db, Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="VerdantIQ Auth Service", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Auth dependency ──────────────────────────────────────────────────────────

async def get_current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No token provided")
    payload = decode_access_token(token)
    user = db.query(models.User).filter(
        models.User.user_id == payload["user_id"],
        models.User.tenant_id == payload["tenant_id"],
    ).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
    session = db.query(models.Session).filter(
        models.Session.token == token,
        models.Session.user_id == user.user_id,
        models.Session.status == models.SessionStatus.active,
    ).first()
    if not session or session.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    session.last_active = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    return user


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.post("/register", response_model=schemas.UserResponse)
async def register_user(user: schemas.UserCreate, request: Request, db: Session = Depends(get_db)):
    db_user = crud.create_user(db, user)
    crud.log_activity(db, db_user.user_id, db_user.tenant_id, "register", {
        "device_info": {"user_agent": request.headers.get("User-Agent", "unknown")},
        "tenant_profile": user.tenant_profile.model_dump() if user.tenant_profile else {},
        "user_profile": user.user_profile or {},
    })
    return db_user


@app.post("/login")
async def login_user(
    login: schemas.LoginRequest,
    response: Response,
    request: Request,
    db: Session = Depends(get_db),
):
    db_user = crud.get_user_by_email(db, login.email)
    if not db_user or not verify_password(login.password, db_user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if db_user.status != models.UserStatus.active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not active")

    expires_delta = timedelta(minutes=30)
    db_session, token = create_session(db, db_user.user_id, db_user.tenant_id, request, expires_delta)

    response = JSONResponse(content={"access_token": token, "token_type": "bearer"})
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=False,
        samesite="strict",
        max_age=int(expires_delta.total_seconds()),
    )
    crud.log_activity(db, db_user.user_id, db_user.tenant_id, "login", {
        "device_info": db_session.device_info,
        "network_info": db_session.network_info,
    })
    return response


@app.post("/logout")
async def logout_user(
    request: Request,
    response: Response,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    token = request.cookies.get("access_token")
    if token:
        db_session = db.query(models.Session).filter(
            models.Session.token == token,
            models.Session.user_id == current_user.user_id,
        ).first()
        if db_session:
            expire_session(db, db_session.session_id, current_user.user_id)
    response.delete_cookie("access_token")
    crud.log_activity(db, current_user.user_id, current_user.tenant_id, "logout", {})
    return {"message": "Logged out successfully"}


@app.get("/users/me", response_model=schemas.UserResponse)
async def get_user_me(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_profile = db.query(models.UserProfile).filter(
        models.UserProfile.user_id == current_user.user_id
    ).first()
    current_user.profile = db_profile
    return current_user


@app.put("/users/me", response_model=schemas.UserResponse)
async def update_user_me(
    user_update: schemas.UserUpdate,
    request: Request,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updated_user = crud.update_user(db, current_user.user_id, current_user.tenant_id, user_update)
    crud.log_activity(db, current_user.user_id, current_user.tenant_id, "update_profile", {
        "updated_fields": user_update.model_dump(exclude_unset=True),
        "device_info": {"user_agent": request.headers.get("User-Agent", "unknown")},
    })
    return updated_user


@app.post("/forgot-password", response_model=schemas.ForgotPasswordResponse)
async def forgot_password(body: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, body.email)
    if not user:
        # Never reveal whether an email exists (security best practice)
        return schemas.ForgotPasswordResponse(
            message="If an account exists for this email, a password reset link has been sent."
        )
    reset_token = crud.create_password_reset_token(db, user.user_id)
    # TODO (production): send reset_token.token via email instead of returning it
    return schemas.ForgotPasswordResponse(
        message="If an account exists for this email, a password reset link has been sent.",
        reset_token=reset_token.token,
    )


@app.post("/reset-password")
async def reset_password(body: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    token_obj = crud.get_valid_reset_token(db, body.token)
    if not token_obj:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )
    crud.use_reset_token(db, token_obj.token_id, token_obj.user_id, body.new_password)
    return {"message": "Password reset successfully"}


@app.post("/users/{user_id}/roles")
async def assign_user_role(
    user_id: int,
    role_data: schemas.RoleAssignRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_role = crud.get_user_role(db, current_user.user_id, current_user.tenant_id)
    if current_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required to assign roles",
        )
    target = db.query(models.User).filter(
        models.User.user_id == user_id,
        models.User.tenant_id == current_user.tenant_id,
    ).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found in this tenant")
    crud.assign_role(db, user_id, current_user.tenant_id, role_data.role_name)
    return {"message": f"Role '{role_data.role_name}' assigned to user {user_id}"}


@app.get("/health")
async def health():
    return {"service": "auth", "status": "ok"}
