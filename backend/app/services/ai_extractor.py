"""
AI extraction service — uses Gemini Vision API to extract text values from
labeled rectangular regions on PDF pages.

Flow:
  1. Crop each annotated region from the PDF at 300 DPI.
  2. Send cropped region images + structured prompt to Gemini.
  3. Parse JSON response, merge duplicate labels, return results.

All steps are logged to the per-document extraction log.
"""

import json
import re
import time
from collections import OrderedDict

import fitz
from google import genai
from google.genai import errors as genai_errors, types as genai_types

from app.core.config import settings
from app.core.file_utils import detect_mime_type, mime_to_fitz_filetype
from app.services.image_preprocessing import (
    preprocess_image,
    PreprocessingConfig,
    PreprocessingMode,
)
from app.schemas.extraction_result import (
    AIResponseValidator,
)
from app.services.extraction_logger import ExtractionLogger


PROMPT_TEMPLATE = """[ROLE]
You are a deterministic, zero-shot Document Data Extraction Engine. Your sole purpose is to perform high-fidelity Optical Character Recognition (OCR) and semantic key-value mapping on cropped document regions.

[INPUT]
You will receive a sequence of images. They map directly, in identical sequential order, to the following structural labels:
{labels_list}

[STRICT OPERATIONAL CONSTRAINTS]
1. LINGUISTIC DIRECTION (CRITICAL): 
   - You must parse and output Arabic/RTL scripts in their correct, natural linguistic reading direction (Right-to-Left). 
   - DO NOT reverse character sequences. DO NOT mirror words. 
   - Words must be readable, grammatically coherent strings in their native script, not a character-by-character inversion.
   - Support all Unicode scripts including Arabic, Hebrew, Devanagari, Chinese, Japanese, Korean, Cyrillic, and Latin.

2. AS-IS TRANSCRIPTION: 
   - Extract text literally. 
   - Never fix spelling mistakes, never expand abbreviations, never truncate values, and never normalize dates/numbers. 
   - If a line reads "2018/2478", output exactly "2018/2478".
   - Preserve all punctuation, symbols, currency marks ($, €, £, ¥, etc.), and units exactly as visible.

3. VISUAL LAYOUT & SPATIAL RELATIONSHIPS:
   - For key-value form fields or tabular data, preserve the alignment using standard spaces (' ') for horizontal gaps and explicit newline characters ('\\n') for vertical line breaks.
   - Do not let text from adjacent columns bleed into each other horizontally; process rows line-by-line.
   - If text appears in multiple columns, maintain column separation in the output.

4. NULL / EMPTY STATES:
   - If a cropped region contains only a structural background, lines, frames, or is entirely blank with no readable text, you MUST return an empty string "" for that value. Do not invent filler text.
   - If text is partially cut off at image boundaries, extract only the visible portion.

5. UNCERTAINTY HANDLING:
   - If text is partially readable but uncertain, extract your best literal reading.
   - Do NOT add confidence scores, markers, or annotations to the output.
   - The output schema does not support confidence fields.

6. OUTPUT COMPLIANCE:
   - Your output must be a single, valid, parsable JSON string.
   - DO NOT wrap the output in markdown code blocks (e.g., NO ```json ... ```).
   - DO NOT include conversational text, prefaces, notes, or explanations.
   - Ensure all quotes within extracted values are properly escaped (\\") to prevent JSON structural corruption.

[OUTPUT SCHEMA]
{{"results": [{{"label": "...", "value": "..."}}]}}"""

TABLE_PROMPT_TEMPLATE = """You are a document table extraction engine. Extract the table structure EXACTLY as shown.

OUTPUT FORMAT (no markdown, no extra text):
{"table": {"headings": ["..."], "rows": [["...", "..."], ["...", "..."]]}}

RULES:
- Copy text EXACTLY as visible (capitalization, punctuation, symbols, currency, dates, units)
- Preserve row/column order and count exactly
- Every row = same number of entries as columns
- Visible headers → "headings": [...]; No headers → "headings": []
- Multi-line cells: "Line 1\\nLine 2" (single cell, NOT extra rows)
- Empty cells: "" (do not remove/shift)
- Merged cells (colspan): text in first column, "" in spanned columns
- Partially visible text: extract only visible portion
- Unreadable: ""
- No table/structure → "headings": [], "rows": []
- NEVER invent, infer, repair, normalize, or guess
- Return ONLY valid JSON"""

TABLE_BATCH_PROMPT_TEMPLATE = """
You are a high-precision document table extraction engine. Treat this as a deterministic document parsing task, not a reasoning task.

PRIORITIES:
1. Visual fidelity over semantic interpretation
2. Extract less rather than more when uncertain
3. Never infer, repair, normalize, or guess

TASK:
Each image is an independent cropped region. Extract the table structure from each image independently.

The images correspond to these labels in order:
{labels_list}

OUTPUT FORMAT - Return ONLY this JSON structure (no markdown, no extra text):
{
  "results": [
    {
      "label": "...",
      "table": {
        "headings": ["col1", "col2", ...],
        "rows": [
          ["val1", "val2", ...],
          ["val3", "val4", ...]
        ]
      }
    }
  ]
}

EXTRACTION RULES:

TEXT FIDELITY:
- Copy text EXACTLY as visible: preserve capitalization, punctuation, spacing, symbols, currency ($,€,£,¥), percentages, dates, units
- Do NOT paraphrase, summarize, or normalize formatting
- Preserve OCR artifacts if they are visibly part of the text

NO HALLUCINATION:
- Never invent text, infer hidden content, complete truncated words, or reconstruct cropped values
- Never use external knowledge or surrounding context to guess missing text

IMAGE BOUNDARY RULE:
- Read ONLY content fully visible within the image boundaries
- If text is cut off, cropped, partially visible, or bleeding from outside: extract ONLY the visible portion
- Do not complete missing characters

TABLE STRUCTURE PRESERVATION:
- Preserve row order, column order, row count, column count EXACTLY
- Do not merge/split rows or columns
- Every row must have EXACTLY the same number of entries as detected columns

COLUMN HEADERS:
- If visible headers exist: "headings": [...]
- If NO visible headers: "headings": []
- Do NOT invent headers

CELL ALIGNMENT:
- Column positions must remain unchanged
- Every row = exactly the same number of entries as columns

MULTI-LINE CELLS:
- If a cell contains multiple visible lines (Line 1\\nLine 2): return "Line 1\\nLine 2"
- Do NOT create additional rows for line breaks within a cell

EMPTY CELLS:
- Represent as empty string ""
- Do NOT remove empty cells or shift neighboring values

MERGED CELLS (COLSPAN) - CRITICAL:
- If one cell visually spans multiple columns: place text in FIRST covered column, fill remaining with ""
- Example: Visual: Street | Building | Floor | Unit → "Rail Road" spans Street+Building
  Output: ["Rail Road", "", "01", "1"]

UNCLEAR TEXT:
- Partially readable: return best literal visual reading
- Completely unreadable: ""

EMPTY/INVALID TABLE REGION:
- No table, no rows, no meaningful tabular structure → "headings": [], "rows": []

VALIDATION CHECKLIST (self-verify before returning):
☐ All visible rows preserved
☐ All visible columns preserved
☐ No inferred content
☐ No repaired OCR
☐ No normalized values
☐ Consistent column counts per table
☐ Valid JSON only
☐ Output faithfully reconstructs visible table structure
"""

QUERY_TABLE_BATCH_PROMPT_TEMPLATE = """
You are a high-precision document data extraction engine. For each image, a Label describes what information to extract. Format as a structured table.

OUTPUT FORMAT (return ONLY valid JSON):
{
  "results": [
    {
      "label": "...",
      "table": {
        "headings": ["col1", "col2", ...],
        "rows": [["val1", "val2", ...], ["val3", "val4", ...]]
      }
    }
  ]
}

LABEL INTERPRETATION:
- Questions list (e.g., "date, sender, amount"): headings=["Question / Field", "Answer / Value"], rows=[["date", "..."], ["sender", "..."], ["amount", "..."]]
- Table request (e.g., "table of products"): extract columns/rows exactly as in image
- Single question: 1-row table with ["Question / Field", "Answer / Value"]
- General description (e.g., "key dates"): extract all matching items into structured table

EXTRACTION RULES:
1. TEXT FIDELITY: Copy EXACTLY as visible. Preserve capitalization, punctuation, dates, numbers, symbols, currency, units. NO summarizing, paraphrasing, external knowledge.
2. NO HALLUCINATION: Missing info → empty string "". Never invent.
3. RTL SUPPORT: Output Arabic/Hebrew/RTL scripts in correct reading direction (RTL). Do NOT reverse characters.
4. TABLE STRUCTURE: Preserve row/col order, count. Every row = same entries as columns. Multi-line cells: "Line 1\\nLine 2". Empty cells: "". Merged cells: text in first, "" in spanned.
5. BOUNDARY RULE: Only extract fully visible content. Partially visible → extract visible portion only.
6. UNCLEAR: Best literal reading. Unreadable → "".
7. EMPTY TABLE: "headings": [], "rows": []

The images correspond to these user Labels in order:
{labels_list}
"""


class AIExtractorError(Exception):
    """Raised when AI extraction fails at any stage."""
    pass


class AIExtractorService:
    """Service for extracting labeled text values from PDF regions via Gemini Vision."""

    def __init__(self):
        """Configure Vertex AI client from application settings."""
        project_id = settings.gcp_project_id
        if not project_id:
            raise AIExtractorError(
                "Google Cloud project ID is not configured. "
                "Set the GCP_PROJECT_ID environment variable in docker-compose.yml."
            )
        self.client = genai.Client(
            vertexai=True,
            project=project_id,
            location=settings.gcp_location,
            http_options=genai_types.HttpOptions(timeout=60 * 1000),
        )
        self.model_name = settings.gemini_model
        # Image preprocessing configuration
        self.preprocessing_config = PreprocessingConfig(
            mode=PreprocessingMode.STANDARD,
            target_dpi=300,
            max_dimension=2048,
            deskew=True,
            denoise=True,
            enhance_contrast=True,
            sharpen=True,
            binarize=False,
        )

    def _get_contents(self, region_images: list[bytes], prompt: str) -> list:
        """
        Build the contents list for a Vertex AI generate_content call.

        Region images are sent as inline Parts followed by the text prompt.
        Each image is a cropped annotation region.

        Args:
            region_images: List of PNG bytes, one per annotation.
            prompt: Formatted prompt string.

        Returns:
            List of Parts and strings suitable for generate_content contents.
        """
        parts: list = []
        for img in region_images:
            parts.append(genai_types.Part.from_bytes(
                data=img,
                mime_type="image/png",
            ))
        parts.append(prompt)
        return parts

    def extract(
        self,
        pdf_bytes: bytes,
        annotations: list[dict],
        logger: "ExtractionLogger | None" = None,
    ) -> list[dict]:
        """
        Run the full extraction pipeline.

        Crops each annotated region from the PDF, sends the cropped
        images to Gemini, then parses and merges the results.

        Args:
            pdf_bytes: Raw PDF file bytes.
            annotations: List of annotation dicts with keys:
                id, page_number, label, points ([[x1,y1],[x2,y2]]).
            logger: Optional ExtractionLogger instance for audit trail.

        Returns:
            List of {label, value, annotation_id} dicts with duplicate
            labels merged. The annotation_id is from the first occurrence.

        Raises:
            AIExtractorError: If any stage fails.
        """
        annotations = [a for a in annotations if a.get("label")]

        if logger:
            logger.log("START_EXTRACTION", "extraction", {
                "annotation_count": len(annotations),
            })

        if not annotations:
            if logger:
                logger.log("SKIP_EXTRACTION", "extraction", {
                    "reason": "no annotations with labels",
                })
            return []

        fitz_type = mime_to_fitz_filetype(detect_mime_type(pdf_bytes))
        doc = fitz.open(stream=pdf_bytes, filetype=fitz_type)
        try:
            region_images = self._crop_region_images(doc, annotations, logger)

            # Apply image preprocessing for better extraction accuracy
            processed_images = []
            for img_bytes in region_images:
                processed = preprocess_image(img_bytes, self.preprocessing_config)
                processed_images.append(processed)

            prompt = self._build_region_prompt(annotations, logger)
            contents = self._get_contents(processed_images, prompt)

            # Use validation retry for robust parsing
            parsed = self._call_gemini_with_validation(
                contents, logger,
                parser_func=self._parse_response,
                system_instruction=None,
                validation_retries=2,
            )
            merged = self._merge_duplicates(parsed, logger)

            # Map label -> first annotation_id for deduped results
            label_to_ann_id: dict[str, str] = {}
            for ann in annotations:
                label = ann.get("label") or "Region"
                if label not in label_to_ann_id:
                    label_to_ann_id[label] = ann["id"]

            for item in merged:
                item["annotation_id"] = label_to_ann_id.get(item["label"])

            return merged
        finally:
            doc.close()

    def _crop_region_images(
        self,
        doc: fitz.Document,
        annotations: list[dict],
        logger,
    ) -> list[bytes]:
        """
        Crop each annotated region from its PDF page at 300 DPI.

        Each annotation's region is rendered as an individual PNG image.
        This ensures Gemini can only see the exact region content, not
        surrounding text on the same page.

        Args:
            doc: Open fitz.Document.
            annotations: List of annotation dicts.
            logger: ExtractionLogger instance.

        Returns:
            List of PNG bytes, one per annotation (same order as input).
        """
        dpi = 300
        region_images: list[bytes] = []
        region_metadata = []

        for ann in annotations:
            page = doc[ann["page_number"] - 1]
            page_rect = page.rect
            pts = ann["points"]
            x0 = pts[0][0] * page_rect.width
            y0 = pts[0][1] * page_rect.height
            x1 = pts[1][0] * page_rect.width
            y1 = pts[1][1] * page_rect.height
            clip = fitz.Rect(x0, y0, x1, y1)
            pix = page.get_pixmap(dpi=dpi, clip=clip)
            png_bytes = pix.tobytes("png")
            region_images.append(png_bytes)
            region_metadata.append({
                "label": ann.get("label"),
                "width_px": pix.width,
                "height_px": pix.height,
                "image_size_bytes": len(png_bytes),
            })

        if logger:
            logger.log("REGIONS_CROPPED", "extraction", {
                "dpi": dpi,
                "count": len(region_images),
                "regions": region_metadata,
                "total_size_kb": round(sum(m["image_size_bytes"] for m in region_metadata) / 1024, 1),
            })

        return region_images

    def _build_region_prompt(
        self,
        annotations: list[dict],
        logger,
    ) -> str:
        """
        Build the Gemini prompt for cropped region images.

        Lists the labels in image order so Gemini can map each cropped
        image back to its label.

        Args:
            annotations: List of annotation dicts.
            logger: ExtractionLogger instance.

        Returns:
            Formatted prompt string.
        """
        labels_list = "\n".join(
            f'{i+1}. Label: "{ann["label"]}"'
            for i, ann in enumerate(annotations)
        )
        prompt = PROMPT_TEMPLATE.replace("{labels_list}", labels_list)

        if logger:
            logger.log("GEMINI_PROMPT", "gemini", {
                "model": self.model_name,
                "prompt_length_chars": len(prompt),
                "region_count": len(annotations),
                "estimated_tokens": round(len(prompt) / 4) + sum(258 for _ in annotations),
                "labels": [a["label"] for a in annotations],
            })

        return prompt

    def _parse_retry_delay(self, error_message: str) -> float | None:
        """
        Extract retry_delay from a Gemini ResourceExhausted error message.

        Tries two formats in order:
          1. "Please retry in Xs" (human-readable)
          2. "retry_delay { seconds: X }" (protobuf text format)

        Args:
            error_message: The string representation of the error.

        Returns:
            Delay in seconds, or None if neither format matched.
        """
        for pattern in [
            r"retry in ([\d.]+)s",
            r"retry_delay\s*\{\s*seconds:\s*(\d+)",
        ]:
            match = re.search(pattern, error_message, re.IGNORECASE)
            if match:
                return max(5.0, min(60.0, float(match.group(1))))
        return None

    def _call_gemini(
        self,
        contents: list,
        logger,
        system_instruction: str | None = None,
        model_name: str | None = None,
        fallback_model: str | None = None,
        max_retries: int = 3,
    ) -> str:
        """
        Send contents (cropped region images + prompt) to Gemini.

        Args:
            contents: List of Parts and strings prepared by _get_contents.
            logger: ExtractionLogger instance.
            system_instruction: Optional system instruction for the model.
            model_name: Optional model override (defaults to self.model_name).
            fallback_model: Optional fallback model if primary hits rate limits.
            max_retries: Number of retry attempts before fallback/error.

        Returns:
            Raw response text from Gemini.

        Raises:
            AIExtractorError: On API failure, timeout, or empty response.
        """
        def _do_call(model: str) -> str:
            config_kwargs = dict(
                temperature=0.0 if system_instruction else 0.1,
                max_output_tokens=8192,
            )
            if system_instruction:
                config_kwargs["system_instruction"] = system_instruction
            response = self.client.models.generate_content(
                model=model,
                contents=contents,
                config=genai_types.GenerateContentConfig(**config_kwargs),
            )
            raw = response.text
            if not raw or not raw.strip():
                raise AIExtractorError("Gemini returned an empty response")
            return raw

        active_model = model_name or self.model_name
        start = time.monotonic()

        for attempt in range(max_retries):
            try:
                raw = _do_call(active_model)
                duration_ms = round((time.monotonic() - start) * 1000)
                if logger:
                    logger.log("GEMINI_RESPONSE_RAW", "gemini", {
                        "model": active_model,
                        "duration_ms": duration_ms,
                        "raw_response": raw,
                    })
                return raw

            except genai_errors.ClientError as e:
                is_rate_limit = e.code == 429 or "rate" in str(e).lower() or "quota" in str(e).lower()
                if not is_rate_limit:
                    raise AIExtractorError(f"Vertex AI request failed: {e}")
                if attempt < max_retries - 1:
                    sleep = self._get_retry_delay(str(e), attempt)
                    if logger:
                        logger.log("GEMINI_RETRY", "gemini", {
                            "attempt": attempt + 1,
                            "model": active_model,
                            "max_retries": max_retries,
                            "sleep_seconds": sleep,
                            "error": str(e)[:200],
                        })
                    time.sleep(sleep)
                    continue

                # All retries exhausted — try fallback model if available
                if fallback_model and fallback_model != active_model:
                    if logger:
                        logger.log("GEMINI_FALLBACK", "gemini", {
                            "from_model": active_model,
                            "to_model": fallback_model,
                            "error": str(e)[:200],
                        })
                    try:
                        raw = _do_call(fallback_model)
                        duration_ms = round((time.monotonic() - start) * 1000)
                        if logger:
                            logger.log("GEMINI_RESPONSE_RAW", "gemini", {
                                "model": fallback_model,
                                "duration_ms": duration_ms,
                                "raw_response": raw,
                            })
                        return raw
                    except Exception as fallback_e:
                        raise AIExtractorError(
                            f"Primary model {active_model} quota exceeded, "
                            f"fallback {fallback_model} also failed: {fallback_e}"
                        )

                raise AIExtractorError(
                    f"Vertex AI request failed after {max_retries} retries: {e}"
                )

            except genai_errors.APIError as e:
                raise AIExtractorError(f"Vertex AI API error: {e}")

        raise AIExtractorError(
            "Gemini API quota exceeded via Vertex AI. "
            "Please check your project's quota limits at "
            "https://console.cloud.google.com/apis/api/"
            "aiplatform.googleapis.com/quotas"
        )

    def _call_gemini_with_validation(
        self,
        contents: list,
        logger,
        parser_func,
        system_instruction: str | None = None,
        model_name: str | None = None,
        fallback_model: str | None = None,
        max_retries: int = 3,
        validation_retries: int = 2,
    ):
        """
        Call Gemini with response validation and retry on validation failure.

        Args:
            contents: List of Parts and strings for the request.
            logger: ExtractionLogger instance.
            parser_func: Function to parse/validate the response.
            system_instruction: Optional system instruction.
            model_name: Optional model override.
            fallback_model: Optional fallback model.
            max_retries: API retry attempts.
            validation_retries: Number of retries on validation failure.

        Returns:
            Parsed and validated result.

        Raises:
            AIExtractorError: On API failure or repeated validation failure.
        """
        last_error = None
        
        for validation_attempt in range(validation_retries + 1):
            raw = self._call_gemini(
                contents, logger,
                system_instruction=system_instruction,
                model_name=model_name,
                fallback_model=fallback_model,
                max_retries=max_retries,
            )
            
            try:
                result = parser_func(raw, logger)
                if logger and validation_attempt > 0:
                    logger.log("VALIDATION_RETRY_SUCCESS", "parse", {
                        "attempt": validation_attempt,
                    })
                return result
            except AIExtractorError as e:
                last_error = e
                if validation_attempt < validation_retries:
                    if logger:
                        logger.log("VALIDATION_RETRY", "parse", {
                            "attempt": validation_attempt + 1,
                            "max_retries": validation_retries,
                            "error": str(e)[:200],
                        })
                    # Add correction hint to prompt for next attempt
                    if system_instruction:
                        system_instruction += f"\n\n[CORRECTION] Previous response failed validation: {e}. Ensure output is valid JSON matching the exact schema."
                    continue
                else:
                    break
        
        raise AIExtractorError(
            f"Validation failed after {validation_retries + 1} attempts: {last_error}"
        )

    def _get_retry_delay(self, error_message: str, attempt: int) -> float:
        """
        Determine retry delay from error message or fallback schedule.

        Args:
            error_message: The string representation of the error.
            attempt: Zero-based attempt number (0, 1, 2).

        Returns:
            Delay in seconds.
        """
        fallback_delays = [5, 10, 20]
        parsed = self._parse_retry_delay(error_message)
        return parsed if parsed is not None else fallback_delays[attempt]

    def _parse_response(self, raw: str, logger) -> list[dict]:
        """
        Parse Gemini response text into a list of {label, value} dicts.

        Handles markdown fences, trailing text, and partial JSON.
        Uses structured validation via Pydantic models.

        Args:
            raw: Raw response text from Gemini.
            logger: ExtractionLogger instance.

        Returns:
            List of {label, value} dicts.

        Raises:
            AIExtractorError: If no valid JSON could be extracted.
        """
        text = raw.strip()

        # Strip markdown code fences if present
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

        json_str = self._extract_first_json(text)

        try:
            parsed = json.loads(json_str)
        except json.JSONDecodeError as e:
            raise AIExtractorError(
                f"Failed to parse Gemini response as JSON: {e}. Raw: {raw[:500]}"
            )

        # Normalize: handle legacy 'items' key
        if "results" not in parsed and "items" in parsed:
            parsed["results"] = parsed["items"]

        # Use structured validation
        try:
            validated = AIResponseValidator.validate_extraction(parsed)
            items = [{"label": item.label, "value": item.value} for item in validated.results]
        except Exception:
            # Fallback to manual parsing if validation fails
            results = parsed.get("results", [])
            if not isinstance(results, list):
                raise AIExtractorError(
                    f"Gemini response missing 'results' array. Parsed keys: {list(parsed.keys())}"
                )

            items = []
            for item in results:
                if isinstance(item, dict) and "label" in item and "value" in item:
                    items.append({"label": str(item["label"]), "value": str(item["value"])})

        if not items:
            raise AIExtractorError(
                "Gemini returned an empty results array or no valid label-value pairs"
            )

        if logger:
            logger.log("GEMINI_RESPONSE_PARSED", "parse", {
                "results": items,
            })

        return items

    def _parse_table_response(self, raw: str, logger) -> dict:
        """
        Parse Gemini response into a table JSON object.

        Args:
            raw: Raw response text from Gemini.
            logger: ExtractionLogger instance.

        Returns:
            Dict with {"headings": [...], "rows": [[...], ...]}.

        Raises:
            AIExtractorError: If parsing fails or structure is invalid.
        """
        text = raw.strip()
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

        json_str = self._extract_first_json(text)

        try:
            parsed = json.loads(json_str)
        except json.JSONDecodeError as e:
            raise AIExtractorError(
                f"Failed to parse table response as JSON: {e}. Raw: {raw[:500]}"
            )

        # Use structured validation
        try:
            table_data = AIResponseValidator.validate_table(parsed)
            result = table_data.to_simple_format()
        except Exception:
            # Fallback to manual parsing
            table = parsed.get("table", parsed)
            if not isinstance(table, dict):
                raise AIExtractorError(
                    f"Table response missing 'table' object. Parsed: {parsed}"
                )

            headings = table.get("headings", [])
            rows = table.get("rows", [])

            if not isinstance(headings, list) or not isinstance(rows, list):
                raise AIExtractorError(
                    f"Table response has invalid headings/rows types. Got: {type(headings)}/{type(rows)}"
                )

            result = {"headings": headings, "rows": rows}

        if logger:
            logger.log("TABLE_RESPONSE_PARSED", "parse", {
                "column_count": len(result.get("headings", [])),
                "row_count": len(result.get("rows", [])),
                "table": result,
            })

        return result

    def _build_batch_table_prompt(
        self,
        annotations: list[dict],
        logger,
    ) -> str:
        """
        Build a batched Gemini prompt for multiple table region images.

        Args:
            annotations: List of annotation dicts.
            logger: ExtractionLogger instance.

        Returns:
            Formatted prompt string.
        """
        labels_list = "\n".join(
            f'{i+1}. Label: "{ann["label"]}"'
            for i, ann in enumerate(annotations)
        )
        prompt = TABLE_BATCH_PROMPT_TEMPLATE.replace("{labels_list}", labels_list)

        if logger:
            logger.log("GEMINI_SYSTEM_INSTRUCTION", "gemini", {
                "model": "gemini-2.5-flash",
                "prompt_length_chars": len(prompt),
                "region_count": len(annotations),
                "estimated_tokens": round(len(prompt) / 4) + sum(258 for _ in annotations),
                "labels": [a["label"] for a in annotations],
            })

        return prompt

    def _build_query_table_prompt(
        self,
        annotations: list[dict],
        logger,
    ) -> str:
        """
        Build a batched Gemini prompt for multiple query-driven table region images.

        Args:
            annotations: List of annotation dicts.
            logger: ExtractionLogger instance.

        Returns:
            Formatted prompt string.
        """
        labels_list = "\n".join(
            f'{i+1}. Label/Query: "{ann["label"]}"'
            for i, ann in enumerate(annotations)
        )
        prompt = QUERY_TABLE_BATCH_PROMPT_TEMPLATE.replace("{labels_list}", labels_list)

        if logger:
            logger.log("GEMINI_SYSTEM_INSTRUCTION", "gemini", {
                "model": self.model_name,
                "prompt_length_chars": len(prompt),
                "region_count": len(annotations),
                "estimated_tokens": round(len(prompt) / 4) + sum(258 for _ in annotations),
                "labels": [a["label"] for a in annotations],
            })

        return prompt

    def _extract_first_json(self, text: str) -> str:
        """
        Extract the first complete, balanced JSON object from text.

        Uses brace-depth AND bracket-depth counting to handle nested
        structures and ignores any trailing content after the JSON
        (e.g., stray text Gemini adds after the code block).

        Gemini sometimes returns an extra, unmatched closing brace
        before the final brackets, e.g.  ...}}  ]}  instead of
        ...}} ]}.  This function detects and skips such extra
        braces by requiring both brace and bracket depth to reach
        zero before returning.

        Args:
            text: Input string possibly containing a JSON object.

        Returns:
            The first complete JSON object string.

        Raises:
            AIExtractorError: If no balanced JSON object is found.
        """
        start = text.find("{")
        if start == -1:
            raise AIExtractorError("No JSON object found in response")
        brace_depth = 0
        bracket_depth = 0
        in_string = False
        escape = False
        result = []
        for i in range(start, len(text)):
            ch = text[i]
            if escape:
                escape = False
                result.append(ch)
                continue
            if ch == "\\" and in_string:
                escape = True
                result.append(ch)
                continue
            if ch == '"':
                in_string = not in_string
                result.append(ch)
                continue
            if in_string:
                result.append(ch)
                continue
            if ch == "{":
                brace_depth += 1
            elif ch == "}":
                # If this } would close the root object while brackets
                # are still open, it's an extra unmatched brace -- skip it.
                if brace_depth == 1 and bracket_depth > 0:
                    continue
                brace_depth -= 1
            elif ch == "[":
                bracket_depth += 1
            elif ch == "]":
                bracket_depth -= 1

            result.append(ch)

            if brace_depth == 0 and bracket_depth == 0:
                return "".join(result)
        raise AIExtractorError("No balanced JSON object found in response")

    def _parse_batch_table_response(self, raw: str, logger) -> dict[str, dict]:
        """
        Parse Gemini response into a label-to-table mapping.

        Returns a dict like {"label_1": {"headings": [...], "rows": [[...], ...]}}.

        Args:
            raw: Raw response text from Gemini.
            logger: ExtractionLogger instance.

        Returns:
            Dict mapping labels to table JSON.

        Raises:
            AIExtractorError: If parsing fails.
        """
        text = raw.strip()
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

        json_str = self._extract_first_json(text)

        try:
            parsed = json.loads(json_str)
        except json.JSONDecodeError as e:
            raise AIExtractorError(
                f"Failed to parse batch table response as JSON: {e}. Raw: {raw[:500]}"
            )

        # Use structured validation
        try:
            validated = AIResponseValidator.validate_batch_table(parsed)
            label_to_table: dict[str, dict] = {}
            for item in validated.results:
                label = item.label
                table_data = item.table.to_simple_format()
                label_to_table[label] = table_data

                if logger:
                    logger.log("TABLE_RESPONSE_PARSED", "parse", {
                        "label": label,
                        "column_count": len(table_data.get("headings", [])),
                        "row_count": len(table_data.get("rows", [])),
                        "table": table_data,
                    })
        except Exception:
            # Fallback to manual parsing
            results = parsed.get("results", [])
            if not isinstance(results, list):
                raise AIExtractorError(
                    f"Batch table response missing 'results' array. Parsed keys: {list(parsed.keys())}"
                )

            label_to_table = {}
            for item in results:
                if not isinstance(item, dict):
                    continue
                label = item.get("label", "")
                table = item.get("table", {})
                if isinstance(table, dict):
                    headings = table.get("headings", [])
                    rows = table.get("rows", [])
                    if isinstance(headings, list) and isinstance(rows, list):
                        label_to_table[label] = {"headings": headings, "rows": rows}

                if logger:
                    logger.log("TABLE_RESPONSE_PARSED", "parse", {
                        "label": label,
                        "column_count": len(label_to_table.get(label, {}).get("headings", [])),
                        "row_count": len(label_to_table.get(label, {}).get("rows", [])),
                        "table": label_to_table.get(label, {}),
                    })

        return label_to_table

    def extract_tables(
        self,
        pdf_bytes: bytes,
        annotations: list[dict],
        logger: "ExtractionLogger | None" = None,
    ) -> list[dict]:
        """
        Extract table structures from annotated regions via Gemini.

        All annotated regions are cropped and sent to Gemini in a single
        batched call, with a prompt that lists the label for each image.
        Results are mapped back to annotation IDs by label.

        Args:
            pdf_bytes: Raw PDF file bytes.
            annotations: List of annotation dicts with id, page_number,
                label, points.
            logger: Optional ExtractionLogger instance.

        Returns:
            List of {label, table_json, annotation_id} dicts.

        Raises:
            AIExtractorError: If any stage fails.
        """
        annotations = [a for a in annotations if a.get("label")]

        if logger:
            logger.log("START_TABLE_EXTRACTION", "extraction", {
                "annotation_count": len(annotations),
            })

        if not annotations:
            return []

        fitz_type = mime_to_fitz_filetype(detect_mime_type(pdf_bytes))
        doc = fitz.open(stream=pdf_bytes, filetype=fitz_type)
        try:
            # Crop all table regions
            region_images = self._crop_region_images(doc, annotations, logger)

            # Apply image preprocessing for better extraction accuracy
            processed_images = []
            for img_bytes in region_images:
                processed = preprocess_image(img_bytes, self.preprocessing_config)
                processed_images.append(processed)

            # Build system instruction (detailed extraction rules)
            system_prompt = self._build_batch_table_prompt(annotations, logger)

            # Build contents with images + minimal user message
            contents = self._get_contents(processed_images, "Extract tables from these images.")

            # Single Gemini call for all table regions with validation retry
            label_to_table = self._call_gemini_with_validation(
                contents, logger,
                parser_func=self._parse_batch_table_response,
                system_instruction=system_prompt,
                validation_retries=2,
            )

            # Map back to annotation IDs
            results = []
            for ann in annotations:
                label = ann["label"]
                table_data = label_to_table.get(label, {"headings": [], "rows": []})
                results.append({
                    "label": label,
                    "table_json": table_data,
                    "annotation_id": ann["id"],
                })

            if logger:
                logger.log("TABLE_EXTRACTION_COMPLETE", "extraction", {
                    "item_count": len(results),
                    "items": results,
                })

            return results
        finally:
            doc.close()

    def extract_query_tables(
        self,
        pdf_bytes: bytes,
        annotations: list[dict],
        logger: "ExtractionLogger | None" = None,
    ) -> list[dict]:
        """
        Extract query-driven table structures from annotated regions via Gemini.

        All annotated regions are cropped and sent to Gemini in a single
        batched call, with a prompt that lists the description/query for each image.
        Results are mapped back to annotation IDs by label.

        Args:
            pdf_bytes: Raw PDF file bytes.
            annotations: List of annotation dicts with id, page_number,
                label, points.
            logger: Optional ExtractionLogger instance.

        Returns:
            List of {label, table_json, annotation_id, annotation_type} dicts.

        Raises:
            AIExtractorError: If any stage fails.
        """
        annotations = [a for a in annotations if a.get("label")]

        if logger:
            logger.log("START_QUERY_TABLE_EXTRACTION", "extraction", {
                "annotation_count": len(annotations),
            })

        if not annotations:
            return []

        fitz_type = mime_to_fitz_filetype(detect_mime_type(pdf_bytes))
        doc = fitz.open(stream=pdf_bytes, filetype=fitz_type)
        try:
            # Crop all table regions
            region_images = self._crop_region_images(doc, annotations, logger)

            # Apply image preprocessing for better extraction accuracy
            processed_images = []
            for img_bytes in region_images:
                processed = preprocess_image(img_bytes, self.preprocessing_config)
                processed_images.append(processed)

            # Build system instruction (detailed extraction rules)
            system_prompt = self._build_query_table_prompt(annotations, logger)

            # Build contents with images + minimal user message
            contents = self._get_contents(processed_images, "Extract and format the requested details from these images as tables.")

            # Single Gemini call for all table regions with validation retry
            label_to_table = self._call_gemini_with_validation(
                contents, logger,
                parser_func=self._parse_batch_table_response,
                system_instruction=system_prompt,
                validation_retries=2,
            )

            # Map back to annotation IDs
            results = []
            for ann in annotations:
                label = ann["label"]
                table_data = label_to_table.get(label, {"headings": [], "rows": []})
                results.append({
                    "label": label,
                    "table_json": table_data,
                    "annotation_id": ann["id"],
                    "annotation_type": ann.get("annotation_type", "table"),
                })

            if logger:
                logger.log("QUERY_TABLE_EXTRACTION_COMPLETE", "extraction", {
                    "item_count": len(results),
                    "items": results,
                })

            return results
        finally:
            doc.close()

    def _merge_duplicates(self, items: list[dict], logger) -> list[dict]:
        """
        Merge duplicate labels by joining values with ', '.

        Args:
            items: List of {label, value} dicts (may contain duplicate labels).
            logger: ExtractionLogger instance.

        Returns:
            List of {label, value} dicts with unique labels.
        """
        merged = OrderedDict()
        for item in items:
            label = item["label"]
            value = item["value"]
            if label in merged:
                merged[label] = f'{merged[label]}, {value}'
            else:
                merged[label] = value

        merged_before = len(items)
        merged_after = len(merged)
        merged_labels = []
        for label, value in merged.items():
            original_count = sum(1 for it in items if it["label"] == label)
            if original_count > 1:
                merged_labels.append({
                    "label": label,
                    "count": original_count,
                    "merged_value": value,
                })

        final_items = [{"label": k, "value": v} for k, v in merged.items()]

        if logger:
            logger.log("DUPLICATES_MERGED", "parse", {
                "before_count": merged_before,
                "after_count": merged_after,
                "merged_labels": merged_labels,
            })

        return final_items
