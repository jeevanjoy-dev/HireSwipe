
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    """Represent a HireSwipe user."""

    __tablename__ = "users"

    candidate_profile = relationship(
        "CandidateProfile",
        back_populates="user",
        uselist=False
    )

    recruiter_profile = relationship(
        "RecruiterProfile",
        back_populates="user",
        uselist=False
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False
    )

    phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True
    )

    email_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )

    phone_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )

    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
