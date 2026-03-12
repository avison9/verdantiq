from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.exc import OperationalError
import time


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@postgres:5432/verdantiq"
    SECRET_KEY: str = "changeme-in-production-generate-with-secrets-token-hex-32"
    ALGORITHM: str = "HS256"
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

DATABASE_URL = settings.DATABASE_URL
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ALLOWED_ORIGINS = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",")]


def connect_with_retry(max_attempts: int = 5, delay: int = 5):
    attempts = 0
    while attempts < max_attempts:
        try:
            engine = create_engine(DATABASE_URL)
            engine.connect()
            return engine
        except OperationalError:
            attempts += 1
            print(f"DB connection failed, retrying {attempts}/{max_attempts}...")
            time.sleep(delay)
    raise Exception("Failed to connect to database after retries")


engine = connect_with_retry()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
