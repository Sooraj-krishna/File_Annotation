/**
 * Tests for the coordinate engine — pure math, no DOM dependencies.
 *
 * These are the most important tests in the frontend. If any
 * of these fail, every annotation in the system will render
 * in the wrong position.
 */

import { describe, it, expect } from "vitest";
import {
  screenToDocument,
  documentToScreen,
  normalize,
  denormalize,
} from "./coordinateEngine";
import type { PageDimensions, ViewportState } from "./coordinateEngine";

const letterPage: PageDimensions = { width: 612, height: 792 };

const identityViewport: ViewportState = { zoom: 1.0, panX: 0, panY: 0 };

describe("screenToDocument", () => {
  it("identity: screen center maps to document center at 100% zoom", () => {
    const result = screenToDocument(306, 396, letterPage, identityViewport);
    expect(result[0]).toBeCloseTo(0.5, 5);
    expect(result[1]).toBeCloseTo(0.5, 5);
  });

  it("screen top-left maps to document top-left", () => {
    const result = screenToDocument(0, 0, letterPage, identityViewport);
    expect(result[0]).toBeCloseTo(0, 5);
    expect(result[1]).toBeCloseTo(0, 5);
  });

  it("screen bottom-right maps to document bottom-right at 100%", () => {
    const result = screenToDocument(612, 792, letterPage, identityViewport);
    expect(result[0]).toBeCloseTo(1.0, 5);
    expect(result[1]).toBeCloseTo(1.0, 5);
  });

  it("zoom 2x: same screen click maps to half the document coordinate", () => {
    const zoomed: ViewportState = { zoom: 2.0, panX: 0, panY: 0 };
    const result = screenToDocument(612, 0, letterPage, zoomed);
    expect(result[0]).toBeCloseTo(0.5, 5);
  });
});

describe("documentToScreen", () => {
  it("identity: document center maps to screen center at 100% zoom", () => {
    const result = documentToScreen(0.5, 0.5, letterPage, identityViewport);
    expect(result[0]).toBeCloseTo(306, 0);
    expect(result[1]).toBeCloseTo(396, 0);
  });

  it("document top-left maps to screen top-left", () => {
    const result = documentToScreen(0, 0, letterPage, identityViewport);
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0);
  });

  it("zoom 2x: document coordinate renders at 2x screen distance", () => {
    const zoomed: ViewportState = { zoom: 2.0, panX: 0, panY: 0 };
    const result = documentToScreen(0.5, 0.5, letterPage, zoomed);
    expect(result[0]).toBeCloseTo(612, 0);
    expect(result[1]).toBeCloseTo(792, 0);
  });
});

describe("round-trip: screenToDocument -> documentToScreen", () => {
  const viewports: ViewportState[] = [
    { zoom: 1.0, panX: 0, panY: 0 },
    { zoom: 2.0, panX: 0, panY: 0 },
    { zoom: 0.5, panX: 0, panY: 0 },
    { zoom: 5.0, panX: 0, panY: 0 },
  ];

  viewports.forEach((vp, i) => {
    it(`round-trips correctly at viewport config ${i}`, () => {
      const screenX = 350;
      const screenY = 420;
      const doc = screenToDocument(screenX, screenY, letterPage, vp);
      const screenBack = documentToScreen(doc[0], doc[1], letterPage, vp);
      expect(screenBack[0]).toBeCloseTo(screenX, 5);
      expect(screenBack[1]).toBeCloseTo(screenY, 5);
    });
  });

  it("500% zoom success criterion", () => {
    const maxZoom: ViewportState = { zoom: 5.0, panX: 0, panY: 0 };
    const screenX = 100;
    const screenY = 200;
    const doc = screenToDocument(screenX, screenY, letterPage, maxZoom);
    const screenBack = documentToScreen(doc[0], doc[1], letterPage, maxZoom);
    expect(screenBack[0]).toBeCloseTo(screenX, 5);
    expect(screenBack[1]).toBeCloseTo(screenY, 5);
  });
});

describe("normalize / denormalize", () => {
  it("normalizes a pixel value to 0-1 range", () => {
    expect(normalize(306, 612)).toBeCloseTo(0.5, 5);
  });

  it("denormalizes back to the original pixel value", () => {
    expect(denormalize(0.5, 612)).toBeCloseTo(306, 5);
  });

  it("round-trips correctly", () => {
    const pixel = 150;
    const dim = 612;
    const norm = normalize(pixel, dim);
    const back = denormalize(norm, dim);
    expect(back).toBeCloseTo(pixel, 10);
  });

  it("returns 0 when dimension is 0", () => {
    expect(normalize(100, 0)).toBe(0);
  });
});
