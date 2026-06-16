"""
Document ORM model representing an uploaded file (PDF or image).

Each row in the `documents` table corresponds to one uploaded file.
The model stores metadata (filename, mime type, page count) and a reference to
the file on disk. Cascade delete ensures all associated annotations
are removed when a document is deleted.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Document(Base):
    """
    Represents an uploaded file (PDF or image).

    Attributes:
        id: UUID primary key, auto-generated.
        filename: Original filename from the upload.
        file_path: Absolute path to the file on disk.
        mime_type: MIME type of the file (e.g. application/pdf, image/png).
        page_count: Number of pages (PDFs may have multiple, images always 1).
        created_at: Timestamp of when the record was created.
        updated_at: Timestamp of last update, auto-updated on change.
        annotations: ORM relationship to associated Annotation records.
    """

    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(128), nullable=False, default="application/pdf")
    page_count: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # One-to-many relationship: deleting a document cascades to its annotations
    annotations = relationship(
        "Annotation", back_populates="document", cascade="all, delete-orphan"
    )
