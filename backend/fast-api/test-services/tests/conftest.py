import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from main import app, get_db
from models import Base, Session, SessionStatus
from datetime import datetime, timedelta
from configs import SECRET_KEY, ALGORITHM
from jose import jwt

POSTGRES_USER = "postgres"
POSTGRES_PASSWORD = "postgres"
POSTGRES_DB = "test_db"
POSTGRES_HOST = "postgres"
POSTGRES_PORT = "5432"

TEST_DATABASE_URL = (
    f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
)

engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Override get_db dependency to use test database
def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    # Create tables before each test
    Base.metadata.create_all(bind=engine)
    yield
    # Drop tables after each test
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def user_data():
    return {
        "email": "farmer@example.com",
        "password": "password123",
        "first_name": "John",
        "last_name": "Doe",
        "tenant_name": "GreenFarm",
        "tenant_profile": {
            "country": "Nigeria",
            "address": "123 Farm Road, Ogun",
            "farm_size": 10.5,
            "crop_types": ["maize", "cassava"]
        },
        "user_profile": {
            "country": "Nigeria",
            "address": "456 Worker Lane, Ogun",
            "role": "manager",
            "position": "senior agronomist"
        }
    }


@pytest.fixture
def existing_tenant_user_data():
    return {
        "email": "worker@example.com",
        "password": "password123",
        "tenant_id": 1,
        "user_profile": {
            "country": "Nigeria",
            "role": "field worker"
        }
    }


@pytest.fixture
def login_data():
    return {
        "email": "farmer@example.com",
        "password": "password123"
    }


@pytest.fixture
def generate_token():
    def _generate_token(user_id: int, tenant_id: int):
        expire = datetime.utcnow() + timedelta(minutes=30)
        to_encode = {"sub": str(user_id), "tenant_id": str(tenant_id), "exp": expire}
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    return _generate_token
