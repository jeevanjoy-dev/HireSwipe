import os
from datetime import datetime, timedelta, timezone

from jose import jwt
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
)



from passlib.context import CryptContext


pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


def hash_password(password: str) -> str:
    """Hash a plain-text password securely.

    Args:
        password: Plain-text password provided by the user.

    Returns:
        str: Securely hashed password.
    """
    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:
    """Verify a plain-text password against a stored hash.

    Args:
        plain_password: Password provided during login.
        hashed_password: Password hash stored in the database.

    Returns:
        bool: True when the password matches, otherwise False.
    """
    return pwd_context.verify(
        plain_password,
        hashed_password
    )

def create_access_token(data: dict) -> str:
    """Create a signed JWT access token.

    Args:
        data: Data to store inside the JWT payload.

    Returns:
        str: Encoded JWT access token.
    """
    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    to_encode.update({"exp": expire})

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )
