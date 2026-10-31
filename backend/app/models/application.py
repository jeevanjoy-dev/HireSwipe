from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Application(Base):
    """Represent a candidate's application for a job.

    Attributes:
        id: Unique identifier of the application.
        candidate_id: ID of the candidate profile submitting the application.
        job_id: ID of the job being applied for.
        status: Current status of the application.
        is_archived: Whether the candidate has manually archived the application.
        applied_at: Date and time when the application was submitted.
    """

    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    candidate_id: Mapped[int] = mapped_column(
        ForeignKey("candidate_profiles.id"),
        nullable=False,
    )

    job_id: Mapped[int] = mapped_column(
        ForeignKey("jobs.id"),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default="Applied",
        nullable=False,
    )

    is_archived: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    applied_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    candidate = relationship(
        "CandidateProfile",
        back_populates="applications",
    )

    job = relationship(
        "Job",
        back_populates="applications",
    )