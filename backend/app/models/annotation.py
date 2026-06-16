"""
Annotation ORM model representing a rectangle label on a PDF page.

Each annotation stores a rectangle as 2 normalized corner points
(top-left, bottom-right) in JSON format, making them resolution-
independent and zoom-safe. The composite index on (document_id,
page_number) optimizes the most common query pattern: fetching
all annotations for a specific page.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, Text, func, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Annotation(Base):
    """
    Represents a rectangle annotation drawn on a PDF page.

    Coordinates are stored in normalized form (0.0 to 1.0) relative
    to the page dimensions, ensuring annotations remain correctly
    positioned regardless of zoom level or display resolution.
    A rectangle is defined by 2 points: top-left and bottom-right.

    Attributes:
        id: UUID primary key, auto-generated.
        document_id: Foreign key referencing the parent document.
        page_number: 1-indexed page number this annotation belongs to.
        label: Optional text label displayed near the rectangle.
        value: Extracted text value (populated by AI extraction), or None.
        table_json: Extracted table structure with headings and rows, or None.
        polygon_json: JSON object containing the normalized points array.
        created_at: Timestamp of creation.
        updated_at: Timestamp of last update.
        document: ORM relationship back to the parent Document.
    """

    __tablename__ = "annotations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str | None] = mapped_column(Text, nullable=True)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    table_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    label_color: Mapped[str | None] = mapped_column(Text, nullable=True)
    annotation_type: Mapped[str] = mapped_column(
        Text, nullable=False, default="extraction", server_default="extraction"
    )
    polygon_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    label_position_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    document = relationship("Document", back_populates="annotations")

    # Composite index: optimizes "get all annotations for document X, page Y"
    __table_args__ = (
        Index("ix_annotations_doc_page", "document_id", "page_number"),
    )
