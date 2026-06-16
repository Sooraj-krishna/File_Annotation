"""
Document repository — data access layer for the documents table.

Provides CRUD operations abstracted behind a class, making it
easy to swap implementations or add caching later without
affecting service-layer code.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document


class DocumentRepository:
    """Handles database operations for Document entities."""

    def __init__(self, db: AsyncSession):
        """
        Initialize with an active database session.

        Args:
            db: SQLAlchemy async session from the get_db dependency.
        """
        self.db = db

    async def create(self, document: Document) -> Document:
        """
        Persist a new document record.

        Args:
            document: Unsaved Document model instance.

        Returns:
            The saved Document with a generated ID and timestamps.
        """
        self.db.add(document)
        await self.db.commit()
        await self.db.refresh(document)
        return document

    async def get_by_id(self, document_id: uuid.UUID) -> Document | None:
        """
        Fetch a document by its UUID.

        Args:
            document_id: UUID of the document to retrieve.

        Returns:
            The Document if found, otherwise None.
        """
        result = await self.db.execute(
            select(Document).where(Document.id == document_id)
        )
        return result.scalar_one_or_none()

    async def get_all(self, skip: int = 0, limit: int = 100) -> list[Document]:
        """
        List documents with pagination.

        Args:
            skip: Number of records to skip (offset).
            limit: Maximum number of records to return.

        Returns:
            A list of Document instances.
        """
        result = await self.db.execute(
            select(Document).offset(skip).limit(limit)
        )
        return list(result.scalars().all())

    async def delete(self, document_id: uuid.UUID) -> None:
        """
        Delete a document by UUID. Cascades to annotations.

        Args:
            document_id: UUID of the document to delete.
        """
        doc = await self.get_by_id(document_id)
        if doc:
            await self.db.delete(doc)
            await self.db.commit()
