"""
Annotation service — business logic for rectangle annotation operations.

Provides CRUD operations that validate coordinates via CoordinateService
before persisting. Handles the conversion between the polygon_json storage
format and the points array format used by the API schema.
"""

import uuid

from app.core.exceptions import NotFoundException, ValidationException
from app.models.annotation import Annotation
from app.repositories.annotation import AnnotationRepository
from app.schemas.annotation import AnnotationCreate, AnnotationResponse, AnnotationUpdate
from app.services.coordinate import CoordinateService


class AnnotationService:
    """Coordinates CRUD operations for annotations with validation."""

    def __init__(self, db):
        """
        Initialize the service with a database session.

        Args:
            db: SQLAlchemy async session from the get_db dependency.
        """
        self.repo = AnnotationRepository(db)

    async def create(self, data: AnnotationCreate) -> AnnotationResponse:
        """
        Create a new annotation with coordinate validation.

        Validates the rectangle before persisting to ensure no invalid
        coordinates enter the database.

        Args:
            data: AnnotationCreate schema with document_id, page_number,
                label, and points.

        Returns:
            AnnotationResponse with the saved annotation data.

        Raises:
            ValidationException: If the rectangle fails validation
                (not exactly 2 points or coordinates outside [0,1]).
        """
        if not CoordinateService.validate_rect(data.points):
            raise ValidationException(
                "Invalid rectangle: need exactly 2 points in [0,1] range"
            )

        kwargs = {}
        if data.label_position is not None:
            kwargs["label_position_json"] = data.label_position
        if data.label_color is not None:
            kwargs["label_color"] = data.label_color
        if data.value is not None:
            kwargs["value"] = data.value
        if data.table_json is not None:
            kwargs["table_json"] = data.table_json
        annotation = Annotation(
            document_id=data.document_id,
            page_number=data.page_number,
            label=data.label,
            polygon_json={"points": data.points},
            **kwargs,
        )
        created = await self.repo.create(annotation)
        return AnnotationResponse.model_validate(created)

    async def update(
        self, annotation_id: uuid.UUID, data: AnnotationUpdate
    ) -> AnnotationResponse:
        """
        Update an existing annotation's label and/or points.

        Only applies validation if points are being updated.
        Label-only updates skip coordinate validation.

        Args:
            annotation_id: UUID of the annotation to update.
            data: AnnotationUpdate schema with optional label and points.

        Returns:
            AnnotationResponse with the updated annotation data.

        Raises:
            NotFoundException: If no annotation exists with the given ID.
            ValidationException: If the updated points fail validation.
        """
        existing = await self.repo.get_by_id(annotation_id)
        if not existing:
            raise NotFoundException("Annotation", str(annotation_id))

        update_data = {}
        if data.label is not None:
            update_data["label"] = data.label
        if data.label_color is not None:
            update_data["label_color"] = data.label_color
        if data.label_position is not None:
            update_data["label_position_json"] = data.label_position
        if data.value is not None:
            update_data["value"] = data.value
        if data.table_json is not None:
            update_data["table_json"] = data.table_json
        if data.annotation_type is not None:
            update_data["annotation_type"] = data.annotation_type
        if data.points is not None:
            if not CoordinateService.validate_rect(data.points):
                raise ValidationException(
                    "Invalid rectangle: need exactly 2 points in [0,1] range"
                )
            update_data["polygon_json"] = {"points": data.points}

        updated = await self.repo.update(annotation_id, update_data)
        return AnnotationResponse.model_validate(updated)

    async def delete(self, annotation_id: uuid.UUID) -> None:
        """
        Delete an annotation by ID.

        Args:
            annotation_id: UUID of the annotation to delete.

        Raises:
            NotFoundException: If no annotation exists with the given ID.
        """
        existing = await self.repo.get_by_id(annotation_id)
        if not existing:
            raise NotFoundException("Annotation", str(annotation_id))
        await self.repo.delete(annotation_id)

    async def get_by_document(
        self, document_id: uuid.UUID, page_number: int | None = None
    ) -> list[AnnotationResponse]:
        """
        Fetch all annotations for a document, optionally filtered by page.

        Extracts the points array from the stored polygon_json for each
        annotation to match the API schema format.

        Args:
            document_id: UUID of the parent document.
            page_number: Optional page filter. If None, returns all pages.

        Returns:
            A list of AnnotationResponse objects.
        """
        annotations = await self.repo.get_by_document(document_id, page_number)
        return [AnnotationResponse.model_validate(a) for a in annotations]

    async def sync(
        self, document_id: uuid.UUID, page_number: int, annotations_data: list[dict]
    ) -> list[AnnotationResponse]:
        """Replace all annotations for a page with the provided list."""
        await self.repo.delete_by_document_page(document_id, page_number)
        created = []
        for data in annotations_data:
            if not CoordinateService.validate_rect(data["points"]):
                continue
            kwargs = {}
            if data.get("label_position"):
                kwargs["label_position_json"] = data["label_position"]
            if data.get("label_color"):
                kwargs["label_color"] = data["label_color"]
            if data.get("annotation_type"):
                kwargs["annotation_type"] = data["annotation_type"]
            if data.get("value"):
                kwargs["value"] = data["value"]
            if data.get("table_json"):
                kwargs["table_json"] = data["table_json"]
            annotation = Annotation(
                document_id=document_id,
                page_number=page_number,
                label=data.get("label"),
                polygon_json={"points": data["points"]},
                **kwargs,
            )
            created_ann = await self.repo.create(annotation)
            created.append(AnnotationResponse.model_validate(created_ann))
        return created

    async def get_by_id(self, annotation_id: uuid.UUID) -> AnnotationResponse:
        """
        Fetch a single annotation by ID.

        Args:
            annotation_id: UUID of the annotation to retrieve.

        Returns:
            AnnotationResponse with the annotation data.

        Raises:
            NotFoundException: If no annotation exists with the given ID.
        """
        annotation = await self.repo.get_by_id(annotation_id)
        if not annotation:
            raise NotFoundException("Annotation", str(annotation_id))
        return AnnotationResponse.model_validate(annotation)
