
from app.services.resume_parser import extract_resume_sections

resume_path = r"C:/Users/User/Downloads/Jeevan_Joy_Junior_Software_Developer resume .pdf"

sections = extract_resume_sections(resume_path)

print("\n========== EXTRACTED RESUME SECTIONS ==========")

for section, content in sections.items():

    print(f"\n--- {section.upper()} ---")

    if content:
        print(content)
    else:
        print("Not detected")