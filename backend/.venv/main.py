from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Verified Course Material Studio API",
    version="0.1.0",
    description="API for generating and verifying course materials.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/")
def root():
    return {
        "name": "Verified Course Material Studio",
        "status": "running",
    }


@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "backend",
        "phase": 1,
    }
