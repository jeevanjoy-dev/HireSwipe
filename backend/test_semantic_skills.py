from app.services.skill_extractor import extract_skills
mixed_test = (
    "I have no experience with REST APIs, "
    "but I have developed applications using FastAPI."
)

print("\nMixed positive and negative:")
print(extract_skills(mixed_test))