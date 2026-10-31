from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SavedJob(Base):
    """Represent a job saved by a candidate.

    Attributes:
        id: Unique identifier of the saved job record.
        candidate_id: ID of the candidate who saved the job.
        job_id: ID of the saved job.
        saved_at: Date and time when the job was saved.
    """

    __tablename__ = "saved_jobs"

    __table_args__ = (
        UniqueConstraint(
            "candidate_id",
            "job_id",
            name="uq_candidate_saved_job",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    candidate_id: Mapped[int] = mapped_column(
        ForeignKey("candidate_profiles.id"),
        nullable=False,
    )

    job_id: Mapped[int] = mapped_column(
        ForeignKey("jobs.id"),
        nullable=False,
    )

    saved_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    candidate = relationship(
        "CandidateProfile",
        back_populates="saved_jobs",
    )

    job = relationship(
        "Job",
        back_populates="saved_jobs",
    )