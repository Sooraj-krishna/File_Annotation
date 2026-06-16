/**
 * Annotation store — manages the list of annotations for the current document.
 *
 * Handles CRUD operations, selection, and the transient state
 * during rectangle drawing (drawingPoints holds the 2 rect corners).
 */

import { create } from "zustand";
import type { Annotation, LabelPosition } from "@/shared/types";

interface AnnotationState {
  /** All annotations loaded for the current document. */
  annotations: Annotation[];
  /** ID of the currently selected annotation, or null. */
  selectedId: string | null;
  /** Whether the user is currently drawing a rectangle. */
  drawing: boolean;
  /** Temporary points while drawing: [start, end] in screen coords. */
  drawingPoints: [number, number][];

  setAnnotations: (annotations: Annotation[]) => void;
  addAnnotation: (annotation: Annotation) => void;
  /** Partially update an annotation (used during drag/debounce). */
  updateAnnotation: (id: string, data: Partial<Annotation>) => void;
  removeAnnotation: (id: string) => void;

  selectAnnotation: (id: string | null) => void;
  setDrawing: (drawing: boolean) => void;
  /** Add a point to the current drawing (appends to array). */
  addDrawingPoint: (point: [number, number]) => void;
  /** Set a drawing point at a specific index (0 = start, 1 = end/cursor). */
  setDrawingPoint: (index: number, point: [number, number]) => void;
  /** Clear all drawing state. */
  clearDrawing: () => void;
  /** Update the label position for an annotation. */
  setLabelPosition: (id: string, labelPosition: LabelPosition) => void;
}

export const useAnnotationStore = create<AnnotationState>((set) => ({
  annotations: [],
  selectedId: null,
  drawing: false,
  drawingPoints: [],

  setAnnotations: (annotations) => set({ annotations }),

  addAnnotation: (annotation) =>
    set((state) => ({
      annotations: [...state.annotations, annotation],
    })),

  updateAnnotation: (id, data) =>
    set((state) => ({
      annotations: state.annotations.map((a) =>
        a.id === id ? { ...a, ...data } : a,
      ),
    })),

  removeAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    })),

  selectAnnotation: (id) => set({ selectedId: id }),

  setDrawing: (drawing) => set({ drawing }),

  addDrawingPoint: (point) =>
    set((state) => ({
      drawingPoints: [...state.drawingPoints, point],
    })),

  setDrawingPoint: (index, point) =>
    set((state) => {
      const pts = [...state.drawingPoints];
      pts[index] = point;
      return { drawingPoints: pts };
    }),

  clearDrawing: () => set({ drawingPoints: [], drawing: false }),

  setLabelPosition: (id, labelPosition) =>
    set((state) => ({
      annotations: state.annotations.map((a) =>
        a.id === id ? { ...a, labelPosition } : a,
      ),
    })),
}));
