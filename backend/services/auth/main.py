from fastapi import FastAPI, Depends, HTTPException, status, Request, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import models
import schemas
import crud
from authenticate import verify_password, create_session, expire_session, decode_access_token
from configs import get_db

app = FastAPI(title="VerdantIQ Auth Service", version="1.0.0")

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


@app.get("/health")
async def health():
    return {"service": "auth", "status": "ok"}
