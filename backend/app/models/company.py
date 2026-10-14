from typing import Optional

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Company(Base):
    """Represent a company registered on HireSwipe.

    Attributes:
        id: Unique identifier for the company.
        name: Name of the company.
        description: Description of the company.
        location: Company's location.
        website: Company's website URL.
    """

    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )

    location: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True
    )

    website: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )

    recruiters = relationship(
    "RecruiterProfile",
    back_populates="company"
    )