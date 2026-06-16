"""
Extraction API routes — AI-powered label-value extraction and report generation.

Endpoints:
  1. POST /{id}/extract              — Run AI extraction on a document's annotations
  2. POST /{id}/generate-report      — Generate a formatted PDF report from extracted data
  3. GET  /{id}/extraction-log       — Read the extraction audit log for a document
  4. GET  /{id}/crop/{annotation_id} — Return a PNG crop of a single annotation region

All endpoints log every step to a per-document JSONL audit trail.
"""

import io
import uuid

import fitz
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.file_utils import mime_to_fitz_filetype
from app.database.session import get_db
from app.repositories.annotation import AnnotationRepository
from app.repositories.document import DocumentRepository
from app.schemas.extraction import ExtractResponse, ExtractedItem, ReportRequest
from app.services.ai_extractor import AIExtractorError, AIExtractorService
from app.services.extraction_logger import ExtractionLogger
from app.services.pdf import PDFService
from app.storage.local import LocalStorage

router = APIRouter()


def _build_crop_url(document_id: str, annotation_id: str) -> str:
    """Build the crop URL for an annotation, used in extraction responses."""
    return f"/api/documents/{document_id}/crop/{annotation_id}"


@router.post("/{document_id}/extract", response_model=ExtractResponse)
async def extract_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Run AI extraction on all annotations for a document.

    Loads the document and its annotations, crops each annotated region
    from the PDF pages, sends the cropped images to Gemini Vision with
    a structured prompt, and returns the extracted label-value pairs
    along with crop URLs.

    Args:
        document_id: UUID of the document to extract from.
        db: Database session from dependency injection.

    Returns:
        ExtractResponse with extracted label-value pairs and crop URLs.

    Raises:
        404: If the document is not found.
        400: If the document has no annotations.
        502: If the AI extraction fails.
    """
    doc_repo = DocumentRepository(db)
    doc = await doc_repo.get_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    ann_repo = AnnotationRepository(db)
    annotations = await ann_repo.get_by_document(document_id)
    if not annotations:
        raise HTTPException(
            status_code=400,
            detail="No annotations found for this document. Draw at least one rectangle first.",
        )

    storage = LocalStorage()
    pdf_bytes = await storage.read(doc.file_path)

    logger = ExtractionLogger(str(document_id))

    # Separate annotations by type
    query_anns = [a for a in annotations if getattr(a, "annotation_type", "extraction") in ("extraction", "table") and a.label]
    reference_anns = [a for a in annotations if getattr(a, "annotation_type", "extraction") == "reference"]

    logger.log("ANNOTATIONS_LOADED", "extraction", {
        "total": len(annotations),
        "query_type": len(query_anns),
        "reference_type": len(reference_anns),
    })

    logger.log("PDF_LOADED", "extraction", {
        "file_size_bytes": len(pdf_bytes),
        "total_pages": doc.page_count,
        "filename": doc.filename,
    })

    result_items: list[dict] = []
    doc_id_str = str(document_id)

    # -- Query-driven annotations → Gemini AI for table extraction --
    if query_anns:
        ann_dicts = [
            {
                "id": str(a.id),
                "page_number": a.page_number,
                "label": a.label,
                "label_color": a.label_color,
                "annotation_type": a.annotation_type,
                "points": a.polygon_json["points"],
            }
            for a in query_anns
        ]

        try:
            service = AIExtractorService()
            table_items = service.extract_query_tables(pdf_bytes, ann_dicts, logger)

            logger.log("QUERY_EXTRACTION_COMPLETE", "extraction", {
                "item_count": len(table_items),
                "items": table_items,
            })

            # Persist extracted table_json back to annotation records and clear old scalar values
            for it in table_items:
                ann_id = it.get("annotation_id")
                if ann_id:
                    await ann_repo.update(
                        uuid.UUID(ann_id),
                        {
                            "table_json": it["table_json"],
                            "value": None,
                        },
                    )

            for it in table_items:
                result_items.append({
                    "label": it["label"],
                    "value": "",
                    "table_json": it["table_json"],
                    "annotation_id": it.get("annotation_id"),
                    "annotation_type": "table",
                })
        except AIExtractorError as e:
            logger.log("ERROR_QUERY_EXTRACTION", "extraction", {
                "error": str(e),
            })
            raise HTTPException(status_code=502, detail=str(e))

    # -- Reference-type annotations → crop region images (no AI) --
    if reference_anns:
        logger.log("REFERENCE_CROPS", "extraction", {
            "count": len(reference_anns),
        })
        for a in reference_anns:
            ann_id = str(a.id)
            label = a.label or "Reference"
            result_items.append({
                "label": label,
                "value": "",
                "annotation_id": ann_id,
                "annotation_type": "reference",
            })

    # Prune old runs after successful extraction
    logger._prune_old_runs()

    if not result_items:
        raise HTTPException(
            status_code=400,
            detail="No extraction, table, or reference annotations found.",
        )

    return ExtractResponse(
        items=[
            ExtractedItem(
                label=it["label"],
                value=it["value"],
                annotation_id=it.get("annotation_id"),
                annotation_type=it.get("annotation_type", "extraction"),
                table_json=it.get("table_json"),
                crop_url=_build_crop_url(doc_id_str, it["annotation_id"])
                if it.get("annotation_id") else None,
            )
            for it in result_items
        ]
    )


@router.get("/{document_id}/crop/{annotation_id}")
async def crop_annotation_region(
    document_id: uuid.UUID,
    annotation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Render and return a PNG crop of a single annotation's region.

    Uses the PDF page and annotation coordinates to clip-render just
    the annotated rectangle area at 96 DPI.

    Args:
        document_id: UUID of the parent document.
        annotation_id: UUID of the annotation to crop.
        db: Database session from dependency injection.

    Returns:
        StreamingResponse with image/png content.

    Raises:
        404: If the document or annotation is not found.
    """
    doc_repo = DocumentRepository(db)
    doc = await doc_repo.get_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    ann_repo = AnnotationRepository(db)
    annotation = await ann_repo.get_by_id(annotation_id)
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    storage = LocalStorage()
    pdf_bytes = await storage.read(doc.file_path)

    fitz_type = mime_to_fitz_filetype(doc.mime_type)
    pdf_doc = fitz.open(stream=pdf_bytes, filetype=fitz_type)
    try:
        page = pdf_doc[annotation.page_number - 1]
        page_rect = page.rect
        pts = annotation.polygon_json["points"]
        clip = fitz.Rect(
            pts[0][0] * page_rect.width,
            pts[0][1] * page_rect.height,
            pts[1][0] * page_rect.width,
            pts[1][1] * page_rect.height,
        )
        pix = page.get_pixmap(dpi=96, clip=clip)
        png_bytes = pix.tobytes("png")
    finally:
        pdf_doc.close()

    return StreamingResponse(
        io.BytesIO(png_bytes),
        media_type="image/png",
        headers={
            "Cache-Control": "private, max-age=86400",
        },
    )


@router.post("/{document_id}/generate-report")
async def generate_report(
    document_id: uuid.UUID,
    data: ReportRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a formatted PDF report from extracted label-value data.

    Produces an A4 PDF with the document filename as the title and
    a 2-column table (Label | Value) containing the extracted data.

    Args:
        document_id: UUID of the source document.
        data: ReportRequest with the list of extracted items.
        db: Database session from dependency injection.

    Returns:
        StreamingResponse with the generated PDF file.

    Raises:
        404: If the document is not found.
        400: If no items are provided.
    """
    if not data.items:
        raise HTTPException(
            status_code=400,
            detail="No items provided for report generation",
        )

    doc_repo = DocumentRepository(db)
    doc = await doc_repo.get_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    logger = ExtractionLogger(str(document_id))

    title = doc.filename.replace(".pdf", "") if doc.filename.endswith(".pdf") else doc.filename

    # Build items_data with pre-rendered crop PNGs for items that have annotation_id
    items_data: list[dict] = []
    needs_pdf = any(it.annotation_id for it in data.items)
    storage = LocalStorage()
    pdf_doc = None
    pdf_bytes_for_report = None
    if needs_pdf:
        pdf_bytes_for_report = await storage.read(doc.file_path)
        fitz_type = mime_to_fitz_filetype(doc.mime_type)
        pdf_doc = fitz.open(stream=pdf_bytes_for_report, filetype=fitz_type)

    try:
        for it in data.items:
            item: dict = {
                "label": it.label,
                "value": it.value,
                "annotation_id": it.annotation_id,
                "annotation_type": it.annotation_type,
                "table_json": it.table_json,
            }
            if it.annotation_id and pdf_doc:
                ann_repo = AnnotationRepository(db)
                ann = await ann_repo.get_by_id(uuid.UUID(it.annotation_id))
                if ann:
                    page = pdf_doc[ann.page_number - 1]
                    page_rect = page.rect
                    pts = ann.polygon_json["points"]
                    clip = fitz.Rect(
                        pts[0][0] * page_rect.width,
                        pts[0][1] * page_rect.height,
                        pts[1][0] * page_rect.width,
                        pts[1][1] * page_rect.height,
                    )
                    pix = page.get_pixmap(dpi=96, clip=clip)
                    item["crop_png"] = pix.tobytes("png")
            items_data.append(item)
    finally:
        if pdf_doc:
            pdf_doc.close()

    try:
        report_pdf_bytes = PDFService.generate_report(title, items_data)
    except Exception as e:
        logger.log("ERROR_REPORT_GENERATION", "report", {"error": str(e)})
        raise HTTPException(status_code=500, detail=f"Report generation failed: {e}")

    logger.log("REPORT_GENERATED", "report", {
        "item_count": len(items_data),
        "file_size_bytes": len(report_pdf_bytes),
        "pages": doc.page_count,
    })

    return StreamingResponse(
        io.BytesIO(report_pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{title} - Extracted Data.pdf"',
        },
    )


@router.get("/{document_id}/extraction-log")
async def get_extraction_log(
    document_id: uuid.UUID,
):
    """
    Read the extraction audit log for a document.

    Returns all logged events from previous extraction runs
    on this document.

    Args:
        document_id: UUID of the document.

    Returns:
        Dict with an 'entries' array of log entry objects.
    """
    logger = ExtractionLogger(str(document_id))
    entries = logger.read_all()
    return {"entries": entries}
