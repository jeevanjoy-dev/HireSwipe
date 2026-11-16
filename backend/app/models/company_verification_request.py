
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    Boolean,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CompanyVerificationRequest(Base):
    """Store individual company verification submissions."""

    __tablename__ = "company_verification_requests"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"),
        nullable=False,
        index=True,
    )

    request_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="initial",
    )

    version_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    document_1: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    document_2: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    # Business email verification for this specific request.
    business_email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    business_email_verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    business_email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    business_email_otp_hash: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    business_email_otp_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    business_email_otp_attempts: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    business_email_otp_last_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="draft",
    )

    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    reviewed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    rejection_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    company = relationship(
        "Company",
        back_populates="verification_requests",
    )

    reviewed_by = relationship(
        "User",
        foreign_keys=[reviewed_by_user_id],
    )
