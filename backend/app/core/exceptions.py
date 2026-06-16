"""
Custom exception classes for the application.

These exceptions are raised by services and repositories,
then caught and translated to HTTP responses by the error handler.
This keeps business logic decoupled from HTTP status codes.
"""


class AppException(Exception):
    """Base exception for all application-level errors."""

    pass


class NotFoundException(AppException):
    """
    Raised when a requested entity does not exist.

    Args:
        entity: The type of entity (e.g., "Document", "Annotation").
        entity_id: The unique identifier of the entity.
    """

    def __init__(self, entity: str, entity_id: str):
        self.entity = entity
        self.entity_id = entity_id
        super().__init__(f"{entity} not found: {entity_id}")


class ValidationException(AppException):
    """Raised when input data fails validation rules."""

    pass


class StorageException(AppException):
    """Raised when a file storage operation fails."""

    pass
