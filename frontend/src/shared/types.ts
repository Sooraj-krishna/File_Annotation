/**
 * Shared TypeScript interfaces used across all frontend modules.
 *
 * These types define the contract between the frontend and backend,
 * and between different frontend modules. Changes here propagate
 * through the entire codebase at compile time.
 */

/** Normalized [x, y] position for the label anchor point. */
export interface LabelPosition {
  x: number;
  y: number;
}

/** Structured table data extracted by AI. */
export interface TableData {
  headings: string[];
  rows: string[][];
}

/** A rectangle annotation on a PDF page. Mirrors the backend AnnotationResponse. */
export interface Annotation {
  id: string;
  documentId: string;
  pageNumber: number;
  label: string | null;
  /** Hex color string for the label text, e.g. "#2563eb" or null for default. */
  labelColor: string | null;
  /** "extraction" (send to AI), "table" (extract table structure), or "reference" (visual only). */
  annotationType: string;
  /** Normalized coordinates — exactly 2 points: [top-left, bottom-right] */
  points: [number, number][];
  /** Normalized position of the label anchor, or null for default position. */
  labelPosition: LabelPosition | null;
  /** Extracted table structure, or null. */
  tableJson?: TableData | null;
  createdAt: string;
  updatedAt: string;
}

/** Request payload for creating a new annotation. */
export interface AnnotationCreate {
  documentId: string;
  pageNumber: number;
  label?: string | null;
  annotationType?: string;
  points: [number, number][];
}

/** Request payload for updating an existing annotation (all fields optional). */
export interface AnnotationUpdate {
  label?: string | null;
  labelColor?: string | null;
  annotationType?: string;
  points?: [number, number][];
}

/** Single source of truth for the viewport state. */
export interface Viewport {
  zoom: number;
  panX: number;
  panY: number;
  page: number;
}

/** A command stored in the history engine for undo/redo. */
export interface Command {
  type: "create" | "delete" | "move-rectangle" | "rename-label";
  annotationId: string;
  /** Snapshot of the annotation before the command was applied. */
  before: Partial<Annotation> | null;
  /** Snapshot of the annotation after the command was applied. */
  after: Partial<Annotation> | null;
}

/** Response from the async save task endpoint. */
export interface SaveTask {
  taskId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  resultUrl?: string;
}

/** Active tool in the toolbar. */
export type Tool = "select" | "draw-rectangle" | "pan";

/** Document metadata as returned by the backend. */
export interface DocumentResponse {
  id: string;
  filename: string;
  mimeType: string;
  pageCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Paginated document list response. */
export interface DocumentList {
  documents: DocumentResponse[];
  total: number;
}

/** A single label-value pair returned by AI extraction result. */
export interface ExtractedItem {
  label: string;
  value: string;
  annotation_id?: string;
  annotation_type?: string;
  crop_url?: string;
  table_json?: TableData | null;
}

/** Response from the extract endpoint. */
export interface ExtractResponse {
  items: ExtractedItem[];
}

/** MIME types supported by the application. */
export type SupportedMimeType =
  | "application/pdf"
  | "image/png"
  | "image/jpeg"
  | "image/gif"
  | "image/webp"
  | "image/tiff"
  | "image/bmp";

/** Annotation types supported by the application. */
export type AnnotationType = "extraction" | "table" | "reference";

/** Health check response. */
export interface HealthResponse {
  status: "ok" | "degraded" | "down";
  timestamp: string;
  version: string;
  checks: {
    database: boolean;
    storage: boolean;
    ai: boolean;
  };
}
