from pwdlib import PasswordHash
from pwdlib.hashers.bcrypt import BcryptHasher
import jwt as pyjwt
from jwt.exceptions import InvalidTokenError
from fastapi import HTTPException, status, Request
from datetime import datetime, timedelta
from configs import SECRET_KEY, ALGORITHM
from sqlalchemy.orm import Session
from models import Session as DBSession, SessionStatus
from typing import Optional

# ─── Password hashing ────────────────────────────────────────────────────────

_hasher = PasswordHash((BcryptHasher(),))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return _hasher.check(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return _hasher.hash(password)


# ─── JWT ─────────────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=30))
    to_encode.update({"exp": expire})
    return pyjwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        payload = pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        tenant_id: str = payload.get("tenant_id")
        if user_id is None or tenant_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return {"user_id": int(user_id), "tenant_id": int(tenant_id)}
    except InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


# ─── Session management ───────────────────────────────────────────────────────

def create_session(
    db: Session,
    user_id: int,
    tenant_id: int,
    request: Request,
    expires_delta: timedelta,
):
    token = create_access_token({"sub": str(user_id), "tenant_id": str(tenant_id)}, expires_delta)
    db_session = DBSession(
        user_id=user_id,
        tenant_id=tenant_id,
        token=token,
        expires_at=datetime.utcnow() + expires_delta,
        device_info={
            "user_agent": request.headers.get("User-Agent", "unknown"),
            "device_type": request.headers.get("Sec-CH-UA-Platform", "unknown"),
        },
        network_info={"ip_address": request.client.host},
        agric_metadata={},
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session, token


def expire_session(db: Session, session_id: int, user_id: int) -> None:
    db_session = (
        db.query(DBSession)
        .filter(DBSession.session_id == session_id, DBSession.user_id == user_id)
        .first()
    )
    if db_session:
        db_session.status = SessionStatus.logged_out
        db_session.last_active = datetime.utcnow()
        db.commit()
