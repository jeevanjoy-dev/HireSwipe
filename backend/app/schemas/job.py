
from datetime import datetime
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    HttpUrl,
    model_validator,
)


ApplicationMethod = Literal["Platform", "Email", "External"]


class JobCreate(BaseModel):
    """Represent data required to create a new job.

    Attributes:
        title: Title of the job.
        description: Detailed description of the job.
        location: Location of the job.
        job_type: Type of employment.
        experience_min: Minimum years of experience required.
        experience_max: Maximum years of experience accepted.
        salary_min: Minimum salary offered.
        salary_max: Maximum salary offered.
        requirements: Skills and qualifications required.
        application_method: Method used to apply for the job.
        application_url: External job application URL.
        application_email: Recruiter's HR application email.
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

    application_method: ApplicationMethod = "Platform"
    application_url: HttpUrl | None = None
    application_email: EmailStr | None = None

    @model_validator(mode="after")
    def validate_experience_range(self):
        """Validate the minimum and maximum experience values.

        Returns:
            JobCreate: The validated job creation data.

        Raises:
            ValueError: If minimum experience exceeds maximum experience.
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
        """Validate the minimum and maximum salary values.

        Returns:
            JobCreate: The validated job creation data.

        Raises:
            ValueError: If minimum salary exceeds maximum salary.
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

    @model_validator(mode="after")
    def validate_application_method(self):
        """Validate application details for the selected method.

        Returns:
            JobCreate: The validated job creation data.

        Raises:
            ValueError: If the required email or URL is missing.
        """
        if self.application_method == "Email" and not self.application_email:
            raise ValueError(
                "Application email is required for Email applications."
            )

        if self.application_method == "External" and not self.application_url:
            raise ValueError(
                "Application URL is required for External applications."
            )

        return self


class JobUpdate(BaseModel):
    """Represent optional data for updating an existing job.

    Attributes:
        title: Updated job title.
        description: Updated job description.
        location: Updated job location.
        job_type: Updated employment type.
        experience_min: Updated minimum experience.
        experience_max: Updated maximum experience.
        salary_min: Updated minimum salary.
        salary_max: Updated maximum salary.
        requirements: Updated job requirements.
        application_method: Updated application method.
        application_url: Updated external application URL.
        application_email: Updated HR application email.
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

    application_method: ApplicationMethod | None = None
    application_url: HttpUrl | None = None
    application_email: EmailStr | None = None

    is_active: bool | None = None

    @model_validator(mode="after")
    def validate_experience_range(self):
        """Validate the experience range when both values are provided.

        Returns:
            JobUpdate: The validated job update data.

        Raises:
            ValueError: If minimum experience exceeds maximum experience.
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
        """Validate the salary range when both values are provided.

        Returns:
            JobUpdate: The validated job update data.

        Raises:
            ValueError: If minimum salary exceeds maximum salary.
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

    @model_validator(mode="after")
    def validate_application_method(self):
        """Validate provided application details during a partial update.

        Returns:
            JobUpdate: The validated job update data.

        Raises:
            ValueError: If a newly selected method lacks required details.

        Notes:
            The router must also validate the merged existing and
            updated job values before saving to the database.
        """
        if self.application_method == "Email" and not self.application_email:
            raise ValueError(
                "Application email is required when switching to Email."
            )

        if self.application_method == "External" and not self.application_url:
            raise ValueError(
                "Application URL is required when switching to External."
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
        experience_min: Minimum years of experience.
        experience_max: Maximum years of experience.
        salary_min: Minimum salary.
        salary_max: Maximum salary.
        requirements: Job requirements.
        application_method: How candidates apply for the job.
        application_url: External application URL, if applicable.
        application_email: HR email address, if applicable.
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

    application_method: ApplicationMethod
    application_url: str | None = None
    application_email: str | None = None

    is_active: bool
    created_at: datetime


class JobListResponse(BaseModel):
    """Represent a paginated list of jobs returned by the API.

    Attributes:
        total: Total number of jobs matching the search filters.
        skip: Number of jobs skipped for pagination.
        limit: Maximum number of jobs requested.
        jobs: Jobs returned for the current page.
    """

    total: int
    skip: int
    limit: int
    jobs: list[JobResponse]
