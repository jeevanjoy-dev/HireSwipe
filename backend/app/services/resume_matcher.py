
import re

import numpy as np

from app.services.embedding_service import get_sentence_model
from app.services.skill_extractor import extract_skills

# =========================================
# MATCHING WEIGHTS
# =========================================

SKILL_WEIGHT = 0.40
EXPERIENCE_WEIGHT = 0.30
PROJECT_WEIGHT = 0.30

# Internal experience scoring weights.
SEMANTIC_EXPERIENCE_WEIGHT = 0.60
NUMERICAL_EXPERIENCE_WEIGHT = 0.40

# =========================================
# TEXT UTILITIES
# =========================================

def _get_text(value):
    """Convert supported values into clean text."""

    if value is None:
        return ""

    if isinstance(value, (list, tuple, set)):
        return " ".join(str(item) for item in value)

    return str(value).strip()

def _normalize_skills(skills):
    """Normalize skill names while preserving display names."""

    if not skills:
        return {}

    if isinstance(skills, str):
        skills = [skills]

    normalized = {}

    for skill in skills:
        display_name = str(skill).strip()

        if display_name:
            normalized[display_name.casefold()] = display_name

    return normalized

# =========================================
# JOB SECTION EXTRACTION
# =========================================

def _get_job_sections(job):
    """
    Extract comparable sections from the existing Job model.

    Uses existing database fields.
    No database changes are required.
    """

    title = _get_text(getattr(job, "title", ""))
    description = _get_text(getattr(job, "description", ""))
    requirements = _get_text(getattr(job, "requirements", ""))

    experience_min = getattr(job, "experience_min", None)
    experience_max = getattr(job, "experience_max", None)

    # Projects are compared against the role title
    # and technical requirements, not the entire description.
    project_target = " ".join(
        part for part in [title, requirements] if part
    )

    return {
        "title": title,
        "skills": requirements,
        "experience": description,
        "projects": project_target,
        "experience_min": experience_min,
        "experience_max": experience_max,
    }

# =========================================
# RESUME SECTION EXTRACTION
# =========================================

def _extract_resume_sections(resume_sections):
    """
    Expected resume section keys:
    skills, experience, projects
    """

    if not isinstance(resume_sections, dict):
        raise ValueError(
            "Resume sections must be provided as a dictionary."
        )

    return {
        "skills": _get_text(resume_sections.get("skills")),
        "experience": _get_text(resume_sections.get("experience")),
        "projects": _get_text(resume_sections.get("projects")),
    }

# =========================================
# SEMANTIC SIMILARITY
# =========================================

def _semantic_similarity(resume_section, job_section):
    """
    Calculate semantic similarity using Sentence Transformers
    and cosine similarity.

    No TF-IDF is used.
    """

    if not resume_section.strip() or not job_section.strip():
        return None

    model = get_sentence_model()

    embeddings = model.encode(
        [resume_section, job_section],
        normalize_embeddings=True,
        convert_to_numpy=True,
    )

    similarity = float(
        np.dot(embeddings[0], embeddings[1])
    )

    return float(np.clip(similarity, 0.0, 1.0))

# =========================================
# NUMERICAL EXPERIENCE EXTRACTION
# =========================================

def _extract_years_of_experience(text):
    """
    Extract explicitly stated years or months of experience.

    Examples:
    '2 years of experience' -> 2.0
    '3+ years experience' -> 3.0
    '18 months of experience' -> 1.5

    Returns None when no clear duration is found.
    """

    if not text:
        return None

    patterns = [
        (
            r"(\d+(?:\.\d+)?)\s*\+?\s*"
            r"(?:years?|yrs?)\s*(?:of\s+)?"
            r"(?:professional\s+)?experience",
            1.0,
        ),
        (
            r"experience\s*(?:of\s+)?"
            r"(\d+(?:\.\d+)?)\s*\+?\s*"
            r"(?:years?|yrs?)",
            1.0,
        ),
        (
            r"(\d+(?:\.\d+)?)\s*\+?\s*"
            r"months?\s*(?:of\s+)?experience",
            1 / 12,
        ),
        (
            r"experience\s*(?:of\s+)?"
            r"(\d+(?:\.\d+)?)\s*\+?\s*months?",
            1 / 12,
        ),
    ]

    matches = []

    for pattern, multiplier in patterns:

        for match in re.finditer(
            pattern,
            text,
            re.IGNORECASE,
        ):
            matches.append(
                float(match.group(1)) * multiplier
            )

    return max(matches) if matches else None

# =========================================
# NUMERICAL EXPERIENCE SCORING
# =========================================

def _numerical_experience_score(
    candidate_years,
    minimum_years,
    maximum_years,
):
    """
    Compare candidate experience against job experience requirements.

    Returns None if candidate experience or job requirements
    cannot be determined.
    """

    if candidate_years is None:
        return None

    if minimum_years is None and maximum_years is None:
        return None

    minimum = (
        float(minimum_years)
        if minimum_years is not None else 0.0
    )

    maximum = (
        float(maximum_years)
        if maximum_years is not None else None
    )

    if minimum < 0 or (
        maximum is not None and maximum < minimum
    ):
        raise ValueError("Invalid job experience range.")

    if candidate_years < minimum:

        if minimum == 0:
            return 1.0

        return float(
            np.clip(candidate_years / minimum, 0.0, 1.0)
        )

    # Meeting the minimum requirement earns full numerical credit.
    # Experience above the maximum is not automatically penalized.
    return 1.0

# =========================================
# MAIN JOB MATCHING FUNCTION
# =========================================

def calculate_job_match(resume_sections, job):
    """
    Calculate compatibility between structured resume sections
    and an existing HireSwipe Job object.

    Overall scoring:
    Skills: 40%
    Experience: 30%
    Projects: 30%
    """

    sections = _extract_resume_sections(resume_sections)
    job_sections = _get_job_sections(job)

    if not any(sections.values()):
        raise ValueError("Resume sections cannot all be empty.")

    if not any([
        job_sections["skills"],
        job_sections["experience"],
        job_sections["projects"],
    ]):
        raise ValueError("Job information cannot be empty.")

    # -------------------------------------
    # 1. TECHNICAL SKILL MATCHING
    # -------------------------------------

    resume_skills = _normalize_skills(
        extract_skills(sections["skills"])
    )

    job_skills = _normalize_skills(
        extract_skills(job_sections["skills"])
    )

    matched_keys = resume_skills.keys() & job_skills.keys()
    missing_keys = job_skills.keys() - resume_skills.keys()

    matched_skills = sorted(
        resume_skills[key] for key in matched_keys
    )

    missing_skills = sorted(
        job_skills[key] for key in missing_keys
    )

    skill_score = (
        len(matched_keys) / len(job_skills)
        if job_skills else None
    )

    # -------------------------------------
    # 2. EXPERIENCE MATCHING
    # -------------------------------------

    # Semantic comparison:
    # Candidate experience vs job description.

    experience_semantic_score = _semantic_similarity(
        sections["experience"],
        job_sections["experience"],
    )

    # Numerical comparison:
    # Candidate's stated years vs job experience range.

    candidate_years = _extract_years_of_experience(
        sections["experience"]
    )

    minimum_years = job_sections["experience_min"]
    maximum_years = job_sections["experience_max"]

    # If structured experience fields are unavailable,
    # attempt to extract a minimum from the description.

    if minimum_years is None and maximum_years is None:

        description_years = _extract_years_of_experience(
            job_sections["experience"]
        )

        if description_years is not None:
            minimum_years = description_years

    numerical_score = _numerical_experience_score(
        candidate_years,
        minimum_years,
        maximum_years,
    )

    # Combine available experience components.

    experience_components = []

    if experience_semantic_score is not None:
        experience_components.append(
            (
                experience_semantic_score,
                SEMANTIC_EXPERIENCE_WEIGHT,
            )
        )

    if numerical_score is not None:
        experience_components.append(
            (
                numerical_score,
                NUMERICAL_EXPERIENCE_WEIGHT,
            )
        )

    experience_total_weight = sum(
        weight for _, weight in experience_components
    )

    experience_score = (
        sum(
            score * weight
            for score, weight in experience_components
        ) / experience_total_weight
        if experience_total_weight else None
    )

    # -------------------------------------
    # 3. PROJECT SEMANTIC MATCHING
    # -------------------------------------

    project_score = _semantic_similarity(
        sections["projects"],
        job_sections["projects"],
    )

    # -------------------------------------
    # 4. FINAL WEIGHTED MATCH SCORE
    # -------------------------------------

    components = [
        (skill_score, SKILL_WEIGHT),
        (experience_score, EXPERIENCE_WEIGHT),
        (project_score, PROJECT_WEIGHT),
    ]

    available_components = [
        (score, weight)
        for score, weight in components
        if score is not None
    ]

    total_weight = sum(
        weight for _, weight in available_components
    )

    final_score = (
        sum(
            score * weight
            for score, weight in available_components
        ) / total_weight
        if total_weight else 0.0
    )

    # -------------------------------------
    # 5. IMPROVEMENT SUGGESTIONS
    # -------------------------------------

    suggestions = []

    if missing_skills:
        suggestions.append(
            "Consider highlighting relevant experience or "
            "projects related to these skills if you genuinely "
            "have them: " + ", ".join(missing_skills)
        )

    if experience_score is not None and experience_score < 0.50:
        suggestions.append(
            "Consider describing your experience using examples "
            "that demonstrate the responsibilities of this role."
        )

    if project_score is not None and project_score < 0.50:
        suggestions.append(
            "Consider adding more details about your projects, "
            "your contributions, and the technologies you used."
        )

    if not suggestions:
        suggestions.append(
            "Your resume shows alignment with the job requirements."
        )

    # -------------------------------------
    # 6. RETURN MATCHING RESULTS
    # -------------------------------------

    return {
        "match_percentage": round(final_score * 100, 2),

        "matched_skills": matched_skills,
        "missing_skills": missing_skills,

        "skill_score": (
            round(skill_score * 100, 2)
            if skill_score is not None else None
        ),

        # Combined experience score for frontend display.
        "experience_score": (
            round(experience_score * 100, 2)
            if experience_score is not None else None
        ),

        # Internal diagnostic scores.
        # The frontend does not need to display these.
        "experience_semantic_score": (
            round(experience_semantic_score * 100, 2)
            if experience_semantic_score is not None else None
        ),

        "numerical_experience_score": (
            round(numerical_score * 100, 2)
            if numerical_score is not None else None
        ),

        "candidate_experience_years": candidate_years,

        "project_score": (
            round(project_score * 100, 2)
            if project_score is not None else None
        ),

        "suggestions": suggestions,
    }

# =========================================
# JOB RANKING
# =========================================

def rank_jobs(resume_sections, jobs):
    """Rank jobs from highest to lowest compatibility."""

    results = []

    for job in jobs:

        result = calculate_job_match(resume_sections, job)

        results.append({
            "job_id": getattr(job, "id", None),
            "job_title": getattr(job, "title", ""),
            **result,
        })

    return sorted(
        results,
        key=lambda item: item["match_percentage"],
        reverse=True,
    )