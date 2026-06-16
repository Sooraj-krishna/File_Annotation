"""
Annotation repository — data access layer for the annotations table.

Provides CRUD operations with a dedicated method for fetching
annotations filtered by document and page. The page filter leverages
the composite index on (document_id, page_number) for fast lookups.
"""

import uuid

from sqlalchemy import select, update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.annotation import Annotation


class AnnotationRepository:
    """Handles database operations for Annotation entities."""

    def __init__(self, db: AsyncSession):
        """
        Initialize with an active database session.

        Args:
            db: SQLAlchemy async session from the get_db dependency.
        """
        self.db = db

    async def create(self, annotation: Annotation) -> Annotation:
        """
        Persist a new annotation record.

        Args:
            annotation: Unsaved Annotation model instance.

        Returns:
            The saved Annotation with generated ID and timestamps.
        """
        self.db.add(annotation)
        await self.db.commit()
        await self.db.refresh(annotation)
        return annotation

    async def get_by_id(self, annotation_id: uuid.UUID) -> Annotation | None:
        """
        Fetch a single annotation by its UUID.

        Args:
            annotation_id: UUID of the annotation to retrieve.

        Returns:
            The Annotation if found, otherwise None.
        """
        result = await self.db.execute(
            select(Annotation).where(Annotation.id == annotation_id)
        )
        return result.scalar_one_or_none()

    async def get_by_document(
        self, document_id: uuid.UUID, page_number: int | None = None
    ) -> list[Annotation]:
        """
        Fetch all annotations for a document, optionally filtered by page.

        Uses the composite index on (document_id, page_number) for fast
        lookups. This is the most common query pattern in the application,
        executed every time a user switches pages or reloads a document.

        Args:
            document_id: UUID of the parent document.
            page_number: Optional page number filter. If omitted, returns
                all annotations for the document.

        Returns:
            List of Annotation instances ordered by creation time.
        """
        query = select(Annotation).where(
            Annotation.document_id == document_id
        )
        if page_number is not None:
            query = query.where(Annotation.page_number == page_number)
        query = query.order_by(Annotation.created_at)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update(
        self, annotation_id: uuid.UUID, data: dict
    ) -> Annotation | None:
        """
        Partially update an annotation's fields.

        Uses RETURNING to fetch the updated row in a single query.

        Args:
            annotation_id: UUID of the annotation to update.
            data: Dictionary of fields to update (label, polygon_json, etc.).

        Returns:
            The updated Annotation if found, otherwise None.
        """
        stmt = (
            sql_update(Annotation)
            .where(Annotation.id == annotation_id)
            .values(**data)
            .returning(Annotation)
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        return result.scalar_one_or_none()

    async def delete(self, annotation_id: uuid.UUID) -> None:
        """
        Delete an annotation by UUID.

        Args:
            annotation_id: UUID of the annotation to delete.
        """
        ann = await self.get_by_id(annotation_id)
        if ann:
            await self.db.delete(ann)
            await self.db.commit()

    async def delete_by_document_page(
        self, document_id: uuid.UUID, page_number: int
    ) -> None:
        """Delete all annotations for a specific document and page."""
        stmt = select(Annotation).where(
            Annotation.document_id == document_id,
            Annotation.page_number == page_number,
        )
        result = await self.db.execute(stmt)
        annotations = list(result.scalars().all())
        for ann in annotations:
            await self.db.delete(ann)
        await self.db.commit()
