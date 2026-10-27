from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class JobCreate(BaseModel):
    """Represent data required to create a new job.

    Attributes:
        title: Title of the job.
        description: Detailed description of the job.
        location: Location of the job.
        job_type: Type of employment.
        experience_min: Minimum years of experience required for the job.
        experience_max: Maximum years of experience accepted for the job.
        salary_min: Minimum salary offered.
        salary_max: Maximum salary offered.
        requirements: Skills and qualifications required.
    """

    title: str
    description: str
    location: str | None = None

    job_type: Literal[
        "Full-time",
        "Part-time",
        "Internship",
    ]

    experience_min: int | None = Field(default=None, ge=0)
    experience_max: int | None = Field(default=None, ge=0)
    salary_min: int | None = Field(default=None, ge=0)
    salary_max: int | None = Field(default=None, ge=0)

    requirements: str | None = None

    @model_validator(mode="after")
    def validate_experience_range(self):
        """Validate that the minimum experience is not greater than the maximum experience.

        Returns:
            JobCreate: The validated job creation data.

        Raises:
            ValueError: If the minimum experience is greater than the maximum experience.
        """
        if (
            self.experience_min is not None
            and self.experience_max is not None
            and self.experience_min > self.experience_max
        ):
            raise ValueError(
                "Minimum experience cannot be greater than maximum experience."
            )

        return self

    @model_validator(mode="after")
    def validate_salary_range(self):
        """Validate that the minimum salary is not greater than the maximum salary.

        Returns:
            JobCreate: The validated job creation data.

        Raises:
            ValueError: If the minimum salary is greater than the maximum salary.
        """
        if (
            self.salary_min is not None
            and self.salary_max is not None
            and self.salary_min > self.salary_max
        ):
            raise ValueError(
                "Minimum salary cannot be greater than maximum salary."
            )

        return self


class JobUpdate(BaseModel):
    """Represent optional data for updating an existing job.

    Attributes:
        title: Updated job title.
        description: Updated job description.
        location: Updated job location.
        job_type: Updated employment type.
        experience_min: Updated minimum years of experience required for the job.
        experience_max: Updated maximum years of experience accepted for the job.
        salary_min: Updated minimum salary.
        salary_max: Updated maximum salary.
        requirements: Updated job requirements.
        is_active: Whether the job is accepting applications.
    """

    title: str | None = None
    description: str | None = None
    location: str | None = None

    job_type: Literal[
        "Full-time",
        "Part-time",
        "Internship",
    ] | None = None

    experience_min: int | None = Field(default=None, ge=0)
    experience_max: int | None = Field(default=None, ge=0)

    salary_min: int | None = Field(default=None, ge=0)
    salary_max: int | None = Field(default=None, ge=0)

    requirements: str | None = None
    is_active: bool | None = None


    @model_validator(mode="after")
    def validate_experience_range(self):
        """Validate that the minimum experience is not greater than the maximum experience.

        Returns:
            JobUpdate: The validated job update data.

        Raises:
            ValueError: If the minimum experience is greater than the maximum experience.
        """
        if (
            self.experience_min is not None
            and self.experience_max is not None
            and self.experience_min > self.experience_max
        ):
            raise ValueError(
                "Minimum experience cannot be greater than maximum experience."
            )

        return self

    @model_validator(mode="after")
    def validate_salary_range(self):
        """Validate the salary range when both salary values are provided.

        Returns:
            JobUpdate: The validated job update data.

        Raises:
            ValueError: If the minimum salary is greater than the maximum salary.
        """
        if (
            self.salary_min is not None
            and self.salary_max is not None
            and self.salary_min > self.salary_max
        ):
            raise ValueError(
                "Minimum salary cannot be greater than maximum salary."
            )

        return self


class JobResponse(BaseModel):
    """Represent job information returned by the API.

    Attributes:
        id: Unique identifier of the job.
        recruiter_id: ID of the recruiter who posted the job.
        title: Job title.
        description: Job description.
        location: Job location.
        job_type: Employment type.
        experience_min: Minimum years of experience required for the job.
        experience_max: Maximum years of experience accepted for the job.
        salary_min: Minimum salary.
        salary_max: Maximum salary.
        requirements: Job requirements.
        is_active: Whether the job is active.
        created_at: Date and time when the job was created.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    recruiter_id: int
    title: str
    description: str
    location: str | None = None
    job_type: str
    experience_min: int | None = None
    experience_max: int | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    requirements: str | None = None
    is_active: bool
    created_at: datetime