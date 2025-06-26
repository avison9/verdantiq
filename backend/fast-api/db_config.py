from configs import Base, engine

Base.metadata.create_all(bind=engine)