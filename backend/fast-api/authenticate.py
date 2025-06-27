from fastapi import HTTPException, status, Request
from fastapi.responses import JSONResponse
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from configs import SECRET_KEY, ALGORITHM
from sqlalchemy.orm import Session
from models import Session, SessionStatus
from typing import Optional

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=30)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        tenant_id: str = payload.get("tenant_id")
        if user_id is None or tenant_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return {"user_id": int(user_id), "tenant_id": int(tenant_id)}
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

def create_session(db: Session, user_id: int, tenant_id: int, request: Request, expires_delta: timedelta):
    token = create_access_token({"sub": str(user_id), "tenant_id": str(tenant_id)}, expires_delta)
    device_info = {
        "user_agent": request.headers.get("User-Agent", "unknown"),
        "device_type": request.headers.get("Sec-CH-UA-Platform", "unknown"),
        "browser": request.headers.get("Sec-CH-UA", "unknown")
    }
    network_info = {
        "ip_address": request.client.host,
        "network_type": "unknown"
    }
    db_session = Session(
        user_id=user_id,
        tenant_id=tenant_id,
        token=token,
        expires_at=datetime.utcnow() + expires_delta,
        device_info=device_info,
        network_info=network_info,
        agric_metadata={}
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session, token

def expire_session(db: Session, session_id: int, user_id: int):
    db_session = db.query(Session).filter(Session.session_id == session_id, Session.user_id == user_id).first()
    if db_session:
        db_session.status = SessionStatus.logged_out
        db_session.last_active = datetime.utcnow()
        db.commit()



