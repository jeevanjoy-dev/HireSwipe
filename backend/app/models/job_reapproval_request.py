
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class JobReapprovalRequest(Base):
    __tablename__ = "job_reapproval_requests"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    job_id: Mapped[int] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
    )

    recruiter_id: Mapped[int] = mapped_column(
        ForeignKey("recruiter_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default="pending",
        nullable=False,
    )

    recruiter_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    admin_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    reviewed_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    job = relationship(
        "Job",
        back_populates="reapproval_requests",
    )

    recruiter = relationship(
        "RecruiterProfile",
        back_populates="reapproval_requests",
    )

    reviewer = relationship(
        "User",
        foreign_keys=[reviewed_by],
    )


Index(
    "ix_job_reapproval_requests_job_status",
    JobReapprovalRequest.job_id,
    JobReapprovalRequest.status,
)
