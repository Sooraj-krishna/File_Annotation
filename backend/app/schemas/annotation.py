"""
Pydantic schemas for annotation API request/response models.

Includes validation logic that enforces the normalized coordinate
contract: all rectangle points must be in the [0.0, 1.0] range and
each rectangle must have exactly 2 points (top-left, bottom-right).
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator


class AnnotationCreate(BaseModel):
    """
    Schema for creating a new annotation.

    Validates that the rectangle has exactly 2 points and that all
    coordinate values fall within the normalized [0.0, 1.0] range.

    Attributes:
        document_id: UUID of the parent document.
        page_number: 1-indexed page number (minimum 1).
        label: Optional text label for the rectangle.
        points: Array of exactly 2 [x, y] pairs (top-left, bottom-right).
    """

    document_id: uuid.UUID
    page_number: int = Field(ge=1)
    label: str | None = None
    value: str | None = None
    table_json: dict | None = None
    label_color: str | None = None
    annotation_type: str | None = None
    points: list[list[float]]
    label_position: dict | None = None

    @model_validator(mode="after")
    def validate_points(self):
        """
        Validate that points form a valid normalized rectangle.

        Rules:
            - Exactly 2 points (top-left and bottom-right).
            - Each point must have exactly 2 coordinates.
            - Each coordinate value must be in the [0.0, 1.0] range.

        Returns:
            The validated model instance.

        Raises:
            ValueError: If validation fails.
        """
        if len(self.points) != 2:
            raise ValueError("Rectangle must have exactly 2 points (top-left, bottom-right)")
        for point in self.points:
            if len(point) != 2:
                raise ValueError(
                    f"Each point must have exactly 2 coordinates, got {len(point)}"
                )
            x, y = point
            if not (0.0 <= x <= 1.0 and 0.0 <= y <= 1.0):
                raise ValueError(f"Point ({x}, {y}) must be in [0, 1] range")
        return self


class AnnotationUpdate(BaseModel):
    """
    Schema for updating an existing annotation.

    All fields are optional — only provided fields will be updated.
    If points are provided, they should already be validated by the caller.

    Attributes:
        label: New label text (set to null to clear the label).
        points: Updated rectangle coordinates in normalized space.
    """

    label: str | None = None
    value: str | None = None
    table_json: dict | None = None
    label_color: str | None = None
    annotation_type: str | None = None
    points: list[list[float]] | None = None
    label_position: dict | None = None


class AnnotationResponse(BaseModel):
    """
    Schema returned by annotation endpoints.

    Converts the stored polygon_json back into the points array format
    that the frontend expects. Each annotation is a rectangle defined
    by 2 normalized points (top-left, bottom-right).

    The model_validator transforms ORM model instances into the dict
    format Pydantic expects, mapping polygon_json → points and
    label_position_json → label_position.

    Attributes:
        id: UUID of the annotation.
        document_id: UUID of the parent document.
        page_number: Page number this annotation belongs to.
        label: Text label, or null if not set.
        value: Extracted text value, or null if not extracted.
        table_json: Extracted table structure, or null.
        points: Array of 2 normalized [x, y] pairs.
        created_at: Creation timestamp.
        updated_at: Last modification timestamp.
    """

    id: uuid.UUID
    document_id: uuid.UUID
    page_number: int
    label: str | None
    value: str | None = None
    table_json: dict | None = None
    label_color: str | None = None
    annotation_type: str = "extraction"
    points: list[list[float]]
    label_position: dict | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def from_orm(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        return {
            "id": data.id,
            "document_id": data.document_id,
            "page_number": data.page_number,
            "label": data.label,
            "value": data.value,
            "table_json": data.table_json,
            "label_color": data.label_color,
            "annotation_type": data.annotation_type,
            "points": data.polygon_json["points"],
            "label_position": data.label_position_json,
            "created_at": data.created_at,
            "updated_at": data.updated_at,
        }


class SyncAnnotationItem(BaseModel):
    """A single annotation within a sync batch payload."""
    label: str | None = None
    value: str | None = None
    table_json: dict | None = None
    label_color: str | None = None
    annotation_type: str | None = None
    points: list[list[float]]
    label_position: dict | None = None


class SyncRequest(BaseModel):
    """Schema for batch-syncing all annotations on a page."""
    page_number: int = Field(ge=1)
    annotations: list[SyncAnnotationItem]
