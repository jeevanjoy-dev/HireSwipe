
from types import SimpleNamespace

from app.services.resume_matcher import calculate_job_match


# =========================================
# CANDIDATE RESUME
# =========================================

resume_sections = {

    "skills": """
    Python, FastAPI, Django, PostgreSQL,
    SQLAlchemy, REST APIs, React, Git,
    Docker, JWT Authentication.
    """,

    "experience": """
    Python Backend Developer with 2 years
    of professional experience.

    Developed backend applications using Python
    and FastAPI.

    Designed REST APIs and integrated PostgreSQL
    databases using SQLAlchemy.

    Implemented authentication systems using JWT.
    Worked with frontend developers to integrate
    backend services.
    """,

    "projects": """
    HireSwipe - Recruitment Platform

    Developed a full-stack recruitment platform
    using Python, FastAPI, React and PostgreSQL.

    Implemented candidate and recruiter authentication,
    job posting, job applications and admin moderation.

    Designed REST APIs and managed database relationships
    using SQLAlchemy.

    Implemented JWT authentication and Docker-based
    development environments.
    """
}


# =========================================
# JOB DESCRIPTION
# =========================================

job = SimpleNamespace(

    id=101,

    title="Python Backend Developer",

    description="""
    We are looking for a Python Backend Developer
    to develop and maintain scalable backend applications.

    Responsibilities:

    Develop backend applications using Python and FastAPI.

    Design, implement and maintain REST APIs.

    Manage PostgreSQL databases and use SQLAlchemy
    for database operations.

    Implement secure authentication and authorization.

    Collaborate with frontend developers to integrate
    backend services.

    Work with Docker for application development
    and deployment.

    Develop reliable and maintainable software systems.
    """,

    requirements="""
    Python, FastAPI, PostgreSQL, SQLAlchemy,
    REST APIs, Docker, JWT Authentication.
    """,

    experience_min=2,
    experience_max=4,
)


# =========================================
# RUN MATCHING TEST
# =========================================

def test_resume_matching():

    result = calculate_job_match(resume_sections, job)

    print("\n========================================")
    print("       HIRESWIPE RESUME MATCHING")
    print("========================================")

    print("\nJob:", job.title)

    print("\nCANDIDATE EXPERIENCE:")
    print(result["candidate_experience_years"], "years")

    print("\nEXPERIENCE REQUIRED:")
    print(job.experience_min, "-", job.experience_max, "years")

    print("\n----------------------------------------")
    print("SCORE BREAKDOWN")
    print("----------------------------------------")

    print("Technical Skills:",
          result["skill_score"], "%")

    print("Experience Semantic:",
          result["experience_semantic_score"], "%")

    print("Numerical Experience:",
          result["numerical_experience_score"], "%")

    print("Combined Experience:",
          result["experience_score"], "%")

    print("Project Similarity:",
          result["project_score"], "%")

    print("\n========================================")
    print("FINAL MATCH:",
          result["match_percentage"], "%")
    print("========================================")

    print("\nMATCHED SKILLS:")

    for skill in result["matched_skills"]:
        print("-", skill)

    print("\nMISSING SKILLS:")

    for skill in result["missing_skills"]:
        print("-", skill)

    print("\nSUGGESTIONS:")

    for suggestion in result["suggestions"]:
        print("-", suggestion)

    # =====================================
    # VALIDATION
    # =====================================

    assert 0 <= result["match_percentage"] <= 100

    assert result["candidate_experience_years"] == 2.0

    assert result["numerical_experience_score"] == 100.0

    assert result["experience_semantic_score"] is not None

    assert result["project_score"] is not None

    assert "Python" in result["matched_skills"]

    assert not result["missing_skills"]

    print("\nALL MATCHING TESTS PASSED!")


if __name__ == "__main__":
    test_resume_matching()
