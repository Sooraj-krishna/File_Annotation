/**
 * Tests for the viewport store — zoom limits, page navigation, reset.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useViewportStore } from "@/store/viewportStore";

beforeEach(() => {
  useViewportStore.setState({
    zoom: 1.0,
    panX: 0,
    panY: 0,
    currentPage: 1,
    totalPages: 10,
  });
});

describe("ViewportStore", () => {
  it("starts at 100% zoom, no pan, page 1", () => {
    const state = useViewportStore.getState();
    expect(state.zoom).toBe(1.0);
    expect(state.panX).toBe(0);
    expect(state.panY).toBe(0);
    expect(state.currentPage).toBe(1);
  });

  it("clamps zoom within [0.1, 5.0]", () => {
    useViewportStore.getState().setZoom(0.01);
    expect(useViewportStore.getState().zoom).toBe(0.1);

    useViewportStore.getState().setZoom(10.0);
    expect(useViewportStore.getState().zoom).toBe(5.0);
  });

  it("zooms in by ZOOM_STEP factor", () => {
    useViewportStore.getState().zoomIn();
    expect(useViewportStore.getState().zoom).toBeGreaterThan(1.0);
  });

  it("zooms out by ZOOM_STEP factor", () => {
    useViewportStore.getState().zoomOut();
    expect(useViewportStore.getState().zoom).toBeLessThan(1.0);
  });

  it("clamps page within [1, totalPages]", () => {
    useViewportStore.getState().setPage(0);
    expect(useViewportStore.getState().currentPage).toBe(1);

    useViewportStore.getState().setPage(100);
    expect(useViewportStore.getState().currentPage).toBe(10);
  });

  it("resets pan when changing pages", () => {
    useViewportStore.getState().setPan(100, 200);
    useViewportStore.getState().setPage(3);
    expect(useViewportStore.getState().panX).toBe(0);
    expect(useViewportStore.getState().panY).toBe(0);
  });

  it("resetView restores zoom to 100% and pan to zero", () => {
    useViewportStore.getState().setZoom(2.5);
    useViewportStore.getState().setPan(50, 100);
    useViewportStore.getState().resetView();
    expect(useViewportStore.getState().zoom).toBe(1.0);
    expect(useViewportStore.getState().panX).toBe(0);
    expect(useViewportStore.getState().panY).toBe(0);
  });
});
