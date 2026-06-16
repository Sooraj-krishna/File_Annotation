"""
FastAPI exception handlers that translate application exceptions
to standardized HTTP error responses.

Registered in main.py during app startup. Routes can raise
exceptions from app.core.exceptions and the handler converts them
to appropriate JSON responses with proper HTTP status codes.
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.core.exceptions import NotFoundException, StorageException, ValidationException


def register_error_handlers(app: FastAPI):
    """Register all custom exception handlers on the FastAPI app instance."""

    @app.exception_handler(NotFoundException)
    async def not_found_handler(request: Request, exc: NotFoundException):
        """Handle 404 errors — entity was not found in the database."""
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(ValidationException)
    async def validation_handler(request: Request, exc: ValidationException):
        """Handle 422 errors — input data failed validation."""
        return JSONResponse(status_code=422, content={"detail": str(exc)})

    @app.exception_handler(StorageException)
    async def storage_handler(request: Request, exc: StorageException):
        """Handle 500 errors — file storage operation failed."""
        return JSONResponse(status_code=500, content={"detail": "Storage error"})

    @app.exception_handler(FileNotFoundError)
    async def file_not_found_handler(request: Request, exc: FileNotFoundError):
        """Handle FileNotFoundError — file was not found on the local filesystem."""
        return JSONResponse(
            status_code=404,
            content={
                "detail": "The PDF file was not found on the server's storage. Because this server uses ephemeral storage, uploaded files are cleared on redeployment or restart. Please delete this document from the list and upload it again."
            }
        )
