import os
import pytest
from unittest.mock import AsyncMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

os.environ.setdefault("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-for-ci-only")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("TENANT_SERVICE_URL", "http://localhost:8002")
os.environ.setdefault("TRINO_HOST", "localhost")
os.environ.setdefault("TRINO_PORT", "8080")

TEST_DATABASE_URL = os.environ["DATABASE_URL"]

import models  # noqa: E402
import main as _main_module  # noqa: E402
from configs import Base, get_db  # noqa: E402
from main import app, get_current_user as _get_current_user  # noqa: E402

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


@pytest.fixture(autouse=True)
def mock_http_calls(monkeypatch):
    """Silence all inter-service HTTP calls — sensor service is tested in isolation."""
    monkeypatch.setattr(_main_module, "notify_sensor_delta", AsyncMock())
    monkeypatch.setattr(_main_module, "notify_message_increment", AsyncMock())
    monkeypatch.setattr(_main_module, "sync_iot_devices", AsyncMock())


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
def mock_user(db_session):
    """Create a user in the shared DB (sensor service reads this table)."""
    user = models.User(
        tenant_id=1,
        email="test@example.com",
        password_hash="hashed",
        status="active",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def other_user(db_session):
    """A second user belonging to a different tenant (for unauthorized tests)."""
    user = models.User(
        tenant_id=2,
        email="other@example.com",
        password_hash="hashed",
        status="active",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def client(mock_user):
    async def override_user():
        return mock_user

    app.dependency_overrides[_get_current_user] = override_user
    yield TestClient(app)
    del app.dependency_overrides[_get_current_user]


@pytest.fixture
def sensor_payload(mock_user):
    return {
        "tenant_id": mock_user.tenant_id,
        "sensor_name": "SoilSensor1",
        "sensor_type": "soil_moisture",
        "location": "Field A",
    }
