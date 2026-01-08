import os
from typing import Optional, Union
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Required fields
    databaseUrl: str
    redisUrl: str
    secretKey: str
    adminKey: str
    
    # Cloudflare Turnstile (optional, for bot protection)
    turnstileSecretKey: Optional[str] = None
    
    # OpenAI API (optional, for AI-generated poll context)
    openaiApiKey: Optional[str] = None

    # Optional override for the OpenAI model used by AI context generation
    # (e.g. "gpt-4o", "gpt-5-mini")
    openaiModel: Optional[str] = None
    
    @property
    def openai_api_key(self) -> Optional[str]:
        """Allow both OPENAI_API_KEY and openaiApiKey env vars"""
        return os.getenv("OPENAI_API_KEY") or self.openaiApiKey

    @property
    def openai_model(self) -> str:
        """Allow OPENAI_MODEL env var; default to gpt-5-mini."""
        return os.getenv("OPENAI_MODEL") or (self.openaiModel or "gpt-5-mini")

    # Optional cookie settings
    cookieDomain: Optional[str] = None
    cookieSecure: bool = True

    # CORS settings (comma-separated list of allowed origins)
    # Default includes localhost for development
    corsOrigins: Union[str, list[str]] = "http://localhost:3000,http://localhost:5173,https://localhost:3000,https://localhost:5173"

    @field_validator('corsOrigins', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',')]
        return v

    @property
    def async_database_url(self) -> str:
        """
        Prefer Fly-provided DATABASE_URL (passworded) and convert it for async SQLAlchemy.
        Fallback to configured databaseUrl.
        """
        url = os.getenv("DATABASE_URL") or self.databaseUrl
        url = url.replace("postgres://", "postgresql://")
        url = url.replace("postgresql://", "postgresql+asyncpg://")
        return url

settings = Settings()
