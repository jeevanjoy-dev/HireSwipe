from fastapi import FastAPI
from app.routers import auth



app = FastAPI(
    title="HireSwipe API",
    description="Recruitment and career platform API",
    version="1.0.0"
)

app.include_router(auth.router)



@app.get("/")
def root():
    """Return a basic response confirming that the API is running.

    Returns:
        dict: API status message.
    """
    return {"message": "HireSwipe API is running"}