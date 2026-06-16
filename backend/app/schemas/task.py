"""
Pydantic schema for the async save task status.

The save endpoint returns a task ID immediately and processes
the PDF in the background. The frontend polls this schema
to track progress and know when the annotated PDF is ready.
"""

import uuid

from pydantic import BaseModel


class TaskResponse(BaseModel):
    """
    Schema returned by save task endpoints.

    Attributes:
        task_id: UUID identifying this save task.
        status: Current status — "pending", "processing", "completed", or "failed".
        progress: Integer percentage (0-100) indicating completion.
        result_url: URL to retrieve the result once status is "completed".
    """

    task_id: uuid.UUID
    status: str
    progress: int = 0
    result_url: str | None = None
