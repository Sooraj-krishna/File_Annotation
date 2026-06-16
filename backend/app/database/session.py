"""
Async database session management for SQLAlchemy + asyncpg.

Creates the async engine and session factory. The get_db()
dependency generator is used by FastAPI route handlers to
inject a database session with proper cleanup on completion.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

# Async engine connected to PostgreSQL via asyncpg driver
engine = create_async_engine(settings.database_url, echo=False)

# Session factory — each call creates an independent AsyncSession
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    """
    FastAPI dependency that yields an async database session.

    The session is automatically closed when the request completes,
    ensuring no connection leaks occur.
    """
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
