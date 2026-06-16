"""
Document service — business logic for document file operations.

Handles the upload workflow: validates the file, detects mime type,
extracts metadata via PyMuPDF, persists to storage and database.
Also provides retrieval and deletion operations that coordinate between
the storage backend and the database repository.
"""

import uuid

import fitz

from app.core.config import settings
from app.core.exceptions import NotFoundException, ValidationException
from app.core.file_utils import detect_mime_type, mime_to_fitz_filetype
from app.models.document import Document
from app.repositories.document import DocumentRepository
from app.schemas.document import DocumentResponse
from app.storage.local import LocalStorage


class DocumentService:
    """Coordinates document operations between storage, file parsing, and the database."""

    def __init__(self, db):
        """
        Initialize the service with a database session.

        Args:
            db: SQLAlchemy async session from the get_db dependency.
        """
        self.repo = DocumentRepository(db)
        self.storage = LocalStorage()

    async def upload(self, filename: str, content: bytes) -> DocumentResponse:
        """
        Upload a document (PDF or image): validate, save to storage, extract metadata, persist to DB.

        The upload pipeline:
            1. Detect mime type from content bytes.
            2. Validate file size.
            3. Save raw bytes to local storage.
            4. Open with PyMuPDF to count pages.
            5. Create a Document record in the database.
            6. Return the serialized document metadata.

        Args:
            filename: Original filename from the upload.
            content: Raw file bytes.

        Returns:
            DocumentResponse with the saved document metadata.

        Raises:
            ValidationException: If the file type is not supported, exceeds size limit,
                or cannot be opened as a valid document.
        """
        mime_type = detect_mime_type(content)
        fitz_type = mime_to_fitz_filetype(mime_type)

        if len(content) > settings.max_upload_size_mb * 1024 * 1024:
            raise ValidationException(
                f"File exceeds {settings.max_upload_size_mb}MB limit"
            )

        doc_id = str(uuid.uuid4())
        file_path = await self.storage.save(content, doc_id, filename)

        try:
            doc = fitz.open(stream=content, filetype=fitz_type)
            page_count = doc.page_count
            doc.close()
        except Exception as e:
            await self.storage.delete(file_path)
            raise ValidationException(f"Invalid file: {e}")

        document = Document(
            id=uuid.UUID(doc_id),
            filename=filename,
            file_path=file_path,
            mime_type=mime_type,
            page_count=page_count,
        )
        created = await self.repo.create(document)
        return DocumentResponse.model_validate(created)

    async def get(self, document_id: uuid.UUID) -> DocumentResponse:
        """
        Retrieve document metadata by ID.

        Args:
            document_id: UUID of the document.

        Returns:
            DocumentResponse with document metadata.

        Raises:
            NotFoundException: If no document exists with the given ID.
        """
        doc = await self.repo.get_by_id(document_id)
        if not doc:
            raise NotFoundException("Document", str(document_id))
        return DocumentResponse.model_validate(doc)

    async def delete(self, document_id: uuid.UUID) -> None:
        """
        Delete a document and its associated files and annotations.

        Removes the file from storage first, then deletes the database
        record (which cascades to annotations via FK constraint).

        Args:
            document_id: UUID of the document to delete.

        Raises:
            NotFoundException: If no document exists with the given ID.
        """
        doc = await self.repo.get_by_id(document_id)
        if not doc:
            raise NotFoundException("Document", str(document_id))
        await self.storage.delete(doc.file_path)
        await self.repo.delete(document_id)

    async def get_all(
        self, skip: int = 0, limit: int = 100
    ) -> list[DocumentResponse]:
        """
        List all documents with pagination.

        Args:
            skip: Number of records to skip.
            limit: Maximum number of records to return.

        Returns:
            A list of DocumentResponse objects.
        """
        docs = await self.repo.get_all(skip, limit)
        return [DocumentResponse.model_validate(d) for d in docs]
