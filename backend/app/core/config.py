from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    PROJECT_NAME: str = "Cursor Video Platform"
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "cursor_video"
    OPENAI_API_KEY: str
    STORAGE_DIR: str = "storage"

    class Config:
        env_file = ".env"

@lru_cache
def get_settings():
    return Settings()

