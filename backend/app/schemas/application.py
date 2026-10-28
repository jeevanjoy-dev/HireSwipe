from datetime import datetime

from pydantic import BaseModel, ConfigDict
from typing import Literal


class ApplicationCreate(BaseModel):
    """Represent data required to submit a job application.

    Attributes:
        job_id: ID of the job the candidate wants to apply for.
    """

    job_id: int


class ApplicationResponse(BaseModel):
    """Represent application information returned by the API.

    Attributes:
        id: Unique identifier of the application.
        candidate_id: ID of the candidate who submitted the application.
        job_id: ID of the applied job.
        status: Current status of the application.
        applied_at: Date and time when the application was submitted.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    candidate_id: int
    job_id: int
    status: str
    applied_at: datetime

class ApplicationDetailResponse(BaseModel):
    """Represent detailed application information returned by the API.

    Attributes:
        id: Unique identifier of the application.
        candidate_id: ID of the candidate who submitted the application.
        job_id: ID of the applied job.
        job_title: Title of the applied job.
        job_location: Location of the applied job.
        job_type: Employment type of the applied job.
        status: Current status of the application.
        applied_at: Date and time when the application was submitted.
    """

    id: int
    candidate_id: int
    job_id: int
    job_title: str
    job_location: str | None = None
    job_type: str
    status: str
    applied_at: datetime

class ApplicationStatusUpdate(BaseModel):
    """Represent a recruiter's request to update an application status.

    Attributes:
        status: New status assigned to the application.
    """

    status: Literal[
        "Applied",
        "Shortlisted",
        "Rejected",
        "Selected",
    ]