import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Required fields
    databaseUrl: str
    redisUrl: str
    secretKey: str
    adminKey: str

    # Optional cookie settings
    cookieDomain: str | None = None
    cookieSecure: bool = True

    # CORS settings (comma-separated list of allowed origins)
    # Default includes localhost for development
    corsOrigins: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://localhost:3000",
        "https://localhost:5173",
    ]

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
