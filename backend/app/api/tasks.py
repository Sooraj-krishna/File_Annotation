"""
Async save task API routes.

PDF save is an expensive operation (load → apply annotations → generate →
replace). Instead of blocking the HTTP request, we return a task ID
immediately and process the PDF in a background asyncio task. The
frontend polls the task status endpoint to track progress.

In MVP 1, task state is stored in an in-memory dict. For production,
this should be replaced with a persistent store (Redis/celery).
"""

import asyncio
import logging
import uuid
from dataclasses import dataclass

from fastapi import APIRouter, HTTPException

from app.database.session import async_session
from app.repositories.annotation import AnnotationRepository
from app.repositories.document import DocumentRepository
from app.schemas.task import TaskResponse
from app.services.pdf import PDFService
from app.storage.local import LocalStorage

logger = logging.getLogger(__name__)

router = APIRouter()


@dataclass
class TaskState:
    """
    In-memory state for an async save task.

    Attributes:
        status: Current status (pending/processing/completed/failed).
        progress: Integer 0-100 indicating completion percentage.
        result_url: URL to the saved document once complete.
        error: Error message if the task failed.
    """
    status: str = "pending"
    progress: int = 0
    result_url: str | None = None
    error: str | None = None


# In-memory task store — use Redis/celery for production
tasks: dict[str, TaskState] = {}


async def run_save(task_id: str, document_id: uuid.UUID):
    """
    Background task that generates an annotated PDF.

    Pipeline:
        1. Fetch document metadata and all annotations.
        2. Load the original PDF from storage.
        3. Draw each annotation (rectangle + label) onto the PDF.
        4. Generate the new PDF bytes.
        5. Replace the original file in storage.

    Progress is updated at each stage so the frontend can display
    a progress bar.

    Args:
        task_id: UUID string identifying this task.
        document_id: UUID of the document to process.
    """
    task = tasks[task_id]
    try:
        task.status = "processing"
        task.progress = 10

        async with async_session() as session:
            doc_repo = DocumentRepository(session)
            ann_repo = AnnotationRepository(session)
            storage = LocalStorage()

            document = await doc_repo.get_by_id(document_id)
            if not document:
                task.status = "failed"
                task.error = "Document not found"
                return

            annotations = await ann_repo.get_by_document(document_id)
        task.progress = 20

        # Load the original PDF
        pdf_bytes = await storage.read(document.file_path)
        doc = PDFService.load_from_bytes(pdf_bytes)
        task.progress = 30

        # Convert annotations to the format PDFService expects
        total = len(annotations)
        ann_dicts = []
        for i, ann in enumerate(annotations):
            ann_dicts.append({
                "page_number": ann.page_number,
                "points": ann.polygon_json["points"],
                "label": ann.label,
                "value": ann.value,
                "table_json": ann.table_json,
                "label_color": ann.label_color,
            })
            task.progress = 30 + int((i + 1) / max(total, 1) * 50)

        # Draw all annotations onto the PDF
        if ann_dicts:
            doc = PDFService.apply_annotations(doc, ann_dicts)
        task.progress = 80

        # Generate the new PDF bytes and replace the file
        new_pdf_bytes = PDFService.generate(doc)
        doc.close()
        task.progress = 90

        await storage.save(new_pdf_bytes, str(document_id), document.filename)
        task.progress = 100
        task.status = "completed"
        task.result_url = f"/api/documents/{document_id}"

    except Exception as e:
        logger.exception("Save task %s failed", task_id)
        task.status = "failed"
        task.error = str(e)


@router.post("/documents/{document_id}/save", response_model=TaskResponse)
async def start_save(
    document_id: uuid.UUID,
):
    """
    Start an async save task that generates an annotated PDF.

    Returns immediately with a task ID. The frontend should poll
    GET /api/tasks/{task_id} to track progress.

    Args:
        document_id: UUID of the document to save.

    Returns:
        TaskResponse with the initial pending state.
    """
    task_id = str(uuid.uuid4())
    tasks[task_id] = TaskState()
    asyncio.create_task(run_save(task_id, document_id))
    return TaskResponse(task_id=uuid.UUID(task_id), status="pending", progress=0)


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str):
    """
    Poll the status of a save task.

    The frontend calls this endpoint every ~1 second while a save
    is in progress to update the progress bar.

    Args:
        task_id: UUID string of the task to check.

    Returns:
        TaskResponse with the current status and progress.

    Raises:
        404: If the task ID is not found.
    """
    task = tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskResponse(
        task_id=uuid.UUID(task_id),
        status=task.status,
        progress=task.progress,
        result_url=task.result_url,
    )
