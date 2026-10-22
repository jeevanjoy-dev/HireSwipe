from datetime import datetime

from pydantic import BaseModel, ConfigDict


class JobCreate(BaseModel):
    """Represent data required to create a job.

    Attributes:
        title: Title of the job position.
        description: Detailed description of the job.
        location: Location of the job.
        job_type: Type of employment.
        experience_required: Experience required for the job.
        salary_min: Minimum salary offered.
        salary_max: Maximum salary offered.
        requirements: Skills and qualifications required.
    """

    title: str
    description: str
    location: str | None = None
    job_type: str
    experience_required: str | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    requirements: str | None = None


class JobUpdate(BaseModel):
    """Represent data that can be used to update a job.

    Attributes:
        title: Updated job title.
        description: Updated job description.
        location: Updated job location.
        job_type: Updated employment type.
        experience_required: Updated experience requirement.
        salary_min: Updated minimum salary.
        salary_max: Updated maximum salary.
        requirements: Updated job requirements.
        is_active: Whether the job is currently active.
    """

    title: str | None = None
    description: str | None = None
    location: str | None = None
    job_type: str | None = None
    experience_required: str | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    requirements: str | None = None
    is_active: bool | None = None


class JobResponse(BaseModel):
    """Represent job information returned by the API.

    Attributes:
        id: Unique identifier for the job.
        recruiter_id: ID of the recruiter who posted the job.
        title: Title of the job position.
        description: Detailed description of the job.
        location: Location of the job.
        job_type: Type of employment.
        experience_required: Experience required for the job.
        salary_min: Minimum salary offered.
        salary_max: Maximum salary offered.
        requirements: Skills and qualifications required.
        is_active: Whether the job is currently active.
        created_at: Date and time when the job was created.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    recruiter_id: int
    title: str
    description: str
    location: str | None = None
    job_type: str
    experience_required: str | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    requirements: str | None = None
    is_active: bool
    created_at: datetime