# app/db.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from .settings import settings
import os
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

def fly_database_url_to_asyncpg() -> str:
    raw = os.getenv("DATABASE_URL")
    if not raw:
        return settings.databaseUrl  # your local/dev async URL

    # Normalize scheme
    raw = raw.replace("postgres://", "postgresql://")

    parsed = urlparse(raw)
    qs = dict(parse_qsl(parsed.query, keep_blank_values=True))

    # asyncpg does NOT support sslmode
    qs.pop("sslmode", None)

    cleaned = parsed._replace(query=urlencode(qs))
    url = urlunparse(cleaned)

    # Convert to asyncpg
    url = url.replace("postgresql://", "postgresql+asyncpg://")
    return url


engine = create_async_engine(
    fly_database_url_to_asyncpg(),
    echo=False,
    pool_size=20,  # Increased from 5 to handle more concurrent requests
    max_overflow=10,  # Increased from 5
    pool_timeout=30,
    pool_recycle=1800,  # Recycle connections after 30 min
    pool_pre_ping=True,  # Verify connections before using
    connect_args={
        "ssl": False,
        "server_settings": {"application_name": "allthing-api"},
        "command_timeout": 60,  # 60 second query timeout
    },
)

sessionFactory = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)

class Base(DeclarativeBase):
    pass

async def getDb():
    """Get database session with automatic cleanup"""
    async with sessionFactory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
