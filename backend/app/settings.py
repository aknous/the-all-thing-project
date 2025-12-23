from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    databaseUrl: str
    redisUrl: str
    secretKey: str
    adminKey: str

    cookieDomain: str = ".theallthingproject.com"
    cookieSecure: bool = True

    class Config:
        env_file = ".env"

settings = Settings()