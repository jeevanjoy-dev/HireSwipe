
import re
from functools import lru_cache
from typing import Dict, List

import numpy as np

from app.services.embedding_service import get_sentence_model


# =========================================
# MULTI-INDUSTRY SKILL TAXONOMY
# =========================================

SKILL_TAXONOMY: Dict[str, Dict[str, List[str]]] = {
    "it_software": {
        "Python": ["python", "python3"],
        "Java": ["java"],
        "JavaScript": ["javascript"],
        "TypeScript": ["typescript"],
        "C++": ["c++", "cpp"],
        "C#": ["c#", "c sharp"],
        "Django": ["django"],
        "FastAPI": ["fastapi", "fast api"],
        "Flask": ["flask"],
        "React": ["react.js", "reactjs", "react"],
        "Next.js": ["next.js", "nextjs"],
        "Node.js": ["node.js", "nodejs"],
        "HTML": ["html", "html5"],
        "CSS": ["css", "css3"],
        "Tailwind CSS": ["tailwind css", "tailwind"],
        "SQL": ["sql"],
        "PostgreSQL": ["postgresql", "postgres"],
        "MySQL": ["mysql"],
        "MongoDB": ["mongodb", "mongo db"],
        "SQLAlchemy": ["sqlalchemy"],
        "REST API": [
            "rest api",
            "rest apis",
            "restful api",
            "restful apis",
        ],
        "GraphQL": ["graphql"],
        "Git": ["git"],
        "GitHub": ["github"],
        "Docker": ["docker"],
        "Kubernetes": ["kubernetes"],
        "AWS": ["aws", "amazon web services"],
        "Azure": ["microsoft azure", "azure"],
        "Linux": ["linux"],
        "Machine Learning": ["machine learning"],
        "Deep Learning": ["deep learning"],
        "Natural Language Processing": [
            "natural language processing",
            "nlp",
        ],
        "TensorFlow": ["tensorflow"],
        "PyTorch": ["pytorch"],
        "Scikit-learn": ["scikit-learn", "sklearn"],
        "Pandas": ["pandas"],
        "NumPy": ["numpy"],
        "Data Analysis": ["data analysis", "data analytics"],
        "Data Science": ["data science"],
    },

    "sales_marketing": {
        "Sales": ["sales", "selling"],
        "Lead Generation": ["lead generation", "lead gen"],
        "Negotiation": ["negotiation", "negotiating"],
        "Customer Acquisition": ["customer acquisition"],
        "Digital Marketing": ["digital marketing"],
        "Social Media Marketing": ["social media marketing"],
        "SEO": ["search engine optimization", "seo"],
        "Content Marketing": ["content marketing"],
        "Email Marketing": ["email marketing"],
        "Market Research": ["market research"],
        "CRM": ["customer relationship management", "crm"],
        "Salesforce": ["salesforce"],
        "Account Management": ["account management"],
        "Business Development": ["business development"],
    },

    "hr_recruitment": {
        "Talent Acquisition": ["talent acquisition"],
        "Recruitment": ["recruitment", "recruiting"],
        "Interviewing": ["interviewing", "candidate interviews"],
        "Onboarding": ["employee onboarding", "onboarding"],
        "HR Operations": [
            "hr operations",
            "human resources operations",
        ],
        "Payroll": ["payroll processing", "payroll"],
        "Employee Engagement": ["employee engagement"],
        "Performance Management": ["performance management"],
        "HR Management": [
            "human resource management",
            "hr management",
        ],
    },

    "finance_accounting": {
        "Accounting": ["accounting"],
        "Bookkeeping": ["bookkeeping"],
        "Financial Analysis": ["financial analysis"],
        "Financial Reporting": ["financial reporting"],
        "Taxation": ["taxation", "tax accounting"],
        "GST": ["gst", "goods and services tax"],
        "Tally": ["tally", "tally erp"],
        "Microsoft Excel": [
            "microsoft excel",
            "ms excel",
            "excel",
        ],
        "Auditing": ["auditing", "audit"],
        "Budgeting": ["budgeting", "budget preparation"],
        "Accounts Payable": ["accounts payable"],
        "Accounts Receivable": ["accounts receivable"],
    },

    "hospitality_customer_service": {
        "Customer Service": [
            "customer service",
            "customer support",
        ],
        "Customer Relationship Management": [
            "customer relationship management",
            "customer relations",
        ],
        "Guest Relations": ["guest relations"],
        "Front Office Operations": ["front office operations"],
        "Hotel Management": ["hotel management"],
        "Reservation Management": ["reservation management"],
        "Food and Beverage Service": [
            "food and beverage service",
            "f&b service",
        ],
        "Complaint Resolution": [
            "complaint resolution",
            "handling customer complaints",
        ],
    },

    "design_creative": {
        "UI/UX Design": [
            "ui/ux design",
            "ui design",
            "ux design",
        ],
        "Figma": ["figma"],
        "Adobe Photoshop": [
            "adobe photoshop",
            "photoshop",
        ],
        "Adobe Illustrator": [
            "adobe illustrator",
            "illustrator",
        ],
        "Graphic Design": ["graphic design"],
        "Video Editing": ["video editing"],
        "Adobe Premiere Pro": [
            "adobe premiere pro",
            "premiere pro",
        ],
        "Branding": ["branding"],
        "Wireframing": ["wireframing", "wireframes"],
        "Prototyping": ["prototyping", "prototypes"],
    },

    "general_workplace": {
        "Communication": [
            "communication skills",
            "communication",
        ],
        "Teamwork": ["teamwork", "team collaboration"],
        "Leadership": ["leadership", "team leadership"],
        "Problem Solving": [
            "problem solving",
            "problem-solving",
        ],
        "Time Management": ["time management"],
        "Critical Thinking": ["critical thinking"],
        "Adaptability": ["adaptability", "adaptable"],
        "Presentation Skills": ["presentation skills"],
        "Attention to Detail": ["attention to detail"],
        "Project Management": ["project management"],
    },
}


# =========================================
# SEMANTIC MATCHING CONFIGURATION
# =========================================

SEMANTIC_THRESHOLD = 0.62
SEMANTIC_MIN_MARGIN = 0.04


SEMANTIC_SKILL_PROFILES = {
    "REST API": [
        "Developing RESTful web services using HTTP methods.",
        "Building API endpoints for communication between applications.",
        "Creating web APIs that use GET POST PUT PATCH and DELETE.",
        "Developing backend services that expose resources through HTTP.",
    ],

    "FastAPI": [
        "Building Python backend APIs using the FastAPI framework.",
        "Creating asynchronous web APIs with Python and FastAPI.",
    ],

    "Django": [
        "Developing Python web applications using the Django framework.",
        "Building backend websites using Django models views and templates.",
    ],

    "Flask": [
        "Developing lightweight Python web applications using Flask.",
        "Building web endpoints with the Flask Python framework.",
    ],

    "SQLAlchemy": [
        "Using Python object relational mapping to interact with databases.",
        "Managing database tables and queries through Python ORM models.",
    ],

    "PostgreSQL": [
        "Working with relational databases using PostgreSQL.",
        "Managing structured data in a PostgreSQL database system.",
    ],

    "Docker": [
        "Packaging applications into containers using Docker.",
        "Building and running containerized applications.",
    ],

    "GraphQL": [
        "Building APIs that allow clients to request specific data using GraphQL.",
        "Developing data query interfaces using the GraphQL API technology.",
    ],
}


# =========================================
# NEGATION DETECTION
# =========================================

NEGATION_PATTERN = re.compile(
    r"\b(?:"
    r"no|not|never|without|"
    r"lack|lacks|lacking|"
    r"haven't|hasn't|hadn't|"
    r"don't|doesn't|didn't|"
    r"cannot|can't|"
    r"unable to|"
    r"unfamiliar with"
    r")\b",
    re.IGNORECASE,
)


def is_negated(text: str, start: int) -> bool:
    """
    Detect negation shortly before a skill mention.

    Checks the five preceding words.
    """

    preceding_text = text[:start]

    words = preceding_text.split()
    context = " ".join(words[-5:])

    return bool(NEGATION_PATTERN.search(context))


def is_negative_statement(sentence: str) -> bool:
    """
    Conservative sentence-level negation check.

    Negated sentences are excluded from semantic matching
    to reduce false-positive skill assignments.
    """

    return bool(
        NEGATION_PATTERN.search(sentence)
    )


# =========================================
# EXACT KEYWORD MATCHING
# =========================================

def contains_keyword(text: str, keyword: str) -> bool:
    """
    Match a skill keyword while checking for nearby negation.
    """

    pattern = rf"(?<!\w){re.escape(keyword)}(?!\w)"

    for match in re.finditer(
        pattern,
        text,
        flags=re.IGNORECASE,
    ):

        if not is_negated(text, match.start()):
            return True

    return False


# =========================================
# CACHED SEMANTIC EMBEDDINGS
# =========================================

@lru_cache(maxsize=1)
def _get_semantic_skill_embeddings():
    """
    Generate and cache embeddings for curated skill descriptions.
    """

    model = get_sentence_model()

    skills = []
    descriptions = []

    for skill, profile_descriptions in SEMANTIC_SKILL_PROFILES.items():

        for description in profile_descriptions:
            skills.append(skill)
            descriptions.append(description)

    embeddings = model.encode(
        descriptions,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )

    return tuple(skills), embeddings


# =========================================
# CONTROLLED SEMANTIC SKILL MATCHING
# =========================================

def _extract_semantic_skills(text: str) -> set:
    """
    Identify additional skills through semantic similarity.

    Negated sentences are excluded.
    """

    if not text or not text.strip():
        return set()

    model = get_sentence_model()

    known_skills, profile_embeddings = (
        _get_semantic_skill_embeddings()
    )

    # Split text into sentences.
    sentences = re.split(
        r"(?<=[.!?])\s+|\n+",
        text,
    )

    # Exclude short and negated sentences.
    sentences = [
        sentence.strip()
        for sentence in sentences
        if (
            len(sentence.strip().split()) >= 3
            and not is_negative_statement(sentence)
        )
    ]

    if not sentences:
        return set()

    sentence_embeddings = model.encode(
        sentences,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )

    similarities = np.matmul(
        sentence_embeddings,
        profile_embeddings.T,
    )

    matched_skills = set()

    for sentence_scores in similarities:

        skill_scores = {}

        # Keep the highest description score per skill.
        for index, score in enumerate(sentence_scores):

            skill = known_skills[index]

            skill_scores[skill] = max(
                skill_scores.get(skill, 0.0),
                float(score),
            )

        ranked_skills = sorted(
            skill_scores.items(),
            key=lambda item: item[1],
            reverse=True,
        )

        if not ranked_skills:
            continue

        best_skill, best_score = ranked_skills[0]

        second_score = (
            ranked_skills[1][1]
            if len(ranked_skills) > 1
            else 0.0
        )

        # Accept only sufficiently strong and unambiguous matches.
        if (
            best_score >= SEMANTIC_THRESHOLD
            and best_score - second_score >= SEMANTIC_MIN_MARGIN
        ):
            matched_skills.add(best_skill)

    return matched_skills


# =========================================
# SKILL EXTRACTION BY CATEGORY
# =========================================

def extract_skills_by_category(text: str) -> Dict[str, List[str]]:
    """
    Extract skills using:
    1. Exact keyword matching.
    2. Controlled semantic matching.
    """

    if not text or not text.strip():
        return {}

    extracted = {}

    # Stage 1: Exact keyword matching.
    for category, skills in SKILL_TAXONOMY.items():

        category_skills = []

        for canonical_name, variations in skills.items():

            if any(
                contains_keyword(text, alias)
                for alias in variations
            ):
                category_skills.append(canonical_name)

        if category_skills:
            extracted[category] = set(category_skills)

    # Stage 2: Semantic fallback.
    semantic_skills = _extract_semantic_skills(text)

    for skill in semantic_skills:

        already_matched = any(
            skill in category_skills
            for category_skills in extracted.values()
        )

        if not already_matched:
            extracted.setdefault(
                "it_software",
                set(),
            ).add(skill)

    return {
        category: sorted(skills)
        for category, skills in extracted.items()
    }


# =========================================
# FLAT SKILL EXTRACTION
# =========================================

def extract_skills(text: str) -> List[str]:
    """
    Extract all recognized skills as a flat list.

    Maintains compatibility with resume_matcher.py.
    """

    grouped_skills = extract_skills_by_category(text)

    return sorted({
        skill
        for skills in grouped_skills.values()
        for skill in skills
    })


# =========================================
# TEXT PREPROCESSING
# =========================================

def preprocess_text(text: str) -> str:
    """Basic text normalization for NLP matching."""

    if not text:
        return ""

    text = text.lower()

    text = re.sub(
        r"[^a-z0-9+#./\s-]",
        " ",
        text,
    )

    text = re.sub(
        r"\s+",
        " ",
        text,
    )

    return text.strip()
