
from pathlib import Path
import re
from functools import lru_cache

from docx import Document
from pypdf import PdfReader

SUPPORTED_FORMATS = {".pdf", ".docx"}

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

# Minimum semantic similarity required for automatic classification.
SECTION_SIMILARITY_THRESHOLD = 0.38

# ==================================================
# 1. RESUME HEADING DICTIONARY
# ==================================================

SECTION_HEADINGS = {
    "summary": [
        "summary",
        "profile summary",
        "professional summary",
        "career summary",
        "executive summary",
        "about me",
        "profile",
        "professional profile",
        "career objective",
        "objective",
        "personal statement",
    ],

    "skills": [
        "skills",
        "technical skills",
        "core skills",
        "key skills",
        "core competencies",
        "technical expertise",
        "technology stack",
        "tools and technologies",
        "areas of expertise",
        "programming languages",
        "it skills",
        "software skills",
        "computer skills",
        "professional skills",
        "competencies",
    ],

    "experience": [
        "experience",
        "work experience",
        "professional experience",
        "employment history",
        "career history",
        "work history",
        "professional background",
        "industry experience",
        "career experience",
        "professional journey",
        "work profile",
        "internship experience",
        "internships",
        "employment",
    ],

    "projects": [
        "projects",
        "personal projects",
        "academic projects",
        "technical projects",
        "key projects",
        "selected projects",
        "project experience",
        "development projects",
        "project portfolio",
        "portfolio",
        "academic work",
        "software projects",
        "major projects",
        "mini projects",
    ],

    "education": [
        "education",
        "educational background",
        "academic background",
        "academic qualifications",
        "academic history",
        "qualifications",
        "educational qualifications",
        "academic details",
        "academic profile",
    ],

    "certifications": [
        "certifications",
        "certificates",
        "professional certifications",
        "courses",
        "training",
        "licenses",
        "certifications and courses",
        "courses and certifications",
        "professional training",
    ],

    "achievements": [
        "achievements",
        "awards",
        "accomplishments",
        "honors",
        "honours",
        "recognition",
        "awards and achievements",
        "key achievements",
    ],

    "publications": [
        "publications",
        "research",
        "research publications",
        "papers",
        "research papers",
        "published work",
    ],

    "languages": [
        "languages",
        "language skills",
        "language proficiency",
        "known languages",
    ],

    "contact": [
        "contact",
        "contact information",
        "personal information",
        "personal details",
        "contact details",
    ],

    "interests": [
        "interests",
        "hobbies",
        "personal interests",
        "areas of interest",
        "extracurricular activities",
        "extra curricular activities",
        "activities",
        "volunteer experience",
        "volunteering",
    ],

    "references": [
        "references",
        "professional references",
        "referees",
    ],
}

# ==================================================
# 2. SEMANTIC CLASSIFICATION DESCRIPTIONS
# ==================================================

SECTION_DESCRIPTIONS = {
    "summary": (
        "A short professional introduction, career objective, "
        "personal profile, career summary or description of "
        "the candidate's professional background."
    ),

    "skills": (
        "A list of technical skills, programming languages, "
        "frameworks, software tools, technologies, databases "
        "and professional competencies."
    ),

    "experience": (
        "Employment history, professional work experience, "
        "internships, job responsibilities, previous roles, "
        "employers and work achievements."
    ),

    "projects": (
        "Personal, academic or technical projects, software "
        "applications, project descriptions, technologies "
        "used, development work and project contributions."
    ),

    "education": (
        "Educational qualifications, degrees, universities, "
        "colleges, academic records and graduation details."
    ),

    "certifications": (
        "Professional certifications, completed courses, "
        "training programs, licenses and credentials."
    ),

    "achievements": (
        "Awards, honors, accomplishments, competitions, "
        "recognition and professional achievements."
    ),

    "publications": (
        "Research papers, publications, academic papers "
        "and published research work."
    ),

    "languages": (
        "Languages spoken, written languages and language "
        "proficiency levels."
    ),

    "interests": (
        "Personal interests, hobbies, volunteering and "
        "extracurricular activities."
    ),
}

# ==================================================
# 3. TEXT CLEANING
# ==================================================

def clean_text(text: str) -> str:
    """Normalize extracted resume text."""

    text = text.replace("\x00", " ")

    text = re.sub(r"[ \t]+", " ", text)

    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()

# ==================================================
# 4. EXTRACT COMPLETE RESUME TEXT
# ==================================================

def extract_resume_text(file_path: str | Path) -> str:
    """
    Extract text from PDF or DOCX resumes.

    Supports:
        - PDF
        - DOCX
        - DOCX tables
    """

    path = Path(file_path)

    if not path.exists() or not path.is_file():
        raise FileNotFoundError(
            f"Resume file not found: {path}"
        )

    extension = path.suffix.lower()

    if extension not in SUPPORTED_FORMATS:
        raise ValueError(
            "Unsupported resume format. "
            "Only PDF and DOCX are supported."
        )

    if extension == ".pdf":

        reader = PdfReader(str(path))

        extracted_text = "\n".join(
            page.extract_text() or ""
            for page in reader.pages
        )

    else:

        document = Document(str(path))

        extracted_text = "\n".join(
            paragraph.text
            for paragraph in document.paragraphs
        )

        # Extract DOCX table content.
        for table in document.tables:

            for row in table.rows:

                extracted_text += "\n" + " ".join(
                    cell.text for cell in row.cells
                )

    cleaned_text = clean_text(extracted_text)

    if not cleaned_text:
        raise ValueError(
            "No readable text found in the resume. "
            "The PDF may be scanned or image-based."
        )

    return cleaned_text

# ==================================================
# 5. HEADING NORMALIZATION
# ==================================================

def _normalize_heading(line: str) -> str:
    """
    Normalize a possible section heading.

    Examples:
        TECHNICAL SKILLS: -> technical skills
        1. Work Experience -> work experience
        PROJECTS -------- -> projects
    """

    line = line.strip().lower()

    line = re.sub(
        r"^[\s#*\-]*\d*[\s.)\-]*",
        "",
        line,
    )

    line = re.sub(
        r"[:\-–—\s]+$",
        "",
        line,
    )

    line = re.sub(
        r"\s+",
        " ",
        line,
    )

    return line.strip()

# ==================================================
# 6. BUILD HEADING LOOKUP
# ==================================================

def _build_heading_lookup():
    """Create a normalized heading-to-section mapping."""

    lookup = {}

    for section, headings in SECTION_HEADINGS.items():

        for heading in headings:

            normalized = _normalize_heading(heading)

            lookup[normalized] = section

    return lookup

HEADING_LOOKUP = _build_heading_lookup()

# ==================================================
# 7. IDENTIFY SECTION FROM HEADING
# ==================================================

def _identify_section(line: str):
    """
    Identify a known section heading.

    Also supports headings with inline content,
    such as 'Skills: Python, FastAPI, SQL'.
    """

    normalized = _normalize_heading(line)

    if normalized in HEADING_LOOKUP:
        return HEADING_LOOKUP[normalized], ""

    # Handle inline heading content.
    # Example: Skills: Python, FastAPI

    for heading, section in HEADING_LOOKUP.items():

        pattern = (
            r"^\s*"
            + re.escape(heading)
            + r"\s*[:\-–—]\s*(.+)$"
        )

        match = re.match(
            pattern,
            line.strip(),
            re.IGNORECASE,
        )

        if match:
            return section, match.group(1).strip()

    return None, None

# ==================================================
# 8. SENTENCE TRANSFORMER MODEL
# ==================================================

@lru_cache(maxsize=1)
def get_section_model():
    """
    Load the sentence transformer model once.

    Uses the same model as the resume matcher.
    """

    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(MODEL_NAME)

@lru_cache(maxsize=1)
def get_section_embeddings():
    """Generate reference embeddings for section categories."""

    model = get_section_model()

    sections = list(SECTION_DESCRIPTIONS.keys())

    descriptions = [
        SECTION_DESCRIPTIONS[section]
        for section in sections
    ]

    embeddings = model.encode(
        descriptions,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )

    return sections, embeddings

# ==================================================
# 9. SEMANTIC SECTION CLASSIFICATION
# ==================================================

def _classify_content(text: str):
    """
    Classify an unassigned text block using semantic similarity.

    Returns:
        (section, similarity)

    Returns (None, score) when confidence is insufficient.
    """

    if not text or len(text.strip()) < 30:
        return None, 0.0

    model = get_section_model()

    sections, reference_embeddings = get_section_embeddings()

    content_embedding = model.encode(
        [text],
        normalize_embeddings=True,
        convert_to_numpy=True,
    )[0]

    similarities = reference_embeddings @ content_embedding

    best_index = int(similarities.argmax())

    best_score = float(similarities[best_index])

    if best_score < SECTION_SIMILARITY_THRESHOLD:
        return None, best_score

    return sections[best_index], best_score

# ==================================================
# 10. SPLIT RESUME INTO CONTENT BLOCKS
# ==================================================

def _split_into_blocks(text: str):
    """
    Split extracted resume text into paragraphs or blocks.

    Keeps related lines together for semantic classification.
    """

    blocks = re.split(r"\n\s*\n", text)

    return [
        block.strip()
        for block in blocks
        if block.strip()
    ]

# ==================================================
# 11. EXTRACT STRUCTURED RESUME SECTIONS
# ==================================================

def extract_resume_sections(
    file_path: str | Path,
) -> dict:
    """
    Extract and classify resume sections.

    Recognized sections include:
        skills
        experience
        projects
        education
        summary
        certifications
        achievements
        publications
        languages
        interests

    Unknown content is not automatically discarded.
    """

    resume_text = extract_resume_text(file_path)

    sections = {
        section: []
        for section in SECTION_HEADINGS
    }

    current_section = None

    unclassified_blocks = []

    # --------------------------------------------------
    # First pass: heading-based extraction
    # --------------------------------------------------

    for line in resume_text.splitlines():

        line = line.strip()

        if not line:
            continue

        detected_section, inline_content = _identify_section(line)

        if detected_section:

            current_section = detected_section

            if inline_content:
                sections[current_section].append(
                    inline_content
                )

            continue

        if current_section:

            sections[current_section].append(line)

        else:

            unclassified_blocks.append(line)

    # --------------------------------------------------
    # Second pass: contextual classification
    # --------------------------------------------------

    # Combine unclassified lines into blocks.
    # This is useful for resumes without standard headings.

    if unclassified_blocks:

        combined_text = "\n".join(unclassified_blocks)

        blocks = _split_into_blocks(combined_text)

        for block in blocks:

            detected_section, score = _classify_content(block)

            if detected_section:

                sections[detected_section].append(block)

    # --------------------------------------------------
    # Build final structured response
    # --------------------------------------------------

    structured_sections = {}

    for section, content in sections.items():

        structured_sections[section] = "\n".join(
            content
        ).strip()

    return structured_sections   