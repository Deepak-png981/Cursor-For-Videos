from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .core.config import get_settings
from .db.database import db
from .api import routes
import os

settings = get_settings()

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for now, customize for prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create storage dir if not exists
if not os.path.exists(settings.STORAGE_DIR):
    os.makedirs(settings.STORAGE_DIR)

# Mount storage for serving videos
app.mount("/media", StaticFiles(directory=settings.STORAGE_DIR), name="media")

app.include_router(routes.router, prefix="/api")

@app.on_event("startup")
async def startup_db_client():
    db.connect()

@app.on_event("shutdown")
async def shutdown_db_client():
    db.close()

@app.get("/")
async def root():
    return {"message": "Cursor Video Platform API"}

