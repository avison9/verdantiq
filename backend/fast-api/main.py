from fastapi import FastAPI, Depends, HTTPException, status, Request, Response
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional, Dict
from schemas import UserCreate, UserResponse, Token, LoginRequest, UserStatus, UserUpdateRequest, UserUpdate
from crud import create_user, get_user_by_email, update_user, log_activity
from authenticate import verify_password, create_session, expire_session, decode_access_token
from configs import get_db
from models import User, Session, SessionStatus, UserProfile

app = FastAPI(title="VerdantIQ Multi-Tenant API")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login", auto_error=False)

async def get_current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No token provided")
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    user = db.query(User).filter(User.user_id == payload["user_id"], User.tenant_id == payload["tenant_id"]).first()
    if user is None:
        raise credentials_exception
    session = db.query(Session).filter(Session.token == token, Session.user_id == user.user_id, Session.status == SessionStatus.active).first()
    if not session or session.expires_at < datetime.utcnow():
        raise credentials_exception
    session.last_active = datetime.utcnow()
    db.commit()
    return user

@app.post("/register", response_model=UserResponse)
async def register_user(user: UserCreate, db: Session = Depends(get_db), request: Request = None):
    db_user = create_user(db, user)
    log_activity(db, db_user.user_id, db_user.tenant_id, "register", {
        "device_info": {
            "user_agent": request.headers.get("User-Agent", "unknown"),
            "ip_address": request.client.host
        },
        "tenant_profile": user.tenant_profile.dict() if hasattr(user.tenant_profile, "dict") else user.tenant_profile or {},
        "user_profile": user.user_profile if isinstance(user.user_profile, dict) else user.user_profile.dict() or {}

    })
    return db_user

@app.post("/login")
async def login_user(login: LoginRequest, response: Response, db: Session = Depends(get_db), request: Request = None):
    db_user = get_user_by_email(db, login.email)
    if not db_user or not verify_password(login.password, db_user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if db_user.status != UserStatus.active:
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
        max_age=int(expires_delta.total_seconds())
    )
   
    log_activity(db, db_user.user_id, db_user.tenant_id, "login", {
        "device_info": db_session.device_info,
        "network_info": db_session.network_info
    })
   
    return response

@app.post("/logout")
async def logout_user(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    token = request.cookies.get("access_token") 
    if token:
        db_session = db.query(Session).filter(
            Session.token == token,
            Session.user_id == current_user.user_id
        ).first()
        if db_session:
            expire_session(db, db_session.session_id, current_user.user_id)
    response.delete_cookie("access_token")
    log_activity(db, current_user.user_id, current_user.tenant_id, "logout", {})
    return {"message": "Logged out successfully"}



@app.get("/users/me", response_model=UserResponse)
async def get_user_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.user_id).first()
    current_user.profile = db_profile
    return current_user

@app.put("/users/me", response_model=UserResponse)
async def update_user_me(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    request: Request = None
):
    updated_user = update_user(db, current_user.user_id, current_user.tenant_id, user_update)
    log_activity(db, current_user.user_id, current_user.tenant_id, "update_profile", {
        "updated_fields": user_update.dict(exclude_unset=True),
        "device_info": {
            "user_agent": request.headers.get("User-Agent", "unknown"),
            "ip_address": request.client.host
        }
    })
    return updated_user
