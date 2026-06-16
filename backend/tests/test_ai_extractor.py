"""Tests for AIExtractorService — cropping, prompt building, parsing,
merging, and the full pipeline with a mocked Gemini."""

import pytest
from unittest.mock import patch

from app.services.ai_extractor import AIExtractorError, AIExtractorService


# ── Helpers ──────────────────────────────────────────────────────────


def make_service():
    """Return an AIExtractorService with a monkey-patched GCP project
    so it doesn't fail __init__ validation."""
    from app.core.config import settings

    # Ensure config has a project id so the service can be constructed.
    # We patch just enough to survive __init__ — actual API calls are
    # mocked at the method level.
    try:
        return AIExtractorService()
    except AIExtractorError:
        # If no real GCP config, give it a dummy one
        original = settings.gcp_project_id
        settings.gcp_project_id = "dummy-project"
        try:
            return AIExtractorService()
        finally:
            settings.gcp_project_id = original


# ── _crop_region_images ──────────────────────────────────────────────


class TestCropRegionImages:
    """Cropping each annotation region should return 9 independent PNGs."""

    def test_returns_correct_count(self, test_pdf_bytes, grid_annotations):
        doc = None
        try:
            import fitz
            doc = fitz.open(stream=test_pdf_bytes, filetype="pdf")
            svc = make_service()
            images = svc._crop_region_images(doc, grid_annotations, logger=None)
            assert len(images) == 9
            for i, img in enumerate(images):
                assert isinstance(img, bytes)
                assert len(img) > 100, f"Region {i} produced an empty image"
        finally:
            if doc:
                doc.close()

    def test_each_image_is_unique(self, test_pdf_bytes, grid_annotations):
        """Each cropped region should differ because the text differs."""
        import fitz
        doc = fitz.open(stream=test_pdf_bytes, filetype="pdf")
        try:
            svc = make_service()
            images = svc._crop_region_images(doc, grid_annotations, logger=None)
            unique = {hash(img) for img in images}
            assert len(unique) == 9, "Expected all 9 cropped regions to be unique"
        finally:
            doc.close()

    def test_crop_respects_region_boundaries(self, test_pdf_bytes, grid_annotations):
        """A tiny region on the last page should crop to a small image."""
        import fitz
        doc = fitz.open(stream=test_pdf_bytes, filetype="pdf")
        try:
            tiny_ann = [{
                "id": "tiny",
                "page_number": 1,
                "label": "tiny_region",
                "points": [[0.45, 0.45], [0.55, 0.55]],
            }]
            svc = make_service()
            images = svc._crop_region_images(doc, tiny_ann, logger=None)
            assert len(images) == 1
            assert len(images[0]) > 50
        finally:
            doc.close()

    def test_crop_no_annotations(self, test_pdf_bytes):
        """Empty annotation list should return an empty list."""
        import fitz
        doc = fitz.open(stream=test_pdf_bytes, filetype="pdf")
        try:
            svc = make_service()
            images = svc._crop_region_images(doc, [], logger=None)
            assert images == []
        finally:
            doc.close()


# ── _build_region_prompt ─────────────────────────────────────────────


class TestBuildRegionPrompt:
    """Prompt should list labels in annotation order."""

    def test_lists_all_labels_in_order(self, grid_annotations):
        svc = make_service()
        prompt = svc._build_region_prompt(grid_annotations, logger=None)
        for i, ann in enumerate(grid_annotations):
            assert ann["label"] in prompt, f"Label {ann['label']} missing from prompt"
            # The label for entry i+1 should appear before later labels
            pos = prompt.index(ann["label"])
            if i > 0:
                prev_pos = prompt.index(grid_annotations[i - 1]["label"])
                assert pos > prev_pos, (
                    f"Label {ann['label']} appears out of order"
                )

    def test_empty_annotations(self):
        svc = make_service()
        prompt = svc._build_region_prompt([], logger=None)
        assert 'Labels list will be empty' in prompt or '{labels_list}' not in prompt


# ── _get_contents ────────────────────────────────────────────────────


class TestGetContents:
    """Contents list should have correct Part types and prompt string."""

    def test_contents_structure(self, test_pdf_bytes, grid_annotations):
        import fitz
        doc = fitz.open(stream=test_pdf_bytes, filetype="pdf")
        try:
            svc = make_service()
            images = svc._crop_region_images(doc, grid_annotations, logger=None)
            prompt = svc._build_region_prompt(grid_annotations, logger=None)
            contents = svc._get_contents(images, prompt)

            # 9 image Parts + 1 trailing prompt string
            assert len(contents) == 10
            from google.genai import types as genai_types
            for i in range(9):
                assert isinstance(contents[i], genai_types.Part)
            assert isinstance(contents[-1], str)
        finally:
            doc.close()


# ── _parse_response ──────────────────────────────────────────────────


class TestParseResponse:
    """Parse various Gemini output formats safely."""

    def test_clean_json(self):
        svc = make_service()
        raw = '{"results": [{"label": "date", "value": "2024-03-15"}]}'
        items = svc._parse_response(raw, logger=None)
        assert items == [{"label": "date", "value": "2024-03-15"}]

    def test_with_markdown_fence(self):
        svc = make_service()
        raw = '```json\n{"results": [{"label": "amount", "value": "1250"}]}\n```'
        items = svc._parse_response(raw, logger=None)
        assert items == [{"label": "amount", "value": "1250"}]

    def test_extra_text_after_json(self):
        svc = make_service()
        raw = '{"results": [{"label": "x", "value": "y"}]} Extra text here'
        items = svc._parse_response(raw, logger=None)
        assert items == [{"label": "x", "value": "y"}]

    def test_alternate_items_key(self):
        svc = make_service()
        raw = '{"items": [{"label": "a", "value": "b"}]}'
        items = svc._parse_response(raw, logger=None)
        assert items == [{"label": "a", "value": "b"}]

    def test_no_json_raises(self):
        svc = make_service()
        with pytest.raises(AIExtractorError, match="No JSON object"):
            svc._parse_response("Just some text", logger=None)

    def test_empty_results_raises(self):
        svc = make_service()
        with pytest.raises(AIExtractorError, match="empty results"):
            svc._parse_response('{"results": []}', logger=None)

    def test_missing_results_field(self):
        svc = make_service()
        with pytest.raises(AIExtractorError, match="results"):
            svc._parse_response('{"data": []}', logger=None)


# ── _merge_duplicates ────────────────────────────────────────────────


class TestMergeDuplicates:
    """Duplicate labels should be joined with ', '."""

    def test_no_duplicates(self):
        svc = make_service()
        items = [
            {"label": "a", "value": "1"},
            {"label": "b", "value": "2"},
        ]
        merged = svc._merge_duplicates(items, logger=None)
        assert merged == items

    def test_merges_duplicates(self):
        svc = make_service()
        items = [
            {"label": "a", "value": "1"},
            {"label": "a", "value": "2"},
            {"label": "b", "value": "3"},
        ]
        merged = svc._merge_duplicates(items, logger=None)
        assert len(merged) == 2
        assert merged[0] == {"label": "a", "value": "1, 2"}
        assert merged[1] == {"label": "b", "value": "3"}

    def test_three_way_merge(self):
        svc = make_service()
        items = [
            {"label": "x", "value": "a"},
            {"label": "x", "value": "b"},
            {"label": "x", "value": "c"},
        ]
        merged = svc._merge_duplicates(items, logger=None)
        assert len(merged) == 1
        assert merged[0] == {"label": "x", "value": "a, b, c"}


# ── Integration (pipeline with mocked Gemini) ────────────────────────


@pytest.mark.parametrize("gemini_response,expected", [
    (
        '{"results": [{"label": "invoice_number", "value": "INV-1001"}]}',
        [{"label": "invoice_number", "value": "INV-1001", "annotation_id": "ann_0"}],
    ),
    (
        '{"results": [{"label": "date", "value": "2024-03-15"}, {"label": "amount", "value": "1250"}]}',
        [
            {"label": "date", "value": "2024-03-15", "annotation_id": "ann_1"},
            {"label": "amount", "value": "1250", "annotation_id": "ann_2"},
        ],
    ),
])
def test_extract_pipeline_with_mock(
    test_pdf_bytes,
    grid_annotations,
    gemini_response,
    expected,
):
    """Full pipeline: crop → prompt → get_contents → (mock) call →
    parse → merge → return."""
    svc = make_service()
    with patch.object(svc, "_call_gemini", return_value=gemini_response):
        result = svc.extract(test_pdf_bytes, grid_annotations)

    for exp in expected:
        matching = [r for r in result if r["label"] == exp["label"]]
        assert matching, f"Label {exp['label']} not found in result"
        assert matching[0]["value"] == exp["value"]
        assert matching[0]["annotation_id"] == exp["annotation_id"]


def test_extract_empty_annotations(test_pdf_bytes):
    """Empty annotation list should return empty list."""
    svc = make_service()
    result = svc.extract(test_pdf_bytes, [])
    assert result == []


def test_extract_filters_blank_labels(test_pdf_bytes):
    """Annotations without a label should be filtered out."""
    svc = make_service()
    annotations = [
        {"id": "a", "page_number": 1, "label": "", "points": [[0, 0], [0.1, 0.1]]},
        {"id": "b", "page_number": 1, "label": "valid", "points": [[0, 0], [0.1, 0.1]]},
    ]
    with patch.object(
        svc, "_call_gemini",
        return_value='{"results": [{"label": "valid", "value": "x"}]}',
    ):
        result = svc.extract(test_pdf_bytes, annotations)
    assert len(result) == 1
    assert result[0]["label"] == "valid"


# ── Query-driven Table Extraction Tests ──────────────────────────────


class TestBuildQueryTablePrompt:
    """Prompt should list queries/descriptions in annotation order."""

    def test_lists_all_queries_in_order(self):
        svc = make_service()
        annotations = [
            {"id": "q1", "page_number": 1, "label": "query first", "points": [[0, 0], [0.1, 0.1]]},
            {"id": "q2", "page_number": 1, "label": "query second", "points": [[0.1, 0.1], [0.2, 0.2]]},
        ]
        prompt = svc._build_query_table_prompt(annotations, logger=None)
        assert "query first" in prompt
        assert "query second" in prompt
        assert prompt.index("query first") < prompt.index("query second")

    def test_empty_annotations(self):
        svc = make_service()
        prompt = svc._build_query_table_prompt([], logger=None)
        assert "json" in prompt.lower()
        assert "document" in prompt.lower()


def test_extract_query_tables_with_mock(test_pdf_bytes):
    """Full query-driven pipeline: crop → prompt → call → parse → return."""
    svc = make_service()
    annotations = [
        {"id": "q1", "page_number": 1, "label": "what is product?", "points": [[0, 0], [0.1, 0.1]]},
    ]
    mock_response = '{"results": [{"label": "what is product?", "table": {"headings": ["Product", "Price"], "rows": [["Apple", "$1"]]}}]}'
    with patch.object(svc, "_call_gemini", return_value=mock_response):
        result = svc.extract_query_tables(test_pdf_bytes, annotations)
    
    assert len(result) == 1
    assert result[0]["annotation_id"] == "q1"
    assert result[0]["table_json"] == {"headings": ["Product", "Price"], "rows": [["Apple", "$1"]]}

