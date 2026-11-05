
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CompanyJoinRequest(Base):
    """Represent a recruiter's request to join a company.

    Attributes:
        id: Unique identifier for the join request.
        recruiter_id: ID of the recruiter requesting access.
        company_id: ID of the company they want to join.
        status: Current request status.
        created_at: Date and time the request was created.
        reviewed_at: Date and time the request was reviewed.
        reviewed_by_user_id: ID of the company admin who reviewed it.
    """

    __tablename__ = "company_join_requests"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )

    recruiter_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"),
        nullable=False,
        index=True
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default="pending",
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    reviewed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True
    )
