
import time
from pathlib import Path
from types import SimpleNamespace

from app.services.resume_parser import extract_resume_sections
from app.services.resume_matcher import calculate_job_match


# =====================================
# 1. RESUME FILE PATH
# =====================================

resume_path = Path(
    r"C:\Users\User\Downloads\Jeevan_Joy_Junior_Software_Developer resume .pdf"
)

if not resume_path.exists():
    raise FileNotFoundError(f"Resume not found: {resume_path}")


# =====================================
# 2. EXTRACT RESUME SECTIONS
# =====================================

print("\n========== RESUME EXTRACTION ==========")

start = time.perf_counter()

resume_sections = extract_resume_sections(resume_path)

parsing_time = time.perf_counter() - start

print("Resume parsing completed:", round(parsing_time, 2), "seconds")


# =====================================
# 3. DISPLAY EXTRACTED SECTIONS
# =====================================

print("\n========== EXTRACTED SECTIONS ==========")

for section in ["skills", "experience", "projects"]:
    print(f"\n{section.upper()}:")
    print(resume_sections.get(section) or "Not detected")


# =====================================
# 4. SAMPLE JOB FOR TESTING
# =====================================

job = SimpleNamespace(
    id=101,

    title="Python Backend Developer",

    description="""
        Develop backend applications using Python and FastAPI.
        Build REST APIs and manage PostgreSQL databases using SQLAlchemy.
        Implement authentication and scalable backend services.
        Collaborate with frontend developers.

        I have no professional experience with Docker, Kubernetes, or GraphQL,
        and I have never developed applications using these technologies.
        """,

    requirements="""
    Python, FastAPI, PostgreSQL, SQLAlchemy,
    REST APIs, Docker, JWT Authentication
    """,

    experience_min=1,
    experience_max=3,
)


# =====================================
# 5. CALCULATE JOB MATCH
# =====================================

print("\n========== MATCHING PROCESS ==========")

start = time.perf_counter()

result = calculate_job_match(resume_sections, job)

matching_time = time.perf_counter() - start

print("Matching completed:", round(matching_time, 2), "seconds")


# =====================================
# 6. DISPLAY MATCHING RESULTS
# =====================================

print("\n========== HIRE SWIPE MATCH RESULTS ==========")

print(f"Job: {job.title}")

print(f"\nOverall Match: {result['match_percentage']}%")

print(f"Skills Score: {result['skill_score']}%")

print(f"Experience Score: {result['experience_score']}%")

print(f"Project Score: {result['project_score']}%")


print("\nMatched Skills:")
print(result["matched_skills"])


print("\nMissing Skills:")
print(result["missing_skills"])


print("\nSuggestions:")

for suggestion in result["suggestions"]:
    print("-", suggestion)


# =====================================
# 7. EXECUTION SUMMARY
# =====================================

print("\n========== EXECUTION SUMMARY ==========")

print("Resume parsing:", round(parsing_time, 2), "seconds")

print("Job matching:", round(matching_time, 2), "seconds")

print(
    "Total execution:",
    round(parsing_time + matching_time, 2),
    "seconds"
)

print("\nRESUME MATCHING INTEGRATION TEST COMPLETED!")
