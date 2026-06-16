/**
 * Tests for the annotation store — CRUD, selection, drawing state.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useAnnotationStore } from "@/store/annotationStore";
import type { Annotation } from "@/shared/types";

const mockAnnotation = (id: string): Annotation => ({
  id,
  documentId: "doc-1",
  pageNumber: 1,
  label: "test",
  labelColor: null,
  annotationType: "extraction",
  points: [
    [0.1, 0.1],
    [0.3, 0.3],
  ],
  labelPosition: null,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
});

beforeEach(() => {
  useAnnotationStore.setState({
    annotations: [],
    selectedId: null,
    drawing: false,
    drawingPoints: [],
  });
});

describe("AnnotationStore", () => {
  it("starts empty", () => {
    const state = useAnnotationStore.getState();
    expect(state.annotations).toHaveLength(0);
    expect(state.selectedId).toBeNull();
    expect(state.drawing).toBe(false);
  });

  it("adds an annotation", () => {
    useAnnotationStore.getState().addAnnotation(mockAnnotation("a1"));
    expect(useAnnotationStore.getState().annotations).toHaveLength(1);
  });

  it("removes an annotation and clears selection", () => {
    const store = useAnnotationStore.getState();
    store.addAnnotation(mockAnnotation("a1"));
    store.selectAnnotation("a1");
    store.removeAnnotation("a1");
    const state = useAnnotationStore.getState();
    expect(state.annotations).toHaveLength(0);
    expect(state.selectedId).toBeNull();
  });

  it("updates an annotation", () => {
    const store = useAnnotationStore.getState();
    store.addAnnotation(mockAnnotation("a1"));
    store.updateAnnotation("a1", { label: "updated" });
    expect(useAnnotationStore.getState().annotations[0].label).toBe("updated");
  });

  it("manages drawing state", () => {
    const store = useAnnotationStore.getState();
    store.setDrawing(true);
    expect(useAnnotationStore.getState().drawing).toBe(true);

    store.addDrawingPoint([0.5, 0.5]);
    store.addDrawingPoint([0.6, 0.5]);
    expect(useAnnotationStore.getState().drawingPoints).toHaveLength(2);

    store.clearDrawing();
    expect(useAnnotationStore.getState().drawing).toBe(false);
    expect(useAnnotationStore.getState().drawingPoints).toHaveLength(0);
  });
});
