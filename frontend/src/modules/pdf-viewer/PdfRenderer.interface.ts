/**
 * Abstract interface for the PDF rendering engine.
 *
 * This abstraction allows swapping PDF.js for a different renderer
 * later without changing any component code.
 */

export interface PdfRenderer {
  /** Fetch and initialize a PDF document from a URL. */
  load(url: string): Promise<void>;

  /** Total number of pages in the document. */
  getPageCount(): number;

  /** Get page dimensions in PDF points at scale 1.0. */
  getPageDimensions(pageNumber: number): Promise<{ width: number; height: number }>;

  /**
   * Render a page onto a canvas element at the given scale.
   * The canvas element should already be in the DOM.
   */
  renderToCanvas(
    pageNumber: number,
    canvas: HTMLCanvasElement,
    scale: number,
  ): Promise<void>;

  /** Release all resources (worker, document references). */
  destroy(): void;
}
