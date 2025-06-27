#configurations
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os
import time
from sqlalchemy.exc import OperationalError

load_dotenv()

# DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@postgres:5432/test_db")
# SECRET_KEY = os.getenv("SECRET_KEY", "30301f02ac0c558826b948af0ff5f65727a9634e1abe9d1e635f74f9508efcd7")

DATABASE_URL ="postgresql://postgres:postgres@postgres:5432/test_db"
SECRET_KEY =  "30301f02ac0c558826b948af0ff5f65727a9634e1abe9d1e635f74f9508efcd7"
ALGORITHM = "HS256"

# python -c "import secrets; print(secrets.token_hex(32))"

# Retry logic to wait for PostgreSQL
def connect_with_retry(max_attempts=5, delay=5):
    attempts = 0
    while attempts < max_attempts:
        try:
            engine = create_engine(DATABASE_URL)
            engine.connect()  # Test the connection
            return engine
        except OperationalError:
            attempts += 1
            print(f"Database connection failed, retrying {attempts}/{max_attempts}...")
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