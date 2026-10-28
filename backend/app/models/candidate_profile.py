from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CandidateProfile(Base):
    """Represent the candidate-specific profile of a HireSwipe user.

    Attributes:
        id: Unique identifier for the candidate profile.
        user_id: ID of the user who owns this profile.
        phone: Candidate's phone number.
        location: Candidate's current location.
        bio: Short description about the candidate.
        resume: Path or reference to the candidate's resume.
    """

    __tablename__ = "candidate_profiles"

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

    phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True
    )

    location: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True
    )

    bio: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    resume: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    user = relationship(
        "User",
        back_populates="candidate_profile"
    )

    applications = relationship(
        "Application",
        back_populates="candidate"
    )