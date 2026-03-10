import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

# Set env vars BEFORE importing service code (Settings() reads them at module init time)
os.environ.setdefault("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-for-ci-only-min-32-bytes!")
os.environ.setdefault("ALGORITHM", "HS256")

TEST_DATABASE_URL = os.environ["DATABASE_URL"]

# pythonpath=["."] in pyproject.toml makes these bare imports resolve to the service root
from configs import Base, get_db  # noqa: E402
from main import app  # noqa: E402

engine = create_engine(TEST_DATABASE_URL, poolclass=NullPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def prepare_database():
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture(autouse=True)
def clean_tables():
    yield
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())


def _override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture
def db_session():
    session = TestingSessionLocal()
    yield session
    session.close()


@pytest.fixture
def client():
    return TestClient(app)


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
            "crop_types": ["maize", "cassava"],
        },
        "user_profile": {
            "country": "Nigeria",
            "address": "456 Worker Lane, Ogun",
            "role": "manager",
            "position": "senior agronomist",
        },
    }


@pytest.fixture
def login_data():
    return {"email": "farmer@example.com", "password": "password123"}
