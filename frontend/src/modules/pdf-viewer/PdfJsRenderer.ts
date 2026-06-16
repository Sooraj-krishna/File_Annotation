/**
 * PDF.js implementation of the PdfRenderer interface.
 *
 * Handles loading a PDF from a URL, rendering pages to canvas,
 * and providing page dimensions. The worker script is loaded
 * from a CDN to avoid bundling it with the application.
 */

import * as pdfjsLib from "pdfjs-dist";
import type { PdfRenderer } from "./PdfRenderer.interface";

// Configure the worker source for background PDF rendering
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export class PdfJsRenderer implements PdfRenderer {
  private doc: pdfjsLib.PDFDocumentProxy | null = null;
  private currentRenderTask: pdfjsLib.RenderTask | null = null;
  private renderGeneration = 0;

  async load(url: string): Promise<void> {
    this.doc = await pdfjsLib.getDocument(url).promise;
  }

  getPageCount(): number {
    if (!this.doc) throw new Error("PDF document not loaded");
    return this.doc.numPages;
  }

  async getPageDimensions(pageNumber: number): Promise<{ width: number; height: number }> {
    if (!this.doc) throw new Error("PDF document not loaded");
    const page = await this.doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.0 });
    page.cleanup();
    return { width: viewport.width, height: viewport.height };
  }

  async renderToCanvas(
    pageNumber: number,
    canvas: HTMLCanvasElement,
    scale: number,
  ): Promise<void> {
    if (!this.doc) throw new Error("PDF document not loaded");

    this.cancelRender();
    const gen = ++this.renderGeneration;

    const page = await this.doc.getPage(pageNumber);

    // A newer render was requested while we were loading the page — skip this one
    if (gen !== this.renderGeneration) {
      page.cleanup();
      return;
    }

    const viewport = page.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2D canvas context");

    const renderTask = page.render({ canvasContext: ctx, viewport });
    this.currentRenderTask = renderTask;

    try {
      await renderTask.promise;
    } finally {
      if (this.currentRenderTask === renderTask) {
        this.currentRenderTask = null;
      }
      page.cleanup();
    }
  }

  private cancelRender(): void {
    if (this.currentRenderTask) {
      try {
        this.currentRenderTask.cancel();
      } catch {
        // Ignore errors from cancelling
      }
      this.currentRenderTask = null;
    }
  }

  destroy(): void {
    this.cancelRender();
    if (this.doc) {
      this.doc.destroy();
      this.doc = null;
    }
  }
}
