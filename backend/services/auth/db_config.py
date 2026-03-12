import models  # noqa: F401 — registers all ORM classes with Base.metadata
from configs import Base, engine

Base.metadata.create_all(bind=engine)
