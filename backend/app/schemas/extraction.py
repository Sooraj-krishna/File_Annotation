from pydantic import BaseModel


class ExtractedItem(BaseModel):
    """A single label-value pair returned by AI extraction."""
    label: str
    value: str
    annotation_id: str | None = None
    annotation_type: str = "extraction"
    crop_url: str | None = None
    table_json: dict | None = None


class ExtractResponse(BaseModel):
    """Response from the extraction endpoint."""
    items: list[ExtractedItem]


class ReportItem(BaseModel):
    """An extracted item to include in the report, optionally with an annotation ID for crop."""
    label: str
    value: str
    annotation_id: str | None = None
    annotation_type: str = "extraction"
    table_json: dict | None = None


class ReportRequest(BaseModel):
    """Request body for report generation."""
    items: list[ReportItem]
