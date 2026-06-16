/**
 * Application-wide constants for tunable parameters.
 *
 * Centralizing these values prevents magic numbers scattered
 * across components and makes it easy to adjust behavior.
 */

/** Minimum zoom level (10%). */
export const ZOOM_MIN = 0.1;

/** Maximum zoom level (500%). */
export const ZOOM_MAX = 5.0;

/** Multiplier per scroll tick for zoom in/out. */
export const ZOOM_STEP = 1.15;

/** Sensitivity of the scroll wheel for zoom. */
export const ZOOM_WHEEL_SENSITIVITY = 0.001;

/** Maximum number of undo steps in the history stack. */
export const HISTORY_MAX_DEPTH = 50;

/** Debounce delay in ms for autosave during drag operations. */
export const DEBOUNCE_SAVE_MS = 300;

/** Base URL for the API. Uses VITE_API_BASE env var or defaults to /api (dev proxy). */
export const API_BASE = import.meta.env.VITE_API_BASE || "/api";
