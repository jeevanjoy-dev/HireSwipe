
from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LoginChallenge(Base):
    """Temporarily store an email OTP login challenge."""

    __tablename__ = "login_challenges"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    email: Mapped[str] = mapped_column(
        String(255),
        index=True,
        nullable=False,
    )

    challenge_token_hash: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
    )

    otp_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )

    otp_expires_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
    )

    otp_attempts: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    last_sent_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
