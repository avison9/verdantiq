import pytest
import time
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from models import Base
from main import app, get_db
from configs import SECRET_KEY, ALGORITHM
from jose import jwt

# ---------------------
# DATABASE CONFIGURATION
# ---------------------
POSTGRES_USER = "postgres"
POSTGRES_PASSWORD = "postgres"
POSTGRES_DB = "test_db"
POSTGRES_HOST = "postgres"
POSTGRES_PORT = "5432"

TEST_DATABASE_URL = (
    f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
)

# Disable connection pooling (avoids reused sessions that can cause leaks)
engine = create_engine(TEST_DATABASE_URL, poolclass=NullPool)

# Session factory bound to our test engine
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ---------------------
# GLOBAL DB SETUP
# ---------------------
@pytest.fixture(scope="session", autouse=True)
def prepare_database():
    """
    Runs once per test session.
    Creates the database schema before any tests run.
    Does not drop tables to avoid teardown deadlocks.
    """
    Base.metadata.create_all(bind=engine)
    yield
    # Do not drop tables — this avoids locking conflicts during teardown.


# ---------------------
# DATABASE OVERRIDE (Used by FastAPI dependency injection)
# ---------------------
def override_get_db():
    """
    Used by FastAPI to inject our test session into routes.
    Replaced per test to use isolated transactional sessions.
    """
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db


# ---------------------
# PER-TEST TRANSACTIONAL DB SESSION
# ---------------------
@pytest.fixture
def db_session():
    """
    Wrap each test in a transaction and roll it back at the end.
    Ensures full isolation without needing to drop/create tables repeatedly.
    """
    connection = engine.connect()
    transaction = connection.begin()  # Begin outer transaction
    session = TestingSessionLocal(bind=connection)

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()  # Rollback changes made during the test
        connection.close()


# ---------------------
# FASTAPI TEST CLIENT
# ---------------------
@pytest.fixture
def client(db_session):
    """
    Yields a TestClient with the overridden session.
    Ensures routes use the same transactional session.
    """
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    return TestClient(app)


# ---------------------
# COMMON TEST DATA FIXTURES
# ---------------------

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
    """
    Returns a function to create JWT tokens for test users.
    """
    def _generate_token(user_id: int, tenant_id: int):
        expire = datetime.utcnow() + timedelta(minutes=30)
        to_encode = {"sub": str(user_id), "tenant_id": str(tenant_id), "exp": expire}
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    return _generate_token
