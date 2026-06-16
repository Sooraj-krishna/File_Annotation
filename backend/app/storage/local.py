"""
Local filesystem storage backend.

Implements the StorageBackend ABC using the local filesystem.
PDFs are organized in directories named by document UUID to
prevent filename collisions. Uses aiofiles for non-blocking
file I/O that integrates with the async event loop.
"""

from pathlib import Path

import aiofiles

from app.core.config import settings
from app.storage.base import StorageBackend


class LocalStorage(StorageBackend):
    """
    Stores PDF files on the local filesystem.

    File structure: {storage_path}/{document_id}/{filename}
    This ensures isolation between documents and prevents
    filename collisions without requiring unique filenames.
    """

    def __init__(self):
        """Initialize the storage directory, creating it if needed."""
        self.base_path = Path(settings.storage__path).resolve()
        self.base_path.mkdir(parents=True, exist_ok=True)

    async def save(self, data: bytes, document_id: str, filename: str) -> str:
        """
        Save a file to the local filesystem.

        Creates the document's directory if it does not exist,
        then writes the file asynchronously.

        Args:
            data: Raw PDF bytes to save.
            document_id: UUID string for directory isolation.
            filename: Original filename.

        Returns:
            Absolute path to the saved file.
        """
        doc_dir = self.base_path / document_id
        doc_dir.mkdir(parents=True, exist_ok=True)
        file_path = doc_dir / filename
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(data)
        return str(file_path)

    async def read(self, path: str) -> bytes:
        """
        Read a file from the local filesystem.

        Args:
            path: Absolute path to the file.

        Returns:
            The file contents as raw bytes.
        """
        async with aiofiles.open(path, "rb") as f:
            return await f.read()

    async def delete(self, path: str) -> None:
        """
        Delete a file from the local filesystem.

        Args:
            path: Absolute path to the file to delete.
        """
        Path(path).unlink(missing_ok=True)

    async def exists(self, path: str) -> bool:
        """
        Check if a file exists on the filesystem.

        Args:
            path: Absolute path to check.

        Returns:
            True if the file exists, False otherwise.
        """
        return Path(path).exists()
