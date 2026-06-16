"""
Model exports — provides a clean import interface for all ORM models.

Other modules can import models via:
    from app.models import Document, Annotation
instead of importing from individual files.
"""

from app.models.annotation import Annotation
from app.models.document import Document

__all__ = ["Document", "Annotation"]
