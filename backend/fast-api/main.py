from fastapi import FastAPI, Depends, HTTPException, status, Request, Response
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Dict
import models
import schemas 
import crud
from authenticate import verify_password, create_session, expire_session, decode_access_token
from configs import get_db

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
    user = db.query(models.User).filter(models.User.user_id == payload["user_id"], models.User.tenant_id == payload["tenant_id"]).first()
    if user is None:
        raise credentials_exception
    session = db.query(models.Session).filter(
        models.Session.token == token,
        models.Session.user_id == user.user_id,
        models.Session.status == models.SessionStatus.active
    ).first()
    if not session or session.expires_at < datetime.utcnow():
        raise credentials_exception
    session.last_active = datetime.utcnow()
    db.commit()
    return user

@app.post("/register", response_model=schemas.UserResponse)
async def register_user(user: schemas.UserCreate, db: Session = Depends(get_db), request: Request = None):
    db_user = crud.create_user(db, user)
    crud.log_activity(db, db_user.user_id, db_user.tenant_id, "register", {
        "device_info": {
            "user_agent": request.headers.get("User-Agent", "unknown"),
            "ip_address": request.client.host
        },
        "tenant_profile": user.tenant_profile.model_dump() if hasattr(user.tenant_profile, "dict") else user.tenant_profile or {},
        "user_profile": user.user_profile if isinstance(user.user_profile, dict) else user.user_profile.model_dump() or {}
    })
    return db_user

@app.post("/login")
async def login_user(login: schemas.LoginRequest, response: Response, db: Session = Depends(get_db), request: Request = None):
    db_user = crud.get_user_by_email(db, login.email)
    if not db_user or not verify_password(login.password, db_user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if db_user.status != schemas.UserStatus.active:
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
   
    crud.log_activity(db, db_user.user_id, db_user.tenant_id, "login", {
        "device_info": db_session.device_info,
        "network_info": db_session.network_info
    })
   
    return response

@app.post("/logout")
async def logout_user(
    request: Request,
    response: Response,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    token = request.cookies.get("access_token") 
    if token:
        db_session = db.query(models.Session).filter(
            models.Session.token == token,
            models.Session.user_id == current_user.user_id
        ).first()
        if db_session:
            expire_session(db, db_session.session_id, current_user.user_id)
    response.delete_cookie("access_token")
    crud.log_activity(db, current_user.user_id, current_user.tenant_id, "logout", {})
    return {"message": "Logged out successfully"}

# Fetch users
@app.get("/users/me", response_model=schemas.UserResponse)
async def get_user_me(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == current_user.user_id).first()
    current_user.profile = db_profile
    return current_user

# Update users
@app.put("/users/me", response_model=schemas.UserResponse)
async def update_user_me(
    user_update: schemas.UserUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
    request: Request = None
):
    updated_user = crud.update_user(db, current_user.user_id, current_user.tenant_id, user_update)
    crud.log_activity(db, current_user.user_id, current_user.tenant_id, "update_profile", {
        "updated_fields": user_update.model_dump(exclude_unset=True),
        "device_info": {
            "user_agent": request.headers.get("User-Agent", "unknown"),
            "ip_address": request.client.host
        }
    })
    return updated_user

# Create Billing
@app.post("/billings/", response_model=schemas.BillingResponse)
async def create_billing(billing: schemas.BillingCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.tenant_id != billing.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not authorized for this tenant")
    return crud.create_billing(db, billing)

# Subscribe to ML Feature
@app.post("/billings/{billing_id}/ml-features/", response_model=schemas.MLFeatureSubscriptionResponse)
async def subscribe_ml_feature(billing_id: int, ml_feature: schemas.MLFeatureSubscriptionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    billing = crud.get_billing_by_tenant(db, current_user.tenant_id)
    if not billing or billing.id != billing_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billing not found or unauthorized")
    return crud.create_ml_feature_subscription(db, ml_feature, billing_id)

# Record Payment (resets counts and updates due date)
@app.post("/billings/{billing_id}/payment", response_model=schemas.BillingResponse)
async def record_payment(billing_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    billing = crud.get_billing_by_tenant(db, current_user.tenant_id)
    if not billing or billing.id != billing_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billing not found or unauthorized")
    return crud.update_billing_on_payment(db, billing)

# Onboard Sensor
@app.post("/sensors/", response_model=schemas.SensorResponse)
async def onboard_sensor(sensor: schemas.SensorCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    billing = crud.get_billing_by_tenant(db, sensor.tenant_id)
    if not billing or billing.status != models.BillingStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Active billing required to onboard sensor")
    if current_user.tenant_id != sensor.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not authorized for this tenant")
    return crud.create_sensor(db, sensor)

# List Sensors
@app.get("/sensors/", response_model=List[schemas.SensorResponse])
async def list_sensors(tenant_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not authorized for this tenant")
    sensors = crud.get_sensors_by_tenant(db, tenant_id)
    return sensors

# Remove Sensor
@app.delete("/sensors/{sensor_id}", response_model=schemas.SensorResponse)
async def delete_sensor(sensor_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    sensor = crud.get_sensor(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")
    if sensor.user_id != current_user.user_id or sensor.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="User not authorized to delete this sensor")
    return crud.delete_sensor(db, sensor_id)

# Sensor Data View
@app.get("/sensors/{sensor_id}/data", response_model=schemas.SensorDataResponse)
async def get_sensor_data(sensor_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    sensor = crud.get_sensor(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor not found")
    if sensor.user_id != current_user.user_id or sensor.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not authorized to view this sensor's data")
    data = crud.get_sensor_data(sensor_id, sensor.tenant_id)
    return schemas.SensorDataResponse(sensor_id=sensor_id, tenant_id=sensor.tenant_id, data=data)

# Sensor messages update
@app.post("/sensors/{sensor_id}/messages", response_model=schemas.SensorResponse)
async def update_sensor_messages(
    sensor_id: int,
    message_data: Dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    sensor = crud.get_sensor(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")
    if sensor.user_id != current_user.user_id or sensor.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="User not authorized to update this sensor")
    message_increment = message_data.get("message_increment", 0)
    return crud.update_sensor_message_count(db, sensor_id, message_increment)