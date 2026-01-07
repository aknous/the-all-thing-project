import os
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
    turnstileSecretKey: str | None = None
    
    # OpenAI API (optional, for AI-generated poll context)
    openaiApiKey: str | None = None
    
    @property
    def openai_api_key(self) -> str | None:
        """Allow both OPENAI_API_KEY and openaiApiKey env vars"""
        return os.getenv("OPENAI_API_KEY") or self.openaiApiKey

    # Optional cookie settings
    cookieDomain: str | None = None
    cookieSecure: bool = True

    # CORS settings (comma-separated list of allowed origins)
    # Default includes localhost for development
    corsOrigins: str | list[str] = "http://localhost:3000,http://localhost:5173,https://localhost:3000,https://localhost:5173"

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
