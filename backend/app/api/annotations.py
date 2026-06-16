"""
Annotation API routes.

Provides CRUD endpoints for rectangle annotations. All create and update
operations go through the AnnotationService which validates coordinates
before persisting. Coordinates must be in normalized [0,1] space.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException, ValidationException
from app.database.session import get_db
from app.schemas.annotation import (
    AnnotationCreate,
    AnnotationResponse,
    AnnotationUpdate,
    SyncRequest,
)
from app.services.annotation import AnnotationService

router = APIRouter()


@router.post("", response_model=AnnotationResponse, status_code=201)
async def create_annotation(
    data: AnnotationCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new rectangle annotation.

    The rectangle points must be in normalized space (0.0 to 1.0)
    and contain exactly 2 points (top-left, bottom-right).

    Args:
        data: AnnotationCreate schema with document_id, page_number,
            label (optional), and points array.
        db: Database session from dependency injection.

    Returns:
        AnnotationResponse with the saved annotation data.

    Raises:
        422: If the rectangle fails validation.
    """
    service = AnnotationService(db)
    try:
        return await service.create(data)
    except ValidationException as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.put("/{annotation_id}", response_model=AnnotationResponse)
async def update_annotation(
    annotation_id: uuid.UUID,
    data: AnnotationUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Update an existing annotation's label and/or rectangle points.

    Only validates points if they are provided in the update payload.
    This allows label-only updates without re-validating the geometry.

    Args:
        annotation_id: UUID of the annotation to update.
        data: AnnotationUpdate schema with optional label and points.
        db: Database session from dependency injection.

    Returns:
        AnnotationResponse with the updated annotation data.

    Raises:
        404: If the annotation does not exist.
        422: If the updated points fail validation.
    """
    service = AnnotationService(db)
    try:
        return await service.update(annotation_id, data)
    except NotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationException as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.delete("/{annotation_id}", status_code=204)
async def delete_annotation(
    annotation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete an annotation by UUID.

    Args:
        annotation_id: UUID of the annotation to delete.
        db: Database session from dependency injection.

    Raises:
        404: If the annotation does not exist.
    """
    service = AnnotationService(db)
    try:
        await service.delete(annotation_id)
    except NotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/sync", response_model=list[AnnotationResponse])
async def sync_annotations(
    document_id: uuid.UUID,
    data: SyncRequest,
    db: AsyncSession = Depends(get_db),
):
    """Replace all annotations for a page with the provided list."""
    service = AnnotationService(db)
    return await service.sync(
        document_id, data.page_number,
        [a.model_dump() for a in data.annotations]
    )
