from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@postgres:5432/verdantiq"
    SECRET_KEY: str = "changeme-in-production-generate-with-secrets-token-hex-32"
    ALGORITHM: str = "HS256"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://13.50.234.104:5173"
    TENANT_SERVICE_URL: str = "http://tenant:8002"
    TRINO_HOST: str = "trino"
    TRINO_PORT: int = 8080
    TRINO_USER: str = "user"
    TRINO_CATALOG: str = "iceberg"
    TRINO_SCHEMA: str = "sensors"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
ALLOWED_ORIGINS = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",")]

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
