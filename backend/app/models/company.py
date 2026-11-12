
from typing import Optional

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

class Company(Base):
    """Represent a company registered on HireSwipe."""

    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )

    admin_user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
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

    # Company admin profile picture
    admin_profile_photo: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    admin = relationship(
        "User",
        foreign_keys=[admin_user_id]
    )

    recruiters = relationship(
        "RecruiterProfile",
        back_populates="company"
    )