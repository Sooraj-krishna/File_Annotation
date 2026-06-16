import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Toolbar } from "./Toolbar";
import { useUIStore } from "@/store/uiStore";
import { useHistoryStore } from "@/store/historyStore";
import { useAnnotationStore } from "@/store/annotationStore";
import { useNotificationStore } from "@/store/notificationStore";
vi.mock("@/api/documents", () => ({
  uploadDocument: vi.fn(),
}));

beforeEach(() => {
  useUIStore.setState({
    activeTool: "select",
    saveStatus: "idle",
    pdfSaveStatus: "idle",
    pdfSaveProgress: 0,
  });
  useHistoryStore.setState({
    past: [],
    future: [],
    pendingCommand: null,
  });
  useAnnotationStore.setState({
    annotations: [],
    selectedId: null,
    drawing: false,
    drawingPoints: [],
  });
  useNotificationStore.setState({ notifications: [] });
  vi.restoreAllMocks();
});

describe("Toolbar", () => {
  it("renders both tool buttons", () => {
    render(<Toolbar />);
    expect(screen.getByTitle("Select tool — press V")).toBeTruthy();
    expect(screen.getByTitle("Rectangle tool — press R")).toBeTruthy();
  });

  it("shows keyboard hints for tool buttons", () => {
    render(<Toolbar />);
    expect(screen.getByText("V")).toBeTruthy();
    expect(screen.getByText("R")).toBeTruthy();
  });

  it("highlights the active tool", () => {
    useUIStore.setState({ activeTool: "draw-rectangle" });
    render(<Toolbar />);
    const rectBtn = screen.getByTitle("Rectangle tool — press R");
    expect(rectBtn.style.background).toContain("F59E0B");
  });

  it("does not highlight inactive tools", () => {
    useUIStore.setState({ activeTool: "select" });
    render(<Toolbar />);
    const rectBtn = screen.getByTitle("Rectangle tool — press R");
    expect(rectBtn.style.background).toBe("rgb(255, 255, 255)");
  });

  it("changes active tool on click", () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByTitle("Rectangle tool — press R"));
    expect(useUIStore.getState().activeTool).toBe("draw-rectangle");
  });

  it("disables undo button when past is empty", () => {
    render(<Toolbar />);
    const undoBtn = screen.getByTitle("Undo (Ctrl+Z)") as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(true);
  });

  it("enables undo button when past has items", () => {
    useHistoryStore.setState({ past: [{} as any] });
    render(<Toolbar />);
    const undoBtn = screen.getByTitle("Undo (Ctrl+Z)") as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(false);
  });

  it("disables redo button when future is empty", () => {
    render(<Toolbar />);
    const redoBtn = screen.getByTitle("Redo (Ctrl+Shift+Z)") as HTMLButtonElement;
    expect(redoBtn.disabled).toBe(true);
  });

  it("enables redo button when future has items", () => {
    useHistoryStore.setState({ future: [{} as any] });
    render(<Toolbar />);
    const redoBtn = screen.getByTitle("Redo (Ctrl+Shift+Z)") as HTMLButtonElement;
    expect(redoBtn.disabled).toBe(false);
  });
});
