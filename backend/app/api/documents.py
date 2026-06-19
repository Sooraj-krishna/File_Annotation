"""
Document API routes.

Provides endpoints for uploading, listing, retrieving, and deleting
PDF and image documents. Also serves the file bytes for frontend
rendering and provides annotation queries scoped to a document.
"""

import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException
from app.database.session import get_db
from app.repositories.document import DocumentRepository
from app.schemas.annotation import AnnotationResponse
from app.schemas.document import DocumentList, DocumentResponse
from app.services.annotation import AnnotationService
from app.services.document import DocumentService

router = APIRouter()


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a PDF or image document.

    Accepts multipart/form-data with a single file field. Detects the
    file type from content bytes, extracts metadata via PyMuPDF, saves
    to storage and database. Returns the document metadata on success.

    Args:
        file: The uploaded file.
        db: Database session from dependency injection.

    Returns:
        DocumentResponse with the saved document metadata.

    Raises:
        422: If the file type is not supported or exceeds the size limit.
    """
    content = await file.read()
    service = DocumentService(db)
    return await service.upload(file.filename or "document", content)


@router.get("", response_model=DocumentList)
async def list_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """
    List all uploaded documents with pagination.

    Args:
        skip: Number of records to skip for pagination.
        limit: Maximum records to return (capped at 500).
        db: Database session from dependency injection.

    Returns:
        DocumentList containing the documents array and total count.
    """
    service = DocumentService(db)
    documents = await service.get_all(skip, limit)
    return DocumentList(documents=documents, total=len(documents))


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Get document metadata by UUID.

    Args:
        document_id: UUID of the document.
        db: Database session from dependency injection.

    Returns:
        DocumentResponse with document metadata.

    Raises:
        404: If the document does not exist.
    """
    service = DocumentService(db)
    try:
        return await service.get(document_id)
    except NotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a document and all its annotations.

    Removes the PDF file from storage and the record from the database.
    Annotation cascade delete is handled by the database FK constraint.

    Args:
        document_id: UUID of the document to delete.
        db: Database session from dependency injection.

    Raises:
        404: If the document does not exist.
    """
    service = DocumentService(db)
    try:
        await service.delete(document_id)
    except NotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{document_id}/file")
async def get_document_file(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Stream the raw file for frontend rendering.

    Uses FileResponse for zero-copy sendfile (no RAM buffering) and
    automatic HTTP Range (206 Partial Content) support. PDF.js uses
    Range requests to load pages progressively, which dramatically
    reduces time-to-first-page for large PDFs.

    Args:
        document_id: UUID of the document.
        db: Database session from dependency injection.

    Returns:
        FileResponse with the file bytes and appropriate content headers.

    Raises:
        404: If the document does not exist.
    """
    repo = DocumentRepository(db)
    doc = await repo.get_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return FileResponse(
        path=doc.file_path,
        media_type=doc.mime_type,
        filename=doc.filename,
        content_disposition_type="inline",
        headers={
            "Cache-Control": "public, max-age=3600",
        },
    )


@router.get("/{document_id}/annotations", response_model=list[AnnotationResponse])
async def get_annotations(
    document_id: uuid.UUID,
    page: int | None = Query(None, ge=1),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all annotations for a document, optionally filtered by page.

    This endpoint is called every time the user switches pages in the
    PDF viewer. The page filter uses the composite index for fast lookups.

    Args:
        document_id: UUID of the document.
        page: Optional page number to filter by (1-indexed).
        db: Database session from dependency injection.

    Returns:
        A list of AnnotationResponse objects.
    """
    service = AnnotationService(db)
    return await service.get_by_document(document_id, page)
