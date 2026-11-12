
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        unique=True,
        nullable=False,
    )

    phone: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )

    location: Mapped[str | None] = mapped_column(
        String(150), nullable=True
    )

    bio: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    # Main candidate profile resume storage path
    resume: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )

    # Original uploaded resume filename
    resume_filename: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )

    # Candidate profile picture
    profile_photo: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )

    user = relationship(
        "User",
        back_populates="candidate_profile"
    )

    applications = relationship(
        "Application",
        back_populates="candidate"
    )

    saved_jobs = relationship(
        "SavedJob",
        back_populates="candidate"
    )
