from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RecruiterProfile(Base):
    """Represent the recruiter-specific profile of a HireSwipe user.

    Attributes:
        id: Unique identifier for the recruiter profile.
        user_id: ID of the user who owns this recruiter profile.
        company_id: ID of the company associated with the recruiter.
        designation: Recruiter's designation within the company.
    """

    __tablename__ = "recruiter_profiles"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        unique=True,
        nullable=False
    )

    company_id: Mapped[int | None] = mapped_column(
        ForeignKey("companies.id"),
        nullable=True
    )

    designation: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    user = relationship(
        "User",
        back_populates="recruiter_profile"
    )

    company = relationship(
        "Company",
        back_populates="recruiters"
    )

    jobs = relationship(
      "Job",
      back_populates="recruiter"

    )