/**
 * Viewport store — manages zoom, pan, and current page.
 *
 * This is the single source of truth for the viewport state.
 * Both the PDF renderer and the Konva annotation layer read
 * from this store to keep their transforms synchronized.
 */

import { create } from "zustand";
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "@/shared/constants";

interface ViewportState {
  /** Current zoom level (1.0 = 100%). */
  zoom: number;
  /** Horizontal pan offset in pixels. */
  panX: number;
  /** Vertical pan offset in pixels. */
  panY: number;
  /** Currently visible page number (1-indexed). */
  currentPage: number;
  /** Total number of pages in the document. */
  totalPages: number;

  setZoom: (zoom: number) => void;
  /** Zoom in by one step, centered on the current viewport center. */
  zoomIn: () => void;
  /** Zoom out by one step, centered on the current viewport center. */
  zoomOut: () => void;
  /** Set pan offset (used during drag-to-pan). */
  setPan: (x: number, y: number) => void;
  /** Navigate to a specific page. */
  setPage: (page: number) => void;
  /** Set the total page count when a document is loaded. */
  setTotalPages: (count: number) => void;
  /** Reset zoom to 100% and pan to (0, 0). */
  resetView: () => void;
}

export const useViewportStore = create<ViewportState>((set, get) => ({
  zoom: 1.0,
  panX: 0,
  panY: 0,
  currentPage: 1,
  totalPages: 1,

  setZoom: (zoom: number) => {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
    set({ zoom: clamped });
  },

  zoomIn: () => {
    const { zoom } = get();
    const newZoom = Math.min(ZOOM_MAX, zoom * ZOOM_STEP);
    set({ zoom: newZoom });
  },

  zoomOut: () => {
    const { zoom } = get();
    const newZoom = Math.max(ZOOM_MIN, zoom / ZOOM_STEP);
    set({ zoom: newZoom });
  },

  setPan: (x: number, y: number) => set({ panX: x, panY: y }),

  setPage: (page: number) => {
    const { totalPages } = get();
    const clamped = Math.min(totalPages, Math.max(1, page));
    set({ currentPage: clamped, panX: 0, panY: 0 });
  },

  setTotalPages: (count: number) => set({ totalPages: count }),

  resetView: () => set({ zoom: 1.0, panX: 0, panY: 0 }),
}));
