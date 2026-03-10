import os
import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

os.environ.setdefault("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-for-ci-only-min-32-bytes!")
os.environ.setdefault("ALGORITHM", "HS256")

TEST_DATABASE_URL = os.environ["DATABASE_URL"]

import models  # noqa: E402
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
    """Create a tenant + user directly in DB and return the user."""
    tenant = models.Tenant(tenant_name="TestFarm", status=models.TenantStatus.active)
    db_session.add(tenant)
    db_session.commit()
    db_session.refresh(tenant)

    user = models.User(
        tenant_id=tenant.tenant_id,
        email="test@example.com",
        password_hash="hashed",
        status=models.UserStatus.active,
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
def billing_data(mock_user):
    return {
        "tenant_id": mock_user.tenant_id,
        "frequency": "monthly",
        "payment_method": "credit_card",
        "due_date": (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=30)).isoformat(),
    }
