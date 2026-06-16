/**
 * Coordinate engine — transforms between screen pixels and normalized document space.
 *
 * This is the single most critical module in the frontend.
 * All annotation positions flow through these functions.
 *
 * All rectangle coordinates are stored in normalized space (0.0 to 1.0)
 * relative to page dimensions. This makes them zoom-safe, pan-safe,
 * and resolution-independent.
 *
 * Coordinate flow:
 *   Mouse click (screen px)  →  screenToDocument()  →  normalized [0-1]
 *   Normalized [0-1]         →  documentToScreen()   →  render position (screen px)
 */

/**
 * Page dimensions in points (PDF internal unit).
 * Obtained from PDF.js via pdfPage.getViewport({ scale: 1 }).
 */
export interface PageDimensions {
  width: number;
  height: number;
}

/** Current viewport state (zoom + pan). */
export interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
}

/**
 * Convert a screen pixel position to a normalized document coordinate.
 *
 * Inverse of documentToScreen. Used when the user clicks or drags
 * on the Konva stage to determine where in document space the
 * interaction occurred.
 *
 * The Konva stage is sized at page.width * zoom × page.height * zoom.
 * Pan is handled externally via CSS transform on the container and is
 * NOT included in these transforms — stage coordinates are already in
 * the panned space.
 *
 * @param screenX - Mouse X in Stage pixels (page.width * zoom range).
 * @param screenY - Mouse Y in Stage pixels (page.height * zoom range).
 * @param page - Dimensions of the PDF page in points.
 * @param viewport - Current zoom and pan state (only zoom is used).
 * @returns Normalized [x, y] where each value is in [0.0, 1.0].
 */
export function screenToDocument(
  screenX: number,
  screenY: number,
  page: PageDimensions,
  viewport: ViewportState,
): [number, number] {
  const docX = screenX / viewport.zoom;
  const docY = screenY / viewport.zoom;
  return [
    docX / (page.width || 1),
    docY / (page.height || 1),
  ];
}

/**
 * Convert a normalized document coordinate to a screen pixel position
 * in the Konva stage's coordinate space.
 *
 * Used when rendering annotations — takes stored coordinates
 * and computes where they should appear on the stage given
 * the current zoom.
 *
 * @param normX - Normalized X in [0.0, 1.0].
 * @param normY - Normalized Y in [0.0, 1.0].
 * @param page - Dimensions of the PDF page in points.
 * @param viewport - Current zoom and pan state (only zoom is used).
 * @returns Stage [x, y] in pixels (page.size * zoom range).
 */
export function documentToScreen(
  normX: number,
  normY: number,
  page: PageDimensions,
  viewport: ViewportState,
): [number, number] {
  const pageX = normX * page.width;
  const pageY = normY * page.height;
  return [
    pageX * viewport.zoom,
    pageY * viewport.zoom,
  ];
}

/**
 * Convert a pixel coordinate to normalized space.
 *
 * @param pixel - The pixel value to convert.
 * @param dimension - The page dimension (width or height) in points.
 * @returns A value in [0.0, 1.0], or 0.0 if dimension is zero.
 */
export function normalize(pixel: number, dimension: number): number {
  if (dimension === 0) return 0.0;
  return pixel / dimension;
}

/**
 * Convert a normalized coordinate back to pixel space.
 *
 * @param value - Normalized value in [0.0, 1.0].
 * @param dimension - The page dimension (width or height) in points.
 * @returns The pixel value.
 */
export function denormalize(value: number, dimension: number): number {
  return value * dimension;
}
