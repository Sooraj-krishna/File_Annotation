"""
Pydantic schemas for structured AI extraction results.

Provides runtime validation of Gemini API responses to ensure
data integrity and catch malformed outputs early.
"""

from typing import Any

from pydantic import BaseModel, Field, field_validator


class ExtractedValue(BaseModel):
    """Single label-value extraction result."""
    label: str = Field(..., min_length=1, description="The label/field name")
    value: str = Field(default="", description="Extracted value (empty if not found)")

    @field_validator("value", mode="before")
    @classmethod
    def coerce_value(cls, v: Any) -> str:
        if v is None:
            return ""
        return str(v)


class ExtractionResult(BaseModel):
    """Top-level extraction response from AI."""
    results: list[ExtractedValue] = Field(default_factory=list)

    @field_validator("results", mode="before")
    @classmethod
    def ensure_list(cls, v: Any) -> list:
        if v is None:
            return []
        if not isinstance(v, list):
            return []
        return v


class TableCell(BaseModel):
    """Single table cell value."""
    value: str = Field(default="", description="Cell content")

    @field_validator("value", mode="before")
    @classmethod
    def coerce_cell(cls, v: Any) -> str:
        if v is None:
            return ""
        return str(v)


class TableRow(BaseModel):
    """Single table row."""
    cells: list[TableCell] = Field(default_factory=list)

    @field_validator("cells", mode="before")
    @classmethod
    def ensure_list(cls, v: Any) -> list:
        if v is None:
            return []
        if not isinstance(v, list):
            return []
        normalized = []
        for item in v:
            if isinstance(item, dict):
                normalized.append(TableCell(**item))
            elif isinstance(item, TableCell):
                normalized.append(item)
            else:
                normalized.append(TableCell(value=str(item)))
        return normalized


class TableData(BaseModel):
    """Structured table data."""
    headings: list[str] = Field(default_factory=list)
    rows: list[TableRow] = Field(default_factory=list)

    @field_validator("headings", mode="before")
    @classmethod
    def ensure_headings_list(cls, v: Any) -> list[str]:
        if v is None:
            return []
        if not isinstance(v, list):
            return []
        return [str(h) for h in v]

    @field_validator("rows", mode="before")
    @classmethod
    def ensure_rows_list(cls, v: Any) -> list:
        if v is None:
            return []
        if not isinstance(v, list):
            return []
        normalized = []
        for item in v:
            if isinstance(item, dict):
                normalized.append(TableRow(**item))
            elif isinstance(item, TableRow):
                normalized.append(item)
            elif isinstance(item, list):
                normalized.append(TableRow(cells=[TableCell(value=str(c)) for c in item]))
            else:
                normalized.append(TableRow(cells=[TableCell(value=str(item))]))
        return normalized

    def to_simple_format(self) -> dict:
        """Convert to simple dict format for API responses."""
        return {
            "headings": self.headings,
            "rows": [[cell.value for cell in row.cells] for row in self.rows],
        }

    def validate_structure(self) -> list[str]:
        """Validate table structure consistency. Returns list of errors."""
        errors = []
        expected_cols = len(self.headings) if self.headings else None
        
        for i, row in enumerate(self.rows):
            actual_cols = len(row.cells)
            if expected_cols is not None and actual_cols != expected_cols:
                errors.append(f"Row {i}: expected {expected_cols} columns, got {actual_cols}")
            elif expected_cols is None:
                # If no headings, all rows should have same column count
                if i == 0:
                    expected_cols = actual_cols
                elif actual_cols != expected_cols:
                    errors.append(f"Row {i}: inconsistent column count (first row had {expected_cols}, this row has {actual_cols})")
        
        return errors


class TableExtractionItem(BaseModel):
    """Single table extraction result for a labeled region."""
    label: str = Field(..., min_length=1)
    table: TableData = Field(default_factory=TableData)


class BatchTableResult(BaseModel):
    """Top-level batch table extraction response."""
    results: list[TableExtractionItem] = Field(default_factory=list)

    @field_validator("results", mode="before")
    @classmethod
    def ensure_list(cls, v: Any) -> list:
        if v is None:
            return []
        if not isinstance(v, list):
            return []
        return v


class AIResponseValidator:
    """
    Validates and normalizes AI extraction responses.
    
    Provides methods to parse, validate, and convert raw AI responses
    into structured, type-safe models.
    """
    
    @staticmethod
    def validate_extraction(raw_json: dict) -> ExtractionResult:
        """Validate a key-value extraction response."""
        return ExtractionResult.model_validate(raw_json)
    
    @staticmethod
    def validate_table(raw_json: dict) -> TableData:
        """Validate a single table response."""
        table_data = TableData.model_validate(raw_json.get("table", raw_json))
        errors = table_data.validate_structure()
        if errors:
            # Log but don't fail - return what we can
            pass
        return table_data
    
    @staticmethod
    def validate_batch_table(raw_json: dict) -> BatchTableResult:
        """Validate a batch table extraction response."""
        return BatchTableResult.model_validate(raw_json)
    
    @staticmethod
    def normalize_extraction_items(items: list[dict]) -> list[dict]:
        """Normalize extraction items to ensure consistent structure."""
        normalized = []
        for item in items:
            if isinstance(item, dict):
                label = item.get("label") or item.get("field") or ""
                value = item.get("value") or item.get("answer") or ""
                if label:
                    normalized.append({"label": str(label), "value": str(value)})
        return normalized
    
    @staticmethod
    def normalize_table_items(items: list[dict]) -> list[dict]:
        """Normalize batch table items."""
        normalized = []
        for item in items:
            if not isinstance(item, dict):
                continue
            label = item.get("label") or ""
            table = item.get("table", {})
            if label:
                normalized.append({"label": str(label), "table": table})
        return normalized