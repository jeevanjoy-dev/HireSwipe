from fastapi import FastAPI
import app.models
from app.routers import auth
from app.routers import candidate
from app.routers import recruiter
from app.routers import company



app = FastAPI(
    title="HireSwipe API",
    description="Recruitment and career platform API",
    version="1.0.0"
)

app.include_router(auth.router)

app.include_router(candidate.router)

app.include_router(recruiter.router)

app.include_router(company.router)



@app.get("/")
def root():
    """Return a basic response confirming that the API is running.

    Returns:
        dict: API status message.
    """
    return {"message": "HireSwipe API is running"}