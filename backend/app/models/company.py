
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    ForeignKey,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
)
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

    # ------------------------------------------
    # COMPANY BUSINESS CONTACT INFORMATION
    # ------------------------------------------

    business_email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        unique=True
    )

    business_phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True
    )

    business_address: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    # ------------------------------------------
    # COMPANY EMAIL OTP VERIFICATION
    # ------------------------------------------

    business_email_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )

    business_email_otp_hash: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    business_email_otp_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    business_email_otp_attempts: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )

    business_email_otp_last_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    business_email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    # ------------------------------------------
    # COMPANY DOCUMENT VERIFICATION
    # ------------------------------------------

    document_1: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    document_2: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    documents_status: Mapped[str] = mapped_column(
        String(30),
        default="not_submitted",
        nullable=False
    )

    # ------------------------------------------
    # OVERALL COMPANY VERIFICATION
    # ------------------------------------------

    verification_status: Mapped[str] = mapped_column(
        String(30),
        default="unverified",
        nullable=False
    )

    admin = relationship(
        "User",
        foreign_keys=[admin_user_id]
    )

    recruiters = relationship(
        "RecruiterProfile",
        back_populates="company"
    )
