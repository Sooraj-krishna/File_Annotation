"""
Abstract storage backend interface.

Defines the contract that all storage backends must implement.
Currently only LocalStorage exists, but this abstraction allows
seamless migration to S3, MinIO, or GCS in the future without
changing any service-layer code.
"""

import abc


class StorageBackend(abc.ABC):
    """
    Abstract base class for file storage backends.

    All storage operations (save, read, delete, exists) are async
    and work with raw bytes. The document_id parameter provides
    namespace isolation between documents.
    """

    @abc.abstractmethod
    async def save(self, data: bytes, document_id: str, filename: str) -> str:
        """
        Save a file to storage.

        Args:
            data: Raw file bytes.
            document_id: UUID string for namespace isolation.
            filename: Original filename for the stored file.

        Returns:
            The storage path that can be used to retrieve the file later.
        """
        ...

    @abc.abstractmethod
    async def read(self, path: str) -> bytes:
        """
        Read a file from storage.

        Args:
            path: Storage path returned by a previous save() call.

        Returns:
            The file contents as raw bytes.
        """
        ...

    @abc.abstractmethod
    async def delete(self, path: str) -> None:
        """
        Delete a file from storage.

        Args:
            path: Storage path of the file to delete.
        """
        ...

    @abc.abstractmethod
    async def exists(self, path: str) -> bool:
        """
        Check if a file exists in storage.

        Args:
            path: Storage path to check.

        Returns:
            True if the file exists, False otherwise.
        """
        ...
