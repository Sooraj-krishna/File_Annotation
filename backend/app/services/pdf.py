"""
PDF service — PDF manipulation using PyMuPDF (fitz).

Handles loading PDF documents, drawing annotated rectangles and labels
onto pages, and generating the final PDF bytes. This service is the
core of the "save" pipeline that produces the annotated PDF output.

Label placement uses a simple priority-based algorithm: top-right of
the rectangle bounding box, with clipping to page boundaries.
"""

import re
from pathlib import Path

import arabic_reshaper
from bidi.algorithm import get_display
import fitz

from app.core.file_utils import detect_mime_type, mime_to_fitz_filetype
from app.services.coordinate import CoordinateService

_FONT_PATH = str(Path(__file__).resolve().parent.parent / "fonts" / "NotoNaskhArabic-Regular.ttf")
ARABIC_FONT_NAME = "NotoNaskhArabic"
_ARABIC_FONT = fitz.Font(fontfile=_FONT_PATH)

_ARABIC_RE = re.compile(r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]")


def _has_arabic(text: str) -> bool:
    return bool(_ARABIC_RE.search(text))


def _prepare_text(text: str) -> str:
    if not text:
        return ""
    if _has_arabic(text):
        reshaped = arabic_reshaper.reshape(text)
        return get_display(reshaped)
    return text


class PDFService:
    """
    Static methods for PDF loading, annotation rendering, and generation.

    All operations use PyMuPDF (fitz) for reliable PDF manipulation.
    Methods are stateless — they accept a document or bytes and return
    a modified document or output bytes.
    """

    @staticmethod
    def load(file_path: str) -> fitz.Document:
        """
        Open a document from a file path.

        Detects file type from content bytes to support both PDF and images.

        Args:
            file_path: Absolute path to the file.

        Returns:
            An opened fitz.Document instance.
        """
        with open(file_path, "rb") as f:
            content = f.read()
        fitz_type = mime_to_fitz_filetype(detect_mime_type(content))
        return fitz.open(stream=content, filetype=fitz_type)

    @staticmethod
    def load_from_bytes(content: bytes) -> fitz.Document:
        """
        Open a document from raw bytes.

        Detects file type from content bytes to support both PDF and images.

        Args:
            content: Raw file bytes.

        Returns:
            An opened fitz.Document instance.
        """
        fitz_type = mime_to_fitz_filetype(detect_mime_type(content))
        return fitz.open(stream=content, filetype=fitz_type)

    @staticmethod
    def apply_annotations(
        doc: fitz.Document,
        annotations: list[dict],
    ) -> fitz.Document:
        """
        Draw all annotations (rectangles and labels) onto a PDF document.

        For each annotation:
            1. Convert normalized coordinates to page pixels.
            2. Draw the rectangle outline with a transparent fill.
            3. Place the label text near the rectangle's top-right corner.

        Label position is computed from the bounding box, clamped
        within page boundaries to prevent cutoff.

        Args:
            doc: The fitz.Document to annotate.
            annotations: List of annotation dicts, each containing:
                - page_number: 1-indexed page number.
                - points: Array of 2 normalized [x, y] pairs (top-left, bottom-right).
                - label: Optional text label string.

        Returns:
            The annotated fitz.Document (mutated in place).
        """
        for ann in annotations:
            page = doc[ann["page_number"] - 1]
            page_rect = page.rect
            page_w = page_rect.width
            page_h = page_rect.height

            pts = ann["points"]
            x0 = CoordinateService.denormalize(pts[0][0], page_w)
            y0 = CoordinateService.denormalize(pts[0][1], page_h)
            x1 = CoordinateService.denormalize(pts[1][0], page_w)
            y1 = CoordinateService.denormalize(pts[1][1], page_h)
            rect = fitz.Rect(x0, y0, x1, y1)

            # Draw the rectangle with a blue stroke and no fill (transparent)
            page.draw_rect(rect, color=(0.2, 0.4, 0.8), fill=None, width=1.5)

            # Place label near the top-right of the bounding box
            label_text = ann.get("label") or ""
            value_text = ann.get("value") or ""
            if label_text or value_text:
                bbox = CoordinateService.bounding_box(ann["points"])
                label_x = CoordinateService.denormalize(
                    min(bbox["x_max"] + 0.01, 0.95), page_w
                )
                label_y = CoordinateService.denormalize(
                    max(bbox["y_min"] - 0.01, 0.01), page_h
                )

                label_color = PDFService._parse_color(
                    ann.get("label_color"), (0.2, 0.4, 0.8)
                )

                lines = label_text.split("\n")
                line_height = 10
                for i, line in enumerate(lines):
                    stripped = line.strip()
                    if not stripped:
                        continue
                    prepared = _prepare_text(stripped)
                    page.insert_text(
                        fitz.Point(label_x, label_y + i * line_height),
                        prepared,
                        fontsize=8,
                        fontname=ARABIC_FONT_NAME,
                        fontfile=_FONT_PATH,
                        color=label_color,
                    )

                if value_text:
                    value_y = label_y + len(lines) * line_height
                    value_lines = value_text.split("\n")
                    for i, vline in enumerate(value_lines):
                        stripped = vline.strip()
                        if not stripped:
                            continue
                        prepared = _prepare_text(stripped)
                        page.insert_text(
                            fitz.Point(label_x, value_y + i * line_height),
                            prepared,
                            fontsize=7,
                            fontname=ARABIC_FONT_NAME,
                            fontfile=_FONT_PATH,
                            color=(0.3, 0.3, 0.3),
                        )

            # Draw table if the annotation has table_json
            table_json = ann.get("table_json")
            if table_json:
                # Position table below the value text (or label if no value)
                table_top = label_y + max(len(lines), 1) * line_height + 12
                if value_text:
                    table_top = (value_y + len(value_lines) * line_height + 12)
                PDFService.draw_table(
                    page,
                    fitz.Point(label_x, table_top),
                    table_json,
                    page_w - label_x - 10,
                )

        return doc

    @staticmethod
    def generate(doc: fitz.Document) -> bytes:
        """
        Generate PDF bytes from a fitz.Document.

        Args:
            doc: The fitz.Document to serialize.

        Returns:
            Raw PDF file bytes.
        """
        return doc.write()

    @staticmethod
    def _parse_color(value: str | None, default: tuple[float, float, float]
                     ) -> tuple[float, float, float]:
        if not value:
            return default
        match = re.match(r"^#?([0-9a-fA-F]{6})$", value.strip())
        if not match:
            return default
        rgb = match.group(1)
        return (
            int(rgb[0:2], 16) / 255.0,
            int(rgb[2:4], 16) / 255.0,
            int(rgb[4:6], 16) / 255.0,
        )

    @staticmethod
    def _wrap_text(text: str, font: fitz.Font, fontsize: float, max_width: float) -> list[str]:
        if not text:
            return [""]
        text = text.replace("\r\n", "\n")
        lines: list[str] = []
        for paragraph in text.split("\n"):
            words = paragraph.split(" ")
            current_line = ""
            for word in words:
                test_line = f"{current_line} {word}".strip() if current_line else word
                if font.text_length(test_line, fontsize=fontsize) <= max_width:
                    current_line = test_line
                else:
                    if current_line:
                        lines.append(current_line)
                    if font.text_length(word, fontsize=fontsize) > max_width:
                        char_line = ""
                        for ch in word:
                            test_char_line = char_line + ch
                            if font.text_length(test_char_line, fontsize=fontsize) <= max_width:
                                char_line = test_char_line
                            else:
                                if char_line:
                                    lines.append(char_line)
                                char_line = ch
                        current_line = char_line
                    else:
                        current_line = word
            lines.append(current_line)
        return lines if lines else [""]

    @staticmethod
    def draw_table(
        page: fitz.Page,
        top_left: fitz.Point,
        table_json: dict,
        available_width: float,
        rtl: bool = False,
    ):
        """
        Draw a structured table on the PDF page below an annotation.

        Args:
            page: The fitz.Page to draw on.
            top_left: Point where the table starts.
            table_json: Dict with {"headings": [...], "rows": [[...], ...]}.
            available_width: Maximum width in points for the table.
            rtl: If True, text is right-aligned within cells.
        """
        headings = table_json.get("headings", [])
        rows = table_json.get("rows", [])
        if not headings and not rows:
            return 0

        col_count = max(len(headings), 1)
        for row in rows:
            col_count = max(col_count, len(row))

        col_w = available_width / col_count
        cell_h = 14
        header_h = 16

        x0 = top_left.x
        y = top_left.y

        # Draw header row
        header_rect = fitz.Rect(x0, y, x0 + available_width, y + header_h)
        page.draw_rect(header_rect, color=None, fill=(0.25, 0.35, 0.45), width=0)

        for ci in range(col_count):
            cx = x0 + ci * col_w
            text = headings[ci] if ci < len(headings) else ""
            prepared = _prepare_text(text)
            tx = PDFService._rtl_text_x(cx + col_w, prepared, 7) if (rtl and prepared) else cx + 2
            page.insert_text(
                fitz.Point(tx, y + header_h - 4),
                prepared,
                fontsize=7,
                fontname=ARABIC_FONT_NAME,
                fontfile=_FONT_PATH,
                color=(1, 1, 1),
            )
            page.draw_rect(
                fitz.Rect(cx, y, cx + col_w, y + header_h),
                color=(0.5, 0.5, 0.5), width=0.3,
            )

        y += header_h

        # Draw data rows
        for ri, row in enumerate(rows):
            fill = (0.97, 0.97, 0.98) if ri % 2 == 1 else (1, 1, 1)
            row_rect = fitz.Rect(x0, y, x0 + available_width, y + cell_h)
            page.draw_rect(row_rect, color=None, fill=fill, width=0)

            for ci in range(col_count):
                cx = x0 + ci * col_w
                text = row[ci] if ci < len(row) else ""
                prepared = _prepare_text(text)
                tx = PDFService._rtl_text_x(cx + col_w, prepared, 6) if (rtl and prepared) else cx + 2
                page.insert_text(
                    fitz.Point(tx, y + cell_h - 3),
                    prepared,
                    fontsize=6,
                    fontname=ARABIC_FONT_NAME,
                    fontfile=_FONT_PATH,
                    color=(0.1, 0.1, 0.1),
                )
                page.draw_rect(
                    fitz.Rect(cx, y, cx + col_w, y + cell_h),
                    color=(0.8, 0.8, 0.8), width=0.3,
                )

            y += cell_h

        return y - top_left.y

    @staticmethod
    def get_page_count(file_path: str) -> int:
        """
        Get the number of pages in a file.

        Detects file type from content bytes to support both PDF and images.

        Args:
            file_path: Path to the file.

        Returns:
            The total page count.
        """
        with open(file_path, "rb") as f:
            content = f.read()
        fitz_type = mime_to_fitz_filetype(detect_mime_type(content))
        doc = fitz.open(stream=content, filetype=fitz_type)
        count = doc.page_count
        doc.close()
        return count

    @staticmethod
    def _rtl_text_x(cell_right: float, text: str, fontsize: float) -> float:
        if not text:
            return cell_right - 4
        return cell_right - 4 - _ARABIC_FONT.text_length(text, fontsize=fontsize)

    @staticmethod
    def generate_report(
        title: str,
        items: list[dict],
        pdf_bytes: bytes | None = None,
    ) -> bytes:
        """
        Generate a formatted A4 PDF report with a 2-column table.

        For Arabic content, the entire layout mirrors to RTL:
        columns swap, text is right-aligned, title is right-aligned.
        Numbers (0-9) within Arabic text are handled by PyMuPDF's BiDi
        algorithm automatically.

        Layout (LTR):
            - Label column: left side (140 pt)
            - Value column: right side (355 pt)
        Layout (RTL):
            - Value column: left side (355 pt)
            - Label column: right side (140 pt)

        Args:
            title: Report title (typically the document filename).
            items: List of {label, value, annotation_id, annotation_type, crop_png} dicts.
            pdf_bytes: Ignored; pre-rendered crop_png should be in items.

        Returns:
            Raw PDF file bytes.
        """
        from datetime import datetime, timezone

        MARGIN = 50
        COL_LABEL = 140
        COL_VALUE = 355
        TABLE_W = COL_LABEL + COL_VALUE
        ROW_REF = 80
        ROW_EXTR = 24
        HEADER_H = 26
        TABLE_TOP = 130
        PAGE_BREAK_Y = 780
        PAGE_W = 595
        PAGE_H = 842

        def _arabic_in_table_json(tj: dict) -> bool:
            if not tj:
                return False
            for h in tj.get("headings", []):
                if _has_arabic(str(h)):
                    return True
            for row in tj.get("rows", []):
                for cell in row:
                    if _has_arabic(str(cell)):
                        return True
            return False

        is_rtl = _has_arabic(title) or any(
            _has_arabic(str(item.get("label", "")))
            or _has_arabic(str(item.get("value", "")))
            or _arabic_in_table_json(item.get("table_json"))
            for item in items
        )

        if is_rtl:
            VAL_COL_X = MARGIN
            VAL_COL_W = COL_VALUE
            VAL_COL_RIGHT = MARGIN + COL_VALUE
            LABEL_COL_X = MARGIN + COL_VALUE
            LABEL_COL_W = COL_LABEL
            LABEL_COL_RIGHT = MARGIN + TABLE_W
            LABEL_PAD = 4
        else:
            LABEL_COL_X = MARGIN
            LABEL_COL_W = COL_LABEL
            LABEL_COL_RIGHT = MARGIN + COL_LABEL
            VAL_COL_X = MARGIN + COL_LABEL
            VAL_COL_W = COL_VALUE
            VAL_COL_RIGHT = MARGIN + TABLE_W
            LABEL_PAD = 6

        doc = fitz.open()
        page = doc.new_page(width=PAGE_W, height=PAGE_H)

        def draw_table_header(page_obj, y):
            header_rect = fitz.Rect(MARGIN, y, MARGIN + TABLE_W, y + HEADER_H)
            page_obj.draw_rect(header_rect, color=None, fill=(0.25, 0.35, 0.45), width=0)

            prepared_lbl = _prepare_text("Label")
            prepared_val = _prepare_text("Extracted Value")
            if is_rtl:
                lx = PDFService._rtl_text_x(LABEL_COL_RIGHT, prepared_lbl, 10)
                vx = PDFService._rtl_text_x(VAL_COL_RIGHT, prepared_val, 10)
            else:
                lx = LABEL_COL_X + 6
                vx = VAL_COL_X + 6

            page_obj.insert_text(
                fitz.Point(lx, y + 16), prepared_lbl,
                fontsize=10, fontname=ARABIC_FONT_NAME, fontfile=_FONT_PATH,
                color=(1, 1, 1),
            )
            page_obj.insert_text(
                fitz.Point(vx, y + 16), prepared_val,
                fontsize=10, fontname=ARABIC_FONT_NAME, fontfile=_FONT_PATH,
                color=(1, 1, 1),
            )

        def draw_cell_border(page_obj, x, y, w, h):
            rect = fitz.Rect(x, y, x + w, y + h)
            page_obj.draw_rect(rect, color=(0.8, 0.8, 0.8), fill=None, width=0.5)

        def draw_extraction_row(page_obj, y, label, value, fill_color, row_h):
            row_rect = fitz.Rect(MARGIN, y, MARGIN + TABLE_W, y + row_h)
            page_obj.draw_rect(row_rect, color=None, fill=fill_color, width=0)

            prepared_lbl = _prepare_text(label)
            lx = PDFService._rtl_text_x(LABEL_COL_RIGHT, prepared_lbl, 9) if is_rtl else LABEL_COL_X + LABEL_PAD
            page_obj.insert_text(
                fitz.Point(lx, y + row_h // 2 + 3), prepared_lbl,
                fontsize=9, fontname=ARABIC_FONT_NAME, fontfile=_FONT_PATH,
                color=(0.1, 0.1, 0.1),
            )

            col_value_w = VAL_COL_W - 12
            reshaped_val = arabic_reshaper.reshape(value) if _has_arabic(value) else value
            wrapped = PDFService._wrap_text(reshaped_val, _ARABIC_FONT, 9, col_value_w)
            line_h = 13
            for i, vline in enumerate(wrapped):
                prepared_vline = _prepare_text(vline)
                vx = PDFService._rtl_text_x(VAL_COL_RIGHT, prepared_vline, 9) if is_rtl else VAL_COL_X + 4
                page_obj.insert_text(
                    fitz.Point(vx, y + 3 + (i + 1) * line_h), prepared_vline,
                    fontsize=9, fontname=ARABIC_FONT_NAME, fontfile=_FONT_PATH,
                    color=(0.1, 0.1, 0.1),
                )

            draw_cell_border(page_obj, LABEL_COL_X, y, LABEL_COL_W, row_h)
            draw_cell_border(page_obj, VAL_COL_X, y, VAL_COL_W, row_h)

        def draw_reference_row(page_obj, y, label, crop_png, fill_color):
            h = ROW_REF
            row_rect = fitz.Rect(MARGIN, y, MARGIN + TABLE_W, y + h)
            page_obj.draw_rect(row_rect, color=None, fill=fill_color, width=0)

            prepared_lbl = _prepare_text(label)
            lx = PDFService._rtl_text_x(LABEL_COL_RIGHT, prepared_lbl, 9) if is_rtl else LABEL_COL_X + LABEL_PAD
            page_obj.insert_text(
                fitz.Point(lx, y + h // 2 + 3), prepared_lbl,
                fontsize=9, fontname=ARABIC_FONT_NAME, fontfile=_FONT_PATH,
                color=(0.1, 0.1, 0.1),
            )

            if crop_png:
                img_rect = fitz.Rect(
                    VAL_COL_X + 4, y + 4,
                    VAL_COL_X + VAL_COL_W - 4, y + h - 4,
                )
                page_obj.insert_image(img_rect, stream=crop_png)

            draw_cell_border(page_obj, LABEL_COL_X, y, LABEL_COL_W, h)
            draw_cell_border(page_obj, VAL_COL_X, y, VAL_COL_W, h)

        # Draw title
        prepared_title = _prepare_text(title)
        title_x = PDFService._rtl_text_x(PAGE_W - MARGIN, prepared_title, 18) if is_rtl else MARGIN
        page.insert_text(
            fitz.Point(title_x, 50), prepared_title,
            fontsize=18, fontname=ARABIC_FONT_NAME, fontfile=_FONT_PATH,
            color=(0.1, 0.1, 0.1),
        )

        # Draw subtitle with generation date
        gen_date = datetime.now(timezone.utc).strftime("%B %d, %Y at %H:%M UTC")
        subtitle = f"Generated {gen_date}"
        prepared_sub = _prepare_text(subtitle)
        sub_x = PDFService._rtl_text_x(PAGE_W - MARGIN, prepared_sub, 10) if is_rtl else MARGIN
        page.insert_text(
            fitz.Point(sub_x, 72), prepared_sub,
            fontsize=10, fontname=ARABIC_FONT_NAME, fontfile=_FONT_PATH,
            color=(0.5, 0.5, 0.5),
        )

        # Separate data items (extraction + reference) from table items
        data_items = [it for it in items if it.get("annotation_type") != "table"]
        table_items = [it for it in items if it.get("annotation_type") == "table"]

        # -- Section 1: Extracted Data table --
        y = TABLE_TOP
        if data_items:
            draw_table_header(page, y)
            y += HEADER_H
            alt = False
            for item in data_items:
                is_ref = item.get("annotation_type") == "reference"

                if is_ref:
                    row_h = ROW_REF
                else:
                    value = item.get("value", "")
                    col_value_w = VAL_COL_W - 12
                    wrapped_value = PDFService._wrap_text(value, _ARABIC_FONT, 9, col_value_w)
                    line_h = 13
                    row_h = max(ROW_EXTR, len(wrapped_value) * line_h + 6)

                if y + row_h > PAGE_BREAK_Y:
                    page = doc.new_page(width=PAGE_W, height=PAGE_H)
                    y = MARGIN
                    draw_table_header(page, y)
                    y += HEADER_H

                fill = (0.97, 0.97, 0.98) if alt else (1, 1, 1)

                if is_ref:
                    draw_reference_row(page, y, item["label"], item.get("crop_png"), fill)
                else:
                    draw_extraction_row(page, y, item["label"], item["value"], fill, row_h)

                y += row_h
                alt = not alt

        # -- Section 2: Extracted Tables --
        if table_items:
            y += 20
            if y + 30 > PAGE_BREAK_Y:
                page = doc.new_page(width=PAGE_W, height=PAGE_H)
                y = MARGIN

            sec_title = "الجداول المستخرجة" if is_rtl else "Extracted Tables"
            prepared_sec_title = _prepare_text(sec_title)
            sec_title_x = PDFService._rtl_text_x(PAGE_W - MARGIN, prepared_sec_title, 14) if is_rtl else MARGIN
            page.insert_text(
                fitz.Point(sec_title_x, y), prepared_sec_title,
                fontsize=14, fontname=ARABIC_FONT_NAME, fontfile=_FONT_PATH,
                color=(0.1, 0.1, 0.1),
            )
            y += 22

            available_w = PAGE_W - 2 * MARGIN
            for table_item in table_items:
                label = table_item.get("label", "Table")
                table_json = table_item.get("table_json") or {}
                headings = table_json.get("headings", [])
                rows_data = table_json.get("rows", [])

                if not headings and not rows_data:
                    continue

                table_h = 16 + len(rows_data) * 14

                if y + 16 + table_h + 12 > PAGE_BREAK_Y:
                    page = doc.new_page(width=PAGE_W, height=PAGE_H)
                    y = MARGIN

                prepared_lbl = _prepare_text(label)
                lbl_x = PDFService._rtl_text_x(PAGE_W - MARGIN, prepared_lbl, 11) if is_rtl else MARGIN
                page.insert_text(
                    fitz.Point(lbl_x, y), prepared_lbl,
                    fontsize=11, fontname=ARABIC_FONT_NAME, fontfile=_FONT_PATH,
                    color=(0.2, 0.3, 0.5),
                )
                y += 16

                PDFService.draw_table(page, fitz.Point(MARGIN, y), table_json, available_w, rtl=is_rtl)
                y += table_h + 16

        return doc.write()
