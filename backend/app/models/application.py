
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Application(Base):
    """Represent a candidate's application for a job."""

    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )

    candidate_id: Mapped[int] = mapped_column(
        ForeignKey("candidate_profiles.id"),
        nullable=False,
    )

    job_id: Mapped[int] = mapped_column(
        ForeignKey("jobs.id"),
        nullable=False,
    )

    about_yourself: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    # Resume uploaded specifically for this application
    resume: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )

    @property
    def has_resume(self) -> bool:
       return bool(self.resume)

    status: Mapped[str] = mapped_column(
        String(20), default="Applied", nullable=False
    )

    is_archived: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    applied_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    candidate = relationship(
        "CandidateProfile",
        back_populates="applications",
    )

    job = relationship(
        "Job",
        back_populates="applications",
    )
