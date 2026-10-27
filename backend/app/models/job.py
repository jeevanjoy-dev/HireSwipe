from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Job(Base):
    """Represent a job posted by a recruiter on HireSwipe.

    Attributes:
        id: Unique identifier for the job.
        recruiter_id: ID of the recruiter profile that posted the job.
        title: Title of the job position.
        description: Detailed description of the job.
        location: Location where the job is based.
        job_type: Type of employment such as full-time or internship.
        experience_min: Minimum years of experience required for the position.
        experience_max: Maximum years of experience accepted for the position.
        salary_min: Minimum salary offered for the position.
        salary_max: Maximum salary offered for the position.
        requirements: Skills and qualifications required for the position.
        is_active: Whether the job is currently accepting applications.
        created_at: Date and time when the job was created.
    """

    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )

    recruiter_id: Mapped[int] = mapped_column(
        ForeignKey("recruiter_profiles.id"),
        nullable=False
    )

    title: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )

    location: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True
    )

    job_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )

    experience_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    experience_max: Mapped[int | None] = mapped_column(Integer, nullable=True)

    salary_min: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True
    )

    salary_max: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True
    )

    requirements: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    recruiter = relationship(
        "RecruiterProfile",
        back_populates="jobs"
    )