# Document Annotation Platform — Architecture & Pipeline

---

## 1. Project Overview

An **AI-assisted document annotation platform** where users upload PDFs, draw labeled rectangles on pages, extract text values via **Google Gemini Vision API**, and export annotated PDFs with embedded labels and tables. Built as an internal tool for processing Arabic-language documents (government forms, IDs, certificates).

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Frontend** | React 19 + TypeScript + Vite | 19.1.0 / 5.x |
| **State** | Zustand | 5.x |
| **PDF Viewer** | PDF.js (Mozilla) | 4.x |
| **Canvas** | Konva (react-konva) | 9.x |
| **API Client** | Axios | 1.x |
| **Backend** | Python 3.12 + FastAPI | 0.115 |
| **ORM** | SQLAlchemy 2.0 (async) + asyncpg | 2.0.35 |
| **Migrations** | Alembic | 1.13 |
| **PDF Manipulation** | PyMuPDF (fitz) | 1.24.12 |
| **AI** | Google Gemini API (`google-genai`) | 2.8.0 |
| **Arabic Text** | `arabic-reshaper` + `python-bidi` | 3.0 / 0.6 |
| **Database** | PostgreSQL 16 | Alpine |
| **Container** | Docker Compose | — |
| **Web Server** | Nginx | 1.27-alpine |
| **Testing** | Vitest (frontend) + Pytest (backend) | — |

---

## 3. System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                       Nginx (:8080)                      │
│  ┌────────────────────┐       ┌──────────────────────┐   │
│  │  Static SPA (React) │       │  /api/* proxy_pass   │   │
│  └────────────────────┘       └──────────┬───────────┘   │
└──────────────────────────────────────────────────────────┘
                                           │
                               ┌───────────▼───────────┐
                               │  FastAPI Backend (:8010) │
                               │                         │
                               │  ┌─────────────────┐    │
                               │  │  API Routers     │    │
                               │  │  documents       │    │
                               │  │  annotations     │    │
                               │  │  extraction      │    │
                               │  │  tasks (save)    │    │
                               │  └──────┬─────┬─────┘    │
                               │         │     │          │
                               │  ┌──────▼┐ ┌──▼───────┐  │
                               │  │Services│ │Storage   │  │
                               │  │ PDF    │ │ Local    │  │
                               │  │ AI Ext │ │ (S3 abs) │  │
                               │  │ Coord  │ └──────────┘  │
                               │  │ Ann    │              │
                               │  └────┬───┘              │
                               │       │                    │
                               │  ┌────▼────┐             │
                               │  │ DB (SQLAlchemy)       │
                               │  └────┬────┘             │
                               └───────┼───────────────────┘
                                       │
                               ┌───────▼────────┐
                               │  PostgreSQL 16  │
                               │  :5433 (host)   │
                               │  :5432 (int)    │
                               └────────────────┘
```

---

## 4. Database Schema

```
documents
├── id (UUID, PK)
├── filename (varchar)
├── file_path (text)
├── page_count (integer)
├── created_at (timestamp)
└── updated_at (timestamp)

annotations
├── id (UUID, PK)
├── document_id (UUID, FK → documents, not null, cascade delete)
├── page_number (integer)
├── label (text)
├── value (text, nullable)
├── table_json (JSON, nullable)
├── polygon_json (JSON, nullable)
├── label_color (varchar, nullable)
├── label_position_json (JSON, nullable)
├── annotation_type (enum: extraction|table|reference, default extraction)
├── created_at (timestamp)
└── updated_at (timestamp)
    └── Index: (document_id, page_number)
```

---

## 5. Frontend State Architecture

```
Zustand Stores:
┌─────────────────────────────────────────────────┐
│  annotationStore  │  annotations[], selectedId, │
│                   │  drawing state, CRUD actions │
├─────────────────────────────────────────────────┤
│  historyStore     │  past[]/future[] snapshots   │
│                   │  drag coalescing, undo/redo   │
├─────────────────────────────────────────────────┤
│  viewportStore    │  zoom, pan, currentPage,     │
│                   │  totalPages                  │
├─────────────────────────────────────────────────┤
│  extractionStore  │  extractedData[], status,    │
│                   │  error state                 │
├─────────────────────────────────────────────────┤
│  uiStore          │  activeTool, saveStatus,     │
│                   │  scrollTargetPage            │
├─────────────────────────────────────────────────┤
│  notificationStore│  toast queue with auto-dismiss│
└─────────────────────────────────────────────────┘

Coordinate System:
  Screen coordinates ──→ Normalized [0.0, 1.0] ──→ Resolution-independent
        │                                                     │
  zoom + pan transforms                               fitz page coords
```

---

## 6. Directory Structure

```
file-annotation/
├── docker-compose.yml         # 3-service orchestration
├── README.md
├── backend/
│   ├── Dockerfile             # python:3.12-slim
│   ├── entrypoint.sh          # alembic → uvicorn
│   ├── requirements.txt       # 16 dependencies
│   ├── alembic.ini
│   ├── app/
│   │   ├── main.py            # FastAPI app entrypoint
│   │   ├── api/               # documents, annotations, extraction, tasks
│   │   ├── models/            # document, annotation
│   │   ├── schemas/           # Pydantic models
│   │   ├── services/          # PDF, AI extractor, coordinate, annotation
│   │   ├── storage/           # base (abstract), local
│   │   ├── core/              # config, exceptions, error_handler
│   │   ├── database/          # base, session (async engine)
│   │   └── fonts/             # NotoNaskhArabic-Regular.ttf
│   ├── migrations/            # 6 Alembic versions
│   ├── tests/                 # conftest, test_coordinate, test_ai_extractor
│   └── credentials/           # GCP service account JSON
├── frontend/
│   ├── Dockerfile             # node:20 build → nginx:1.27-alpine
│   ├── nginx.conf             # 100MB body limit, /api/ proxy
│   ├── src/
│   │   ├── app/               # App.tsx (landing ↔ workspace state machine)
│   │   ├── api/               # client, documents, annotations, extraction, tasks
│   │   ├── modules/
│   │   │   ├── annotations/   # AnnotationShape, AnnotationLayer, ConnectorLayer, DrawingPreview, LabelPopup
│   │   │   ├── coordinates/   # coordinateEngine.ts (screen↔document)
│   │   │   ├── pdf-viewer/    # PdfRenderer, PdfJsRenderer, usePdfDocument
│   │   │   ├── page-manager/  # DocumentViewer, PageNavigation
│   │   │   ├── ui/            # Toolbar, LabelingPanel, LandingPage, ShortcutHelp, ContextMenu, Toasts
│   │   │   └── extraction/    # ExtractionPanel, TableEditor
│   │   └── store/             # 6 Zustand stores
│   └── tests/                 # Vitest suites (48 tests)
├── storage/
│   └── pdfs/                  # Per-document PDF subdirectories
└── .gitignore
```

---

## 7. Pipeline Architecture — Overview

### High-Level Flow

```
┌──────────┐    ┌───────────┐    ┌──────────────┐    ┌──────────┐
│ 1. UPLOAD │    │ 2. VIEW   │    │ 3. EXTRACT   │    │ 4. SAVE  │
│  PDF file │───▶│ Draw rects│───▶│ AI reads each│───▶│ Export   │
│           │    │ Assign    │    │ region via   │    │ annotated│
│           │    │ labels    │    │ Gemini Vision│    │ PDF +    │
│           │    │           │    │              │    │ Report   │
└──────────┘    └───────────┘    └──────────────┘    └──────────┘
                                                           │
                                                           ▼
                                              ┌──────────────────────┐
                                              │ 5. Results           │
                                              │ - Annotated PDF       │
                                              │ - Extraction Report   │
                                              │   (A4 with shaped     │
                                              │    Arabic text)      │
                                              └──────────────────────┘
```

---

## 8. Pipeline 1: Upload PDF

### Function Call Chain

```
Frontend: LandingPage (drag-drop / file input)
  │
  ├── api/documents.ts: uploadDocument(file)
  │     POST /api/v1/documents  (multipart/form-data)
  │
  ▼
Backend: api/documents.py → upload_document()
  │
  ├── schemas/document.py → DocumentResponse (validates output)
  │
  ├── services/document.py → DocumentService.upload()
  │     ├── validates extension (.pdf) and size (100MB max)
  │     ├── storage/local.py → LocalStorage.save(content, doc_id, filename)
  │     │     └── aiofiles write to ./storage/pdfs/<doc_id>/<filename>
  │     ├── services/pdf.py → PDFService.get_page_count(file_path)
  │     │     └── fitz.open(file_path) → doc.page_count
  │     └── repositories/document.py → DocumentRepository.create()
  │           └── SQLAlchemy: INSERT INTO documents (id, filename, file_path, page_count)
  │
  └── returns DocumentResponse (id, filename, page_count, timestamps)
```

**Sequential call chain:**
`onDrop/LandingPage` → `uploadDocument()` → `POST /documents` → `upload_document()` → `DocumentService.upload()` → `LocalStorage.save()` + `PDFService.get_page_count()` + `DocumentRepository.create()` → `DocumentResponse`

---

## 9. Pipeline 2: Annotate & Save (Draw → Persist)

### 9a. Draw Rectangle

```
Frontend: PdfRenderer.tsx (Konva Stage)
  │
  ├── onMouseDown: start drawing (annotationStore.setDrawing(true))
  ├── onMouseMove: addDrawingPoint (normalized coords via coordinateEngine)
  └── onMouseUp: finish → DrawingPreview disappears → LabelPopup opens

LabelPopup.tsx
  └── onSubmit: annotationStore.addAnnotation({
        id, pageNumber, points, label, annotationType, labelColor
      })
```

### 9b. Sync (Persist to DB)

```
Frontend: useSave.ts → doSave()
  │
  ├── Groups annotations by pageNumber into Map<number, payload[]>
  │
  └── For each page:
        api/annotations.ts → syncAnnotations(documentId, pageNumber, payload[])
              │
              ▼
        Backend: POST /api/v1/documents/{id}/annotations/sync
              │
              └── api/annotations.py → sync_annotations()
                    │
                    └── services/annotation.py → AnnotationService.sync()
                          ├── validates all coordinates via CoordinateService.validate_rect()
                          │     └── coordinate.py: checks 2+ points, each 0.0–1.0, min width/height 0.01
                          ├── repositories/annotation.py → AnnotationRepository.sync_page()
                          │     └── deletes all existing annotations for (document_id, page_number)
                          │     └── bulk inserts new annotations
                          │     └── returns full replacement list
                          └── returns AnnotationResponse[]
```

**Sequential call chain:**
`LabelPopup.onSubmit` → `annotationStore.addAnnotation` (local state) → `useSave.doSave` → `syncAnnotations()` → `POST /annotations/sync` → `sync_annotations()` → `AnnotationService.sync()` → `CoordinateService.validate_rect()` → `AnnotationRepository.sync_page()` (DELETE + INSERT) → response → `storeSetAnnotations(updated)`

---

## 10. Pipeline 3: AI Extraction

### Function Call Chain

```
Frontend: ExtractionPanel.tsx → handleExtract()
  │
  │  Step 0: Sync latest annotations to DB (same as 9b above)
  │
  ├── api/extraction.ts → extractData(documentId)
  │     POST /api/v1/documents/{id}/extract
  │
  ▼
Backend: api/extraction.py → extract_document()
  │
  ├── Loads document + annotations from DB
  ├── Separates by annotation_type: extraction, table, reference
  │
  ├── For "extraction" annotations ──────────────────────────────┐
  │   │                                                          │
  │   └── services/ai_extractor.py → AIExtractorService.extract()│
  │         │                                                    │
  │         ├── fitz.open(pdf_bytes)                             │
  │         │                                                    │
  │         ├── _crop_region_images(doc, annotations, logger)    │
  │         │     └── For each annotation:                       │
  │         │           page[page-1].get_pixmap(dpi=300, clip=rect)│
  │         │           → list of PNG bytes                      │
  │         │                                                    │
  │         ├── _build_region_prompt(annotations, logger)        │
  │         │     └── Injects labels into PROMPT_TEMPLATE        │
  │         │                                                    │
  │         ├── _get_contents(images, prompt)                    │
  │         │     └── Builds genai_types.Part list               │
  │         │                                                    │
  │         ├── _call_gemini(contents, logger)                   │
  │         │     ├── client.models.generate_content(model, ...) │
  │         │     ├── Retry on 429: 3 attempts with exponential  │
  │         │     └── Fallback on exhaustion: gemini-2.5-flash   │
  │         │                                                    │
  │         ├── _parse_response(raw, logger)                     │
  │         │     ├── Strips markdown fences                    │
  │         │     ├── _extract_first_json (depth-aware)         │
  │         │     └── JSON parse → list of {label, value}       │
  │         │                                                    │
  │         ├── _merge_duplicates(parsed, logger)                │
  │         │     └── OrderedDict: same label → join with ", "   │
  │         │                                                    │
  │         └── Maps label → annotation_id from input            │
  │               → returns [{label, value, annotation_id}]      │
  │                                                              │
  │   └── Persists: ann_repo.update(ann_id, {"value": value})    │
  │                                                              │
  ├── For "reference" annotations ───────────────────────────────┘
  │     └── No AI call — returns {label, value: "", annotation_id}
  │
  ├── For "table" annotations ───────────────────────────────────┐
  │   │                                                          │
  │   └── services/ai_extractor.py → AIExtractorService.extract_tables()│
  │         │                                                    │
  │         ├── _crop_region_images (same as above)              │
  │         ├── _build_batch_table_prompt(annotations, logger)   │
  │         │     └── Injects labels into TABLE_BATCH_PROMPT_TEMPLATE│
  │         ├── _get_contents(images, "Extract tables...")       │
  │         ├── _call_gemini(contents, logger,                   │
  │         │     system_instruction=prompt,                     │
  │         │     model_name="gemini-2.5-pro",                   │
  │         │     fallback_model="gemini-2.5-flash")             │
  │         ├── _parse_batch_table_response(raw, logger)         │
  │         │     → label → {headings: [...], rows: [[...]]}     │
  │         └── Maps back to annotation_ids                      │
  │               → returns [{label, table_json, annotation_id}] │
  │                                                              │
  │   └── Persists: ann_repo.update(ann_id, {"table_json": ...}) │
  │                                                              │
  ├── ExtractionLogger._prune_old_runs() (keep latest 25)        │
  │                                                              │
  └── Returns ExtractResponse(items[...])                        │
```

### AI Extraction Pipeline (detailed)

```
PDF (loaded)
    │
    ▼
Extraction Request
    │
    ▼
For each annotation:
    ├── Crop region from PDF at 300 DPI (PyMuPDF)
    ├── Build prompt with table language
    ├── Send to Gemini 2.5-flash (Vision)
    │   └── Fallback chain: Pro → Flash on 429
    ├── Parse JSON response (skip extra `}`)
    ├── Merge duplicates (same label+value)
    └── Store result (value/table_json)
    │
    ▼
Save: draw labels + values onto original PDF pages
    │
    ▼
Generate Report: create new A4 PDF with:
    ├── Shaped Arabic via arabic_reshaper + python-bidi
    ├── RTL-aware table layout (right-aligned columns)
    └── Embedded crop images for reference annotations
```

**Sequential call chain:**
`handleExtract()` → sync annotations → `extractData()` → `POST /extract` → `extract_document()` → `AIExtractorService.extract()` → `_crop_region_images()` → `_build_region_prompt()` → `_get_contents()` → `_call_gemini()` → `_parse_response()` → `_extract_first_json()` → `_merge_duplicates()` + `AIExtractorService.extract_tables()` → `_build_batch_table_prompt()` → `_get_contents()` → `_call_gemini()` → `_parse_batch_table_response()` → `ann_repo.update()` → `ExtractResponse`

---

## 11. Pipeline 4: Save Annotated PDF (Async Task)

### Function Call Chain

```
Frontend: usePdfSave.ts → doPdfSave()
  │
  ├── api/tasks.ts → startSave(documentId)
  │     POST /api/v1/documents/{id}/save
  │     → returns { taskId, status: "pending", progress: 0 }
  │
  ▼
Backend: api/tasks.py → start_save()
  │
  ├── Generates UUID task_id
  ├── Stored in in-memory dict: tasks[task_id] = TaskState()
  └── asyncio.create_task(run_save(task_id, document_id))
        │
        ▼
      run_save(task_id, document_id)
        │
        ├── task.status = "processing", task.progress = 10
        │
        ├── Fetch document + annotations from DB
        │   with async_session() as session:
        │     DocumentRepository.get_by_id(document_id)
        │     AnnotationRepository.get_by_document(document_id)
        │   task.progress = 20
        │
        ├── Load original PDF: storage.read(file_path)
        │   task.progress = 30
        │
        ├── Build ann_dicts list with page_number, points, label,
        │   value, table_json, label_color
        │   task.progress = 30..80 (per annotation)
        │
        ├── PDFService.apply_annotations(doc, ann_dicts)  ← KEY
        │   │
        │   └── For each annotation:
        │         ├── page.draw_rect(rect, color, fill, width)
        │         ├── page.insert_text(prepared_label, font=NotoNaskhArabic)
        │         ├── page.insert_text(prepared_value, ...)
        │         └── PDFService.draw_table(page, point, table_json, width, rtl)
        │               ├── header: draw_rect + insert_text per column (reversed if rtl)
        │               └── rows: draw_rect + insert_text per cell (reversed if rtl)
        │
        ├── PDFService.generate(doc) → new_pdf_bytes
        │   task.progress = 90
        │
        ├── storage.save(new_pdf_bytes, doc_id, filename)
        │   task.progress = 100
        │   task.status = "completed"
        │
        └── On exception: task.status = "failed", task.error = str(e)
        │
        ▼
Frontend: pollUntilComplete(taskId, onProgress)
  │
  └── setInterval(1000ms):
        GET /api/tasks/{task_id}
        → backend: get_task() → reads from in-memory tasks dict
        → on "completed": clearInterval → trigger download
        → on "failed": clearInterval → reject
        │
        ▼
      Download: hidden <a> element with getDocumentFileUrl(documentId)
```

### Save Pipeline (async task)

```
Frontend: POST /api/documents/{id}/save
    │
    ▼
Backend: Creates TaskState(in-memory dict)
    └── Background coroutine:
        ├── Sync all annotations to DB (delete + bulk insert)
        ├── Load original PDF
        ├── For each annotation:
        │   ├── Draw rectangle outline
        │   └── Draw label + value text (Arabic-shaped)
        ├── Generate report PDF
        ├── Write bytes to response
        └── Set task to completed
    │
    ▼
Frontend: Polls GET /api/tasks/{id} (1s interval, 5min timeout)
    └── On complete → download annotated PDF bytes
```

**Sequential call chain:**
`doPdfSave()` → `startSave()` → `POST /save` → `start_save()` → `asyncio.create_task(run_save())` → `DocumentRepository.get_by_id()` + `AnnotationRepository.get_by_document()` → `LocalStorage.read()` → `PDFService.apply_annotations()` → `page.draw_rect()` + `page.insert_text()` + `PDFService.draw_table()` → `PDFService.generate()` → `LocalStorage.save()` → polling: `pollTask()` → `GET /tasks/{id}` → `get_task()` → download

---

## 12. Pipeline 4b: Generate Report (Separate PDF)

```
Frontend: ExtractionPanel.tsx → handleGenerateReport()
  │
  ├── api/extraction.ts → generateReport(documentId, extractedData)
  │     POST /api/v1/documents/{id}/generate-report
  │     body: { items: ExtractedItem[] }
  │     responseType: "blob"
  │
  ▼
Backend: api/extraction.py → generate_report()
  │
  ├── Load document from DB (for title = filename)
  │
  ├── For each item with annotation_id:
  │     ├── Load PDF, get page, clip annotation region
  │     └── page.get_pixmap(dpi=96, clip=rect) → crop_png bytes
  │
  ├── PDFService.generate_report(title, items_data)  ← KEY
  │     │
  │     ├── Detects is_rtl: scans title + all labels + values + table_json
  │     │
  │     ├── Creates new A4 page (595×842)
  │     │
  │     ├── Draws title (right-aligned if RTL)
  │     │     insert_text(_prepare_text(title))
  │     │
  │     ├── Draws subtitle "Generated <date>"
  │     │     insert_text(_prepare_text(subtitle))
  │     │
  │     ├── Section 1: Extracted Data table
  │     │   ├── draw_table_header():
  │     │   │     draw_rect header background (dark blue)
  │     │   │     insert_text("Label")
  │     │   │     insert_text("Extracted Value")
  │     │   │
  │     │   └── For each data item (alternating colors):
  │     │         ├── draw_extraction_row():
  │     │         │     draw_rect fill
  │     │         │     insert_text(_prepare_text(label))   [left col]
  │     │         │     _wrap_text(value) → insert_text per line [right col]
  │     │         │     draw_cell_border (left + right)
  │     │         │
  │     │         └── draw_reference_row():
  │     │               draw_rect fill
  │     │               insert_text(_prepare_text(label))
  │     │               insert_image(crop_png)
  │     │               draw_cell_border
  │     │
  │     ├── Section 2: Extracted Tables
  │     │   ├── insert_text(_prepare_text("الجداول المستخرجة" / "Extracted Tables"))
  │     │   └── For each table item:
  │     │         ├── insert_text(_prepare_text(label))
  │     │         └── PDFService.draw_table(page, point, table_json, width, rtl)
  │     │
  │     └── doc.write() → PDF bytes
  │
  ├── ExtractionLogger.log()
  │
  └── Returns StreamingResponse (application/pdf, Content-Disposition attachment)
```

**Sequential call chain:**
`handleGenerateReport()` → `generateReport()` → `POST /generate-report` → `generate_report()` → `AnnotationRepository.get_by_id()` + `fitz page.get_pixmap()` → `PDFService.generate_report()` → `draw_table_header()` → `draw_extraction_row()` / `draw_reference_row()` / `PDFService.draw_table()` → `doc.write()` → `StreamingResponse`

---

## 13. Cross-Cutting: Coordinate System

Every function that touches geometry uses the same normalized coordinate pipeline:

```
Frontend screen click
  → coordinateEngine.screenToDocument(clientX, clientY, pageRect, zoom, pan)
    → denormalize((clientX - panX - pageRect.x) / zoom, pageRect.width)
    → returns [0.0, 1.0] value
  → stored in annotationStore / sent in API payload

Backend receives normalized [0.0, 1.0]
  → CoordinateService.denormalize(norm, pageDimension)
    → norm * dimension → pixel value
  → Used in PDFService.apply_annotations for fitz.Rect + draw_rect + insert_text
```

---

## 14. Cross-Cutting: Arabic Text Pipeline

Every text insertion goes through this chain:

```
Raw Unicode string (e.g., "اسم العميل")
  │
  ▼
_prepare_text(text)
  │
  ├── _has_arabic(text) regex check
  │
  └── If Arabic detected:
        ├── arabic_reshaper.reshape(text)
        │     → converts isolated chars to joined presentation forms
        │       ("ا س م   ا ل ع م ي ل" → "ﺍﺴﻡ   ﺍﻝﻌﻤﻴل")
        │
        └── bidi.algorithm.get_display(reshaped)
              → reorders for RTL visual display
                ("ﻡﻴﻠﻌﻟﺍ ﻡﺴﺍ")
              → inserted via page.insert_text(fontname="NotoNaskhArabic")
                with right-aligned positioning in RTL mode
```

---

## 15. Complete Call Graph (Visual Summary)

```
UPLOAD FLOW
  LandingPage ──▶ uploadDocument ──▶ POST /documents ──▶ upload_document()
    └── DocumentService.upload()
          ├── LocalStorage.save()
          ├── PDFService.get_page_count()
          └── DocumentRepository.create()

ANNOTATE FLOW
  PdfRenderer (mouse events) ──▶ coordinateEngine ──▶ annotationStore.addAnnotation()
  useSave.doSave() ──▶ syncAnnotations() ──▶ POST /annotations/sync
    └── AnnotationService.sync()
          ├── CoordinateService.validate_rect()
          └── AnnotationRepository.sync_page() (DELETE + INSERT)

EXTRACT FLOW
  ExtractionPanel.handleExtract() ──▶ extractData() ──▶ POST /extract
    └── extract_document()
          ├── AIExtractorService.extract()
          │     ├── _crop_region_images (300 DPI, fitz)
          │     ├── _build_region_prompt (PROMPT_TEMPLATE)
          │     ├── _get_contents (build Parts list)
          │     ├── _call_gemini (retry + fallback)
          │     ├── _parse_response → _extract_first_json
          │     └── _merge_duplicates (OrderedDict)
          │
          ├── AIExtractorService.extract_tables()
          │     ├── _crop_region_images
          │     ├── _build_batch_table_prompt (TABLE_BATCH_PROMPT_TEMPLATE)
          │     ├── _get_contents
          │     ├── _call_gemini (Pro → Flash fallback, system_instruction)
          │     └── _parse_batch_table_response
          │
          └── ExtractionLogger (JSONL audit trail)

SAVE FLOW
  usePdfSave.doPdfSave() ──▶ startSave() ──▶ POST /save ──▶ start_save()
    └── asyncio.create_task(run_save())
          ├── DocumentRepository.get_by_id()
          ├── AnnotationRepository.get_by_document()
          ├── LocalStorage.read()
          ├── PDFService.apply_annotations()
          │     ├── page.draw_rect()
          │     └── page.insert_text(_prepare_text(...))
          │     └── PDFService.draw_table() (column-reversed if rtl)
          ├── PDFService.generate() → doc.write()
          └── LocalStorage.save()
    polling ──▶ GET /tasks/{id} ──▶ get_task()

REPORT FLOW
  ExtractionPanel.handleGenerateReport() ──▶ generateReport() ──▶ POST /generate-report
    └── generate_report()
          ├── For each item: fitz crop → crop_png bytes
          └── PDFService.generate_report(title, items)
                ├── page.insert_text(_prepare_text(title))
                ├── draw_table_header()
                ├── draw_extraction_row() / draw_reference_row()
                │     ├── _wrap_text(value)
                │     └── page.insert_text(_prepare_text(...))
                └── PDFService.draw_table() (section 2)
```

---

## 16. Pros

1. **End-to-end annotation pipeline** — upload → annotate → extract → export in a single app, no external tools needed
2. **AI-powered extraction** — Gemini Vision handles diverse document layouts without training; prompt engineering is the only configuration needed
3. **Arabic-first** — full RTL layout support in PDF output via `arabic-reshaper` + `python-bidi` + NotoNaskhArabic font; table columns reverse when Arabic detected
4. **Normalized coordinate system** — annotations stored as `[0.0, 1.0]` floats, decoupled from screen resolution and zoom; enables reliable server-side PDF rendering
5. **Async save with polling** — background coroutine doesn't block the API; frontend polls for completion with progress
6. **Bulk atomic sync** — page-level annotation sync via `POST /annotations/sync` (delete + insert in one transaction); frontend replaces entire local store after each save
7. **Undo/redo with drag coalescing** — command pattern with per-annotation snapshots; drag operations are coalesced into a single undo step
8. **Storage abstraction** — `StorageBackend` interface ready for S3/GCS; currently `LocalStorage` for simplicity
9. **Extraction audit trail** — per-document JSONL log with 25-run cap for debugging failed extractions
10. **40+ frontend tests + 13 backend tests** — moderate coverage for a prototype

---

## 17. Cons

1. **No authentication** — single-user MVP; no user model, no auth middleware, no session handling
2. **In-memory task state** — task status lost on backend restart; not suitable for multi-worker production (needs Redis/Celery)
3. **Gemini-only** — no fallback provider; if Gemini is down or quota exhausted, extraction fails entirely (429 handling only retries the same provider)
4. **`LocalStorage` only** — no S3/GCS backend implemented yet; `StorageBackend` interface exists but only `LocalStorage` is wired in
5. **Sequential AI extraction** — annotations are processed one-by-one; no batching or parallelization; large documents (50+ annotations) take noticeably long
6. **Synchronous extraction logging** — JSONL append with read-trim-write for pruning; could race under concurrent extraction requests
7. **Missing backend integration tests** — `test_annotation_service.py` is a placeholder; no database-backed tests for the service layer exist
8. **Empty modules** — `history/`, `keyboard/`, `annotation/` directories exist but are empty; logic is scattered across store files instead
9. **No PDF thumbnail preview** — LandingPage shows a file list; no page thumbnails for quick document identification
10. **Hardcoded GCP credentials path** — service account JSON path is baked into `docker-compose.yml` and Dockerfile; not configurable via environment variable
11. **Frontend SPA on Nginx with no SSR** — SEO irrelevant for internal tool, but no static prerendering either; blank page until JS loads

---

## 18. Future Implementation

### Short-term (MVP hardening)
- **Redis/Celery** for persistent task queue → survive restarts, support multiple workers, enable concurrent saves
- **S3/GCS storage backend** — implement the existing `StorageBackend` interface for cloud-native deployments
- **Database-backed integration tests** — fill in the `test_annotation_service.py` placeholder with real async DB fixtures
- **Annotation validation improvements** — currently checks min width/height 0.01; add overlap detection, multi-page annotation support
- **Parallel extraction** — batch annotations into groups, send concurrent Gemini requests, merge results

### Medium-term (features)
- **User authentication** — JWT-based auth with user-scoped documents; organization/team isolation
- **Multiple AI providers** — add OpenAI Vision, Claude Vision as fallback/choice; model selector per extraction
- **PDF thumbnail gallery** — generate page thumbnails on upload for the document list view
- **Export formats** — CSV/Excel extraction report in addition to annotated PDF; structured data export API
- **Annotation templates** — save and reapply annotation layouts across similar documents (e.g., same form repeated)
- **Batch processing** — upload multiple PDFs, apply the same annotation template to all, extract in bulk

### Long-term (platform)
- **Real-time collaboration** — WebSocket sync for multi-user annotation on the same document
- **Document classification** — AI model classifies document type and auto-suggests annotation template
- **Custom training** — fine-tune extraction model on in-domain documents (Gemini tuning or LoRA adapter)
- **Table extraction improvements** — confidence scores, manual correction workflows, export to XLSX
- **Pipeline history browser** — UI to browse, re-run, compare extraction logs
- **API rate limiting & usage tracking** — per-user/team quotas, cost tracking for Gemini API consumption
