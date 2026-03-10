"""Minimal JWT verification for the Tenant service.
No password hashing needed — that lives in the Auth service.
"""
import jwt as pyjwt
from jwt.exceptions import InvalidTokenError
from fastapi import HTTPException, status
from configs import SECRET_KEY, ALGORITHM


def decode_access_token(token: str) -> dict:
    try:
        payload = pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        tenant_id = payload.get("tenant_id")
        if user_id is None or tenant_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return {"user_id": int(user_id), "tenant_id": int(tenant_id)}
    except InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
