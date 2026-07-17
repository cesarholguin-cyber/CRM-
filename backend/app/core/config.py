from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    APP_NAME: str = "R&F CRM"
    VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database — Render provides DATABASE_URL in sync format; we auto-convert
    DATABASE_URL: str = ""
    DATABASE_URL_SYNC: str = ""

    # Security - JWT
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Security - Encryption (for sensitive field-level data)
    ENCRYPTION_KEY: str = ""

    # Redis (optional — app works without it)
    REDIS_URL: Optional[str] = None

    # Sentry
    SENTRY_DSN: Optional[str] = None

    # SMTP
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: str = "noreply@rfdesarrolloscampestres.com"

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,https://dashing-marshmallow-9ef64c.netlify.app,https://rfdesarrolloscampestres.com"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 60

    # File upload
    MAX_UPLOAD_SIZE_MB: int = 10

    class Config:
        env_file = ".env"
        case_sensitive = True

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # If only DATABASE_URL is provided (sync format), derive async version
        if self.DATABASE_URL and not self.DATABASE_URL_SYNC:
            self.DATABASE_URL_SYNC = self.DATABASE_URL
            if "+asyncpg" not in self.DATABASE_URL:
                self.DATABASE_URL = self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
        elif self.DATABASE_URL_SYNC and not self.DATABASE_URL:
            self.DATABASE_URL = self.DATABASE_URL_SYNC.replace("postgresql://", "postgresql+asyncpg://")


settings = Settings()
