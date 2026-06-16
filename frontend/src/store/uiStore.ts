/**
 * UI store — manages toolbar state, save progress, and PDF generation progress.
 *
 * Keeps UI-specific state separate from domain state (annotations,
 * viewport) to prevent unnecessary re-renders when the other
 * categories change.
 */

import { create } from "zustand";
import type { Tool } from "@/shared/types";

interface UIState {
  /** Currently active tool in the toolbar. */
  activeTool: Tool;
  /** Status of the annotation data save. */
  saveStatus: "idle" | "saving" | "completed" | "failed";
  /** Progress percentage (0-100) of the annotation data save. */
  saveProgress: number;
  /** Status of the annotated PDF generation. */
  pdfSaveStatus: "idle" | "saving" | "completed" | "failed";
  /** Progress percentage (0-100) of the PDF generation. */
  pdfSaveProgress: number;
  /** Page to scroll to in the PDF viewer (set by sidebar label click). */
  scrollTargetPage: number | null;

  setActiveTool: (tool: Tool) => void;
  setSaveStatus: (status: UIState["saveStatus"], progress?: number) => void;
  setPdfSaveStatus: (status: UIState["pdfSaveStatus"], progress?: number) => void;
  setScrollTargetPage: (page: number | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTool: "select",
  saveStatus: "idle",
  saveProgress: 0,
  pdfSaveStatus: "idle",
  pdfSaveProgress: 0,
  scrollTargetPage: null,

  setActiveTool: (activeTool) => set({ activeTool }),

  setSaveStatus: (saveStatus, progress) =>
    set({
      saveStatus,
      saveProgress: progress ?? (saveStatus === "completed" ? 100 : 0),
    }),

  setPdfSaveStatus: (pdfSaveStatus, progress) =>
    set({
      pdfSaveStatus,
      pdfSaveProgress: progress ?? (pdfSaveStatus === "completed" ? 100 : 0),
    }),

  setScrollTargetPage: (scrollTargetPage) => set({ scrollTargetPage }),
}));
