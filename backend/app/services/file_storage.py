
from pathlib import Path
from uuid import uuid4
from io import BytesIO
from zipfile import ZipFile, BadZipFile

from fastapi import HTTPException, UploadFile, status


# --------------------------------------------------
# STORAGE CONFIGURATION
# --------------------------------------------------

# Private storage directory: backend/uploads/
STORAGE_ROOT = Path(__file__).resolve().parents[2] / "uploads"

ALLOWED_RESUME_EXTENSIONS = {".pdf", ".docx"}

ALLOWED_PHOTO_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}

MAX_RESUME_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_PHOTO_SIZE = 2 * 1024 * 1024  # 2 MB


ALLOWED_CATEGORIES = {
    "candidate_resumes",
    "application_resumes",
    "candidate_profile_photos",
    "recruiter_profile_photos",
    "company_admin_profile_photos",
    "company_verification_documents",
}


# --------------------------------------------------
# FILE CONTENT VALIDATION
# --------------------------------------------------

def validate_file_content(content: bytes, extension: str) -> bool:
    """Validate uploaded files using their actual file signatures."""

    if extension == ".pdf":
        return content.startswith(b"%PDF-")

    if extension == ".docx":
        try:
            with ZipFile(BytesIO(content)) as archive:
                return (
                    "word/document.xml" in archive.namelist()
                    and "[Content_Types].xml" in archive.namelist()
                )
        except (BadZipFile, OSError):
            return False

    if extension in {".jpg", ".jpeg"}:
        return content.startswith(b"\xff\xd8\xff")

    if extension == ".png":
        return content.startswith(
            b"\x89PNG\r\n\x1a\n"
        )

    if extension == ".webp":
        return (
            len(content) >= 12
            and content.startswith(b"RIFF")
            and content[8:12] == b"WEBP"
        )

    return False


# --------------------------------------------------
# SAVE UPLOADED FILE
# --------------------------------------------------

async def save_upload(
    upload: UploadFile,
    category: str,
    allowed_extensions: set[str],
    max_size: int,
) -> str:
    """Validate and save an uploaded file securely."""

    if category not in ALLOWED_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid storage category.",
        )

    extension = Path(upload.filename or "").suffix.lower()

    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file extension.",
        )

    content = await upload.read(max_size + 1)

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds the maximum allowed size.",
        )

    if not validate_file_content(content, extension):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file content.",
        )

    # Create category folder
    category_path = STORAGE_ROOT / category
    category_path.mkdir(parents=True, exist_ok=True)

    # Generate a unique filename
    filename = f"{uuid4().hex}{extension}"

    file_path = category_path / filename

    try:
        file_path.write_bytes(content)
    except OSError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save uploaded file.",
        )

    # Store only the relative storage key in PostgreSQL
    return f"{category}/{filename}"


# --------------------------------------------------
# GET STORED FILE
# --------------------------------------------------

def get_stored_file(storage_key: str) -> Path:
    """Resolve a stored file without allowing path traversal."""

    if not storage_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found.",
        )

    root = STORAGE_ROOT.resolve()

    file_path = (root / storage_key).resolve()

    if not file_path.is_relative_to(root):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file reference.",
        )

    if not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found.",
        )

    return file_path


# --------------------------------------------------
# DELETE STORED FILE
# --------------------------------------------------

def delete_stored_file(storage_key: str | None) -> None:
    """Delete a stored file safely if it exists."""

    if not storage_key:
        return

    root = STORAGE_ROOT.resolve()

    file_path = (root / storage_key).resolve()

    if not file_path.is_relative_to(root):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file reference.",
        )

    if file_path.is_file():
        file_path.unlink()
