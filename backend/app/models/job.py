
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    recruiter_id: Mapped[int] = mapped_column(
        ForeignKey("recruiter_profiles.id"),
        nullable=False,
    )

    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str | None] = mapped_column(String(150), nullable=True)

    job_type: Mapped[str] = mapped_column(String(50), nullable=False)

    experience_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    experience_max: Mapped[int | None] = mapped_column(Integer, nullable=True)

    salary_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    salary_max: Mapped[int | None] = mapped_column(Integer, nullable=True)

    requirements: Mapped[str | None] = mapped_column(Text, nullable=True)

    application_method: Mapped[str] = mapped_column(
        String(20),
        default="Platform",
        nullable=False,
    )

    application_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    application_email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    # Existing job activation field
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    # Admin moderation fields
    moderation_status: Mapped[str] = mapped_column(
        String(30),
        default="normal",
        nullable=False,
    )

    moderation_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    moderated_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    moderated_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    # Relationships
    recruiter = relationship("RecruiterProfile", back_populates="jobs")

    applications = relationship(
        "Application",
        back_populates="job",
        cascade="all, delete-orphan",
    )

    saved_jobs = relationship(
        "SavedJob",
        back_populates="job",
        cascade="all, delete-orphan",
    )

    reports = relationship(
        "JobReport",
        back_populates="job",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    moderator = relationship(
        "User",
        foreign_keys=[moderated_by],
    )

    reapproval_requests = relationship(
        "JobReapprovalRequest",
        back_populates="job",
        cascade="all, delete-orphan",
    )   