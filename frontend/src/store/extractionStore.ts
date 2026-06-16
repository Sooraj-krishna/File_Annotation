/**
 * Extraction store — state for AI-powered label-value extraction.
 *
 * Tracks the extraction lifecycle separate from annotation/UI state
 * to avoid unnecessary re-renders of unrelated components.
 */

import { create } from "zustand";
import type { ExtractedItem } from "@/shared/types";

interface ExtractionState {
  /** Extracted label-value pairs, or null if no extraction has been done. */
  extractedData: ExtractedItem[] | null;
  /** Whether an extraction is currently in progress. */
  extracting: boolean;
  /** Human-readable error message, or null. */
  extractError: string | null;
  /** Whether a report PDF is being generated. */
  generating: boolean;

  setExtractedData: (data: ExtractedItem[] | null) => void;
  setExtracting: (v: boolean) => void;
  setExtractError: (err: string | null) => void;
  setGenerating: (v: boolean) => void;
  /** Clear all extraction state (used before re-extraction). */
  reset: () => void;
}

export const useExtractionStore = create<ExtractionState>((set) => ({
  extractedData: null,
  extracting: false,
  extractError: null,
  generating: false,

  setExtractedData: (extractedData) => set({ extractedData }),
  setExtracting: (extracting) => set({ extracting }),
  setExtractError: (extractError) => set({ extractError }),
  setGenerating: (generating) => set({ generating }),

  reset: () =>
    set({
      extractedData: null,
      extracting: false,
      extractError: null,
      generating: false,
    }),
}));
