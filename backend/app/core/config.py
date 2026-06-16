"""
Application configuration via environment variables.

Uses pydantic-settings to load and validate all configuration
from environment variables and/or a .env file. This is the single
source of truth for all tunable parameters in the application.
"""

from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    All values have sensible defaults for local development.
    Override via environment variables or a .env file in the backend root.

    Attributes:
        database_url: PostgreSQL connection string for asyncpg.
        storage__type: Storage backend type (currently only "local").
        storage__path: Filesystem path for PDF file storage.
        max_upload_size_mb: Maximum allowed PDF upload size in megabytes.
        cors_origins: List of allowed CORS origins for the frontend.
        gcp_project_id: Google Cloud project ID for Vertex AI.
        gcp_location: Google Cloud location for Vertex AI.
        gemini_model: Gemini model to use for extraction.
        app_env: Application environment (development, staging, production).
        log_level: Logging level.
        rate_limit_requests: Max requests per minute per IP.
        rate_limit_window: Rate limit window in seconds.
    """

    database_url: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5433/document_annotation"
    )
    storage__type: Literal["local"] = "local"
    storage__path: str = "./storage/pdfs"
    max_upload_size_mb: int = 100
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:8080"]
    gcp_project_id: str = ""
    gcp_location: str = "us-central1"
    gemini_model: str = "gemini-2.5-flash"
    app_env: Literal["development", "staging", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    rate_limit_requests: int = 60
    rate_limit_window: int = 60

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @field_validator("database_url", mode="before")
    @classmethod
    def ensure_async_driver(cls, v: str) -> str:
        if v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    model_config = {"env_file": ".env", "case_sensitive": False}


settings = Settings()
