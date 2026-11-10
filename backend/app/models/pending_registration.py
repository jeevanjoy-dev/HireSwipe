
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Integer,
    String,
    Boolean,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PendingRegistration(Base):
    """Temporarily store an account awaiting email verification."""

    __tablename__ = "pending_registrations"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    registration_token_hash: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    email_otp_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )

    email_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    email_otp_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    email_otp_attempts: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    email_last_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
