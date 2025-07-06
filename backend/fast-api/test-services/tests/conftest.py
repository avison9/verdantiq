import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.pool import NullPool
from models import Base
from main import app, get_db
from datetime import datetime, timedelta
from configs import SECRET_KEY, ALGORITHM
from jose import jwt
import time

# ---------------------------------------------------
# Database Configuration Sample For Testing
# ---------------------------------------------------
POSTGRES_USER = "postgres"
POSTGRES_PASSWORD = "postgres"
POSTGRES_DB = "test_db"
POSTGRES_HOST = "postgres"
POSTGRES_PORT = "5432"

# Construct the test database URL for SQLAlchemy engine
TEST_DATABASE_URL = (
    f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
)

# Create SQLAlchemy engine with NullPool to avoid connection reuse between tests
engine = create_engine(TEST_DATABASE_URL, poolclass=NullPool)

# Create a sessionmaker factory bound to the test engine
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ---------------------------------------------------
# Database Preparation Fixture
# ---------------------------------------------------
@pytest.fixture(scope="session", autouse=True)
def prepare_database():
    """
    Set up the database schema before any tests run and clean up after all tests complete.
    This fixture is session-scoped and runs automatically.
    """
    # Create all tables defined in SQLAlchemy Base metadata before tests
    Base.metadata.create_all(bind=engine)

    yield  

    # Small delay to ensure all DB transactions are finished and avoid deadlocks
    time.sleep(0.5)

    with engine.connect() as conn:
        # Commit or rollback any open transactions
        conn.execute(text("COMMIT"))
        # Drop all tables cleanly after all tests
        Base.metadata.drop_all(bind=conn)

# ---------------------------------------------------
# Dependency Override for FastAPI get_db
# ---------------------------------------------------
def override_get_db():
    """
    Override the FastAPI dependency that provides a database session.
    Yields a new session from TestingSessionLocal and ensures it closes properly.
    """
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

# Override the app's get_db dependency with the test version
app.dependency_overrides[get_db] = override_get_db

# ---------------------------------------------------
# DB Session Fixture for Tests
# ---------------------------------------------------
@pytest.fixture
def db_session():
    """
    Provide a transactional scope for a test.
    Each test gets a new DB connection and transaction, which is rolled back after the test.
    This keeps tests isolated and the database clean.
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    try:
        yield session  
    finally:
        session.close()
        transaction.rollback() 
        connection.close()

# ---------------------------------------------------
# Test Client Fixture with DB Override
# ---------------------------------------------------
@pytest.fixture
def client(db_session):
    """
    Provide a FastAPI TestClient instance with the database session dependency overridden
    to use the transactional test session from db_session fixture.
    """
    def _override_get_db():
        try:
            yield db_session
        finally:
            db_session.close()

    app.dependency_overrides[get_db] = _override_get_db
    return TestClient(app)

# ---------------------------------------------------
# User and Authentication Fixtures
# ---------------------------------------------------
@pytest.fixture
def user_data():
    """
    Sample user data fixture to simulate creating a new user and tenant.
    Includes nested tenant_profile and user_profile data.
    """
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
    """
    Sample fixture for a user that belongs to an existing tenant.
    Used to test scenarios involving multi-tenant users.
    """
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
    """
    Fixture providing user credentials for authentication tests.
    """
    return {
        "email": "farmer@example.com",
        "password": "password123"
    }

@pytest.fixture
def generate_token():
    """
    Factory fixture to generate JWT tokens for testing authentication.
    The token includes user_id, tenant_id, and expiration.
    """
    def _generate_token(user_id: int, tenant_id: int):
        expire = datetime.utcnow() + timedelta(minutes=30)
        to_encode = {"sub": str(user_id), "tenant_id": str(tenant_id), "exp": expire}
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    return _generate_token
