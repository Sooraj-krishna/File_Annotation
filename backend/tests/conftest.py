"""Shared fixtures for backend tests."""

import fitz
import pytest


def _generate_test_pdf() -> bytes:
    """Generate a 3-page PDF with 3 labeled text regions per page.

    Each page has 3 non-overlapping rectangular regions (top, middle,
    bottom) containing unique text.  This lets us validate that the
    cropped-region extractor reads each region independently.
    """
    doc = fitz.open()

    page_texts = [
        ("Invoice #INV-1001", "2024-03-15", "$1,250.00"),
        ("Client: Acme Corp", "PO-2024-0891", "Net-30 Terms"),
        ("Widget X (qty 10)", "Gadget Y (qty 5)", "Shipping $50"),
    ]

    for letter, (t1, t2, t3) in zip(("A", "B", "C"), page_texts):
        page = doc.new_page(width=612, height=792)
        page.insert_text((100, 160), t1, fontsize=14, fontname="helv")
        page.insert_text((100, 360), t2, fontsize=14, fontname="helv")
        page.insert_text((100, 560), t3, fontsize=14, fontname="helv")

    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


@pytest.fixture(scope="session")
def test_pdf_bytes() -> bytes:
    """Bytes of a 3-page test PDF with 3 labelled regions per page."""
    return _generate_test_pdf()


@pytest.fixture(scope="session")
def grid_annotations() -> list[dict]:
    """9 annotations (3/page × 3 pages) in a 3×3 grid layout.

    Normalized coordinates cover the three vertical strips used in
    the test PDF: top (x=0.05..0.55, y=0.10..0.28), middle
    (x=0.05..0.55, y=0.30..0.50), bottom (x=0.05..0.55, y=0.52..0.72).
    """
    labels_map = [
        "invoice_number", "date", "amount",
        "client_name", "po_number", "terms",
        "item_1", "item_2", "shipping",
    ]

    y_strips = [
        ([0.05, 0.10], [0.55, 0.28]),
        ([0.05, 0.30], [0.55, 0.50]),
        ([0.05, 0.52], [0.55, 0.72]),
    ]

    annotations = []
    for page_idx in range(3):
        for strip_idx, (top_left, bottom_right) in enumerate(y_strips):
            ann_idx = page_idx * 3 + strip_idx
            annotations.append({
                "id": f"ann_{ann_idx}",
                "page_number": page_idx + 1,
                "label": labels_map[ann_idx],
                "points": [top_left, bottom_right],
            })

    return annotations
