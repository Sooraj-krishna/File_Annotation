/**
 * Tests for the history store — undo/redo with correct state restoration,
 * drag coalescing via startCommand/endCommand, and cancelCommand.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useHistoryStore } from "@/store/historyStore";
import { useAnnotationStore } from "@/store/annotationStore";
import type { Annotation, Command } from "@/shared/types";

const mockAnnotation = (id: string): Annotation => ({
  id,
  documentId: "doc-1",
  pageNumber: 1,
  label: "original",
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
  useHistoryStore.setState({ past: [], future: [], pendingCommand: null });
  useAnnotationStore.setState({
    annotations: [],
    selectedId: null,
    drawing: false,
    drawingPoints: [],
  });
});

describe("HistoryStore", () => {
  it("starts with empty stacks", () => {
    const state = useHistoryStore.getState();
    expect(state.past).toHaveLength(0);
    expect(state.future).toHaveLength(0);
    expect(state.pendingCommand).toBeNull();
  });

  it("pushes a command to the past stack", () => {
    const cmd: Command = {
      type: "rename-label",
      annotationId: "a1",
      before: { label: "old" },
      after: { label: "new" },
    };
    useHistoryStore.getState().pushCommand(cmd);
    expect(useHistoryStore.getState().past).toHaveLength(1);
    expect(useHistoryStore.getState().future).toHaveLength(0);
  });

  it("pushCommand clears pending command", () => {
    useHistoryStore.getState().startCommand("a1", { label: "old" });
    expect(useHistoryStore.getState().pendingCommand).not.toBeNull();

    useHistoryStore.getState().pushCommand({
      type: "rename-label",
      annotationId: "a1",
      before: { label: "old" },
      after: { label: "new" },
    });
    expect(useHistoryStore.getState().pendingCommand).toBeNull();
  });

  it("undo restores the before snapshot", () => {
    useAnnotationStore.getState().addAnnotation(mockAnnotation("a1"));

    const cmd: Command = {
      type: "rename-label",
      annotationId: "a1",
      before: { label: "old" },
      after: { label: "new" },
    };
    useHistoryStore.getState().pushCommand(cmd);
    useAnnotationStore.getState().updateAnnotation("a1", { label: "new" });

    useHistoryStore.getState().undo();
    const label = useAnnotationStore.getState().annotations.find(
      (a) => a.id === "a1",
    )?.label;
    expect(label).toBe("old");
  });

  it("redo re-applies the after snapshot", () => {
    useAnnotationStore.getState().addAnnotation(mockAnnotation("a1"));

    const cmd: Command = {
      type: "rename-label",
      annotationId: "a1",
      before: { label: "old" },
      after: { label: "new" },
    };
    useHistoryStore.getState().pushCommand(cmd);
    useAnnotationStore.getState().updateAnnotation("a1", { label: "new" });

    useHistoryStore.getState().undo();
    useHistoryStore.getState().redo();
    const label = useAnnotationStore.getState().annotations.find(
      (a) => a.id === "a1",
    )?.label;
    expect(label).toBe("new");
  });

  it("startCommand sets pending command", () => {
    useHistoryStore.getState().startCommand("a1", {
      labelPosition: { x: 0.5, y: 0.5 },
    });
    const pc = useHistoryStore.getState().pendingCommand;
    expect(pc).not.toBeNull();
    expect(pc!.annotationId).toBe("a1");
    expect(pc!.before).toEqual({ labelPosition: { x: 0.5, y: 0.5 } });
  });

  it("endCommand creates a coalesced command and clears pending", () => {
    useAnnotationStore.getState().addAnnotation(mockAnnotation("a1"));

    useHistoryStore.getState().startCommand("a1", {
      labelPosition: { x: 0.1, y: 0.1 },
    });
    const result = useHistoryStore.getState().endCommand("a1", {
      labelPosition: { x: 0.9, y: 0.9 },
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe("move-rectangle");
    expect(result!.before).toEqual({ labelPosition: { x: 0.1, y: 0.1 } });
    expect(result!.after).toEqual({ labelPosition: { x: 0.9, y: 0.9 } });

    expect(useHistoryStore.getState().pendingCommand).toBeNull();
    expect(useHistoryStore.getState().past).toHaveLength(1);
  });

  it("endCommand returns null when no pending command", () => {
    const result = useHistoryStore.getState().endCommand("a1", {
      labelPosition: { x: 0.5, y: 0.5 },
    });
    expect(result).toBeNull();
  });

  it("cancelCommand clears pending without pushing", () => {
    useHistoryStore.getState().startCommand("a1", {
      labelPosition: { x: 0.1, y: 0.1 },
    });
    useHistoryStore.getState().cancelCommand();
    expect(useHistoryStore.getState().pendingCommand).toBeNull();
    expect(useHistoryStore.getState().past).toHaveLength(0);
  });

  it("clear wipes both stacks and pending", () => {
    useHistoryStore.getState().startCommand("a1", { label: "old" });
    useHistoryStore.getState().pushCommand({
      type: "create",
      annotationId: "a1",
      before: null,
      after: { label: "test" },
    });
    useHistoryStore.getState().clear();
    expect(useHistoryStore.getState().past).toHaveLength(0);
    expect(useHistoryStore.getState().future).toHaveLength(0);
    expect(useHistoryStore.getState().pendingCommand).toBeNull();
  });

  it("undo on deleted annotation restores it", () => {
    const ann = mockAnnotation("a1");
    useAnnotationStore.getState().addAnnotation(ann);

    useHistoryStore.getState().pushCommand({
      type: "delete",
      annotationId: "a1",
      before: { ...ann } as Partial<Annotation>,
      after: null,
    });
    useAnnotationStore.getState().removeAnnotation("a1");

    expect(
      useAnnotationStore.getState().annotations.find((a) => a.id === "a1"),
    ).toBeUndefined();

    useHistoryStore.getState().undo();
    const restored = useAnnotationStore.getState().annotations.find(
      (a) => a.id === "a1",
    );
    expect(restored).not.toBeUndefined();
    expect(restored!.label).toBe("original");
  });

  it("redo on create re-adds the annotation", () => {
    const ann = mockAnnotation("a1");
    useAnnotationStore.getState().addAnnotation(ann);

    // Save a delete command, undo it, then redo
    useHistoryStore.getState().pushCommand({
      type: "delete",
      annotationId: "a1",
      before: { ...ann } as Partial<Annotation>,
      after: null,
    });
    useAnnotationStore.getState().removeAnnotation("a1");

    useHistoryStore.getState().undo(); // re-adds a1
    expect(
      useAnnotationStore.getState().annotations.find((a) => a.id === "a1"),
    ).not.toBeUndefined();

    useHistoryStore.getState().redo(); // removes a1 again
    expect(
      useAnnotationStore.getState().annotations.find((a) => a.id === "a1"),
    ).toBeUndefined();
  });
});
