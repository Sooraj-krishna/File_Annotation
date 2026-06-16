/**
 * History store — undo/redo stack with drag coalescing.
 *
 * Stores before/after snapshots of only the affected annotation.
 * During drag operations, startCommand/endCommand coalesce many
 * intermediate states into a single undo step:
 *
 *   mousedown → startCommand(id, { labelPosition: old })  // saves "before"
 *   mousemove → setLabelPosition(...)                      // suppressed
 *   mouseup   → endCommand(id, { labelPosition: new })     // pushes Command
 */

import { create } from "zustand";
import type { Annotation, Command } from "@/shared/types";
import { HISTORY_MAX_DEPTH } from "@/shared/constants";
import { useAnnotationStore } from "./annotationStore";

interface HistoryState {
  /** Commands that can be undone (most recent at end). */
  past: Command[];
  /** Commands that can be redone (most recent at end). */
  future: Command[];

  /**
   * Pending "before" snapshot during an active drag gesture.
   * Exists between startCommand() and endCommand().
   */
  pendingCommand: {
    annotationId: string;
    before: Partial<Annotation>;
  } | null;

  /** Push a fully-formed command onto the undo stack. */
  pushCommand: (command: Command) => void;
  /**
   * Begin a drag/gesture: saves the "before" state.
   * If called while a pending command already exists (nested),
   * the new snapshot replaces the old one (last-known-good before).
   */
  startCommand: (
    annotationId: string,
    beforeSnapshot: Partial<Annotation>,
  ) => void;
  /**
   * End a drag/gesture: creates a Command from the saved "before"
   * and the provided "after", pushes onto the stack, and clears
   * the pending state. Returns the pushed command or null if no
   * gesture was active.
   */
  endCommand: (annotationId: string, afterSnapshot: Partial<Annotation>) => Command | null;
  /** Cancel a pending gesture without pushing anything. */
  cancelCommand: () => void;

  /** Undo the most recent command. Returns the command that was undone. */
  undo: () => Command | null;
  /** Redo the most recently undone command. */
  redo: () => Command | null;
  /** Clear the entire history stack. */
  clear: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  pendingCommand: null,

  pushCommand: (command: Command) =>
    set((state) => ({
      past: [...state.past.slice(-HISTORY_MAX_DEPTH + 1), command],
      future: [],
      pendingCommand: null, // any pending gesture is superseded
    })),

  startCommand: (annotationId, beforeSnapshot) => {
    set({ pendingCommand: { annotationId, before: beforeSnapshot } });
  },

  endCommand: (annotationId, afterSnapshot) => {
    const { pendingCommand } = get();
    if (!pendingCommand || pendingCommand.annotationId !== annotationId) {
      return null;
    }

    const command: Command = {
      type: "move-rectangle",
      annotationId,
      before: pendingCommand.before,
      after: afterSnapshot,
    };

    set((state) => ({
      past: [...state.past.slice(-HISTORY_MAX_DEPTH + 1), command],
      future: [],
      pendingCommand: null,
    }));

    return command;
  },

  cancelCommand: () => set({ pendingCommand: null }),

  undo: () => {
    const { past } = get();
    if (past.length === 0) return null;

    const command = past[past.length - 1];
    const newPast = past.slice(0, -1);

    if (command.after === null && command.before) {
      // Delete undone — re-add the annotation from the before snapshot
      useAnnotationStore
        .getState()
        .addAnnotation(command.before as Annotation);
      useAnnotationStore.getState().selectAnnotation(command.annotationId);
    } else if (command.before === null && command.after) {
      // Create undone — remove the annotation
      useAnnotationStore.getState().selectAnnotation(null);
      useAnnotationStore.getState().removeAnnotation(command.annotationId);
    } else {
      // Regular undo — restore the before snapshot
      useAnnotationStore.getState().updateAnnotation(command.annotationId, {
        ...command.before,
      } as Partial<Annotation>);
    }

    set({ past: newPast, future: [...get().future, command] });
    return command;
  },

  redo: () => {
    const { future } = get();
    if (future.length === 0) return null;

    const command = future[future.length - 1];
    const newFuture = future.slice(0, -1);

    if (command.before === null && command.after) {
      // Create redone — re-add the annotation
      useAnnotationStore
        .getState()
        .addAnnotation(command.after as Annotation);
      useAnnotationStore.getState().selectAnnotation(command.annotationId);
    } else if (command.after === null && command.before) {
      // Delete redone — remove the annotation
      useAnnotationStore.getState().selectAnnotation(null);
      useAnnotationStore.getState().removeAnnotation(command.annotationId);
    } else {
      // Regular redo — apply the after snapshot
      useAnnotationStore.getState().updateAnnotation(command.annotationId, {
        ...command.after,
      } as Partial<Annotation>);
    }

    set({ past: [...get().past, command], future: newFuture });
    return command;
  },

  clear: () => set({ past: [], future: [], pendingCommand: null }),
}));
