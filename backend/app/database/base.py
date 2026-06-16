"""
SQLAlchemy declarative base for all database models.

Every ORM model in the application inherits from this Base class.
It provides the metadata registry that Alembic uses to detect
and generate database migrations automatically.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """
    Declarative base for all SQLAlchemy ORM models.

    Subclasses automatically register their table definitions
    in Base.metadata, which is consumed by Alembic migrations.
    """

    pass
