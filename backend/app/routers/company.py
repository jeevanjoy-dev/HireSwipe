from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.company import Company
from app.schemas.company import CompanyCreate, CompanyResponse


router = APIRouter(
    prefix="/companies",
    tags=["Company"]
)


@router.post(
    "/",
    response_model=CompanyResponse,
    status_code=status.HTTP_201_CREATED
)
def create_company(
    company_data: CompanyCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Create a company for an authenticated recruiter.

    Args:
        company_data: Company information provided by the client.
        db: Database session used to access PostgreSQL.
        current_user: Authenticated user making the request.

    Returns:
        The newly created company.

    Raises:
        HTTPException: If the authenticated user is not a recruiter.
    """

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can create a company."
        )

    company = Company(
        name=company_data.name,
        description=company_data.description,
        location=company_data.location,
        website=company_data.website
    )

    db.add(company)
    db.commit()
    db.refresh(company)

    return company