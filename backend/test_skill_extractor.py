
from app.services.skill_extractor import extract_skills


def test_skill_extractor():
    sample_resume = """
    Python developer with experience in Python, Django, FastAPI,
    React, JavaScript, PostgreSQL, MySQL and REST APIs.

    Developed a recruitment platform using FastAPI and React.
    Worked with SQLAlchemy, Git, Docker and machine learning.
    """

    skills = extract_skills(sample_resume)

    print("\n========== SKILL EXTRACTION TEST ==========")
    print("Extracted skills:")

    for skill in skills:
        print(f"- {skill}")

    print("\nTotal skills found:", len(skills))

    expected_skills = [
        "Python",
        "Django",
        "FastAPI",
        "React",
        "PostgreSQL",
    ]

    print("\n========== VALIDATION ==========")

    for skill in expected_skills:
        found = any(
            skill.lower() == str(item).lower()
            for item in skills
        )
        print(f"{skill}: {'FOUND' if found else 'NOT FOUND'}")


if __name__ == "__main__":
    test_skill_extractor()
