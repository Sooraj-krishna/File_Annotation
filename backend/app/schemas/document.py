"""
Pydantic schemas for document API request/response models.

Defines the structure and validation rules for data exchanged
between the frontend and the document endpoints. Uses Pydantic's
from_attributes mode to enable ORM model serialization.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel


class DocumentResponse(BaseModel):
    """
    Schema returned by document GET and POST endpoints.

    Serializes the Document ORM model into a JSON-compatible format.
    The from_attributes config allows Pydantic to read from SQLAlchemy model attributes.

    Attributes:
        id: UUID assigned to the document.
        filename: Original filename of the uploaded PDF or image.
        mime_type: MIME type of the file (application/pdf, image/png, etc.).
        page_count: Total number of pages.
        created_at: Upload timestamp.
        updated_at: Last modification timestamp.
    """

    id: uuid.UUID
    filename: str
    mime_type: str = "application/pdf"
    page_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentList(BaseModel):
    """
    Schema returned by the document list endpoint.

    Attributes:
        documents: Array of document response objects.
        total: Total count of documents returned.
    """

    documents: list[DocumentResponse]
    total: int
