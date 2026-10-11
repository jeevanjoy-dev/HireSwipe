import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def get_db():
    """Provide a database session for API requests.

    Yields:
        Session: An SQLAlchemy database session.

    Side Effects:
        Opens and closes a database session.
    """
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()