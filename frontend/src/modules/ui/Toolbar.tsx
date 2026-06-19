import { useAnnotationStore } from "@/store/annotationStore";
import { useUIStore } from "@/store/uiStore";
import { useHistoryStore } from "@/store/historyStore";
import type { Tool } from "@/shared/types";

const BTN_SIZE = 42;

const groupStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  padding: "16px 16px 12px",
};

const btnBase: React.CSSProperties = {
  width: BTN_SIZE,
  height: BTN_SIZE,
  borderRadius: "50%",
  border: "1px solid var(--border)",
  background: "var(--bg-primary)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  color: "var(--text-secondary)",
  transition: "all 0.15s",
  position: "relative",
};

const btnSelectActive: React.CSSProperties = {
  ...btnBase,
  background: "linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-blue-hover) 100%)",
  color: "#fff",
  border: "1px solid var(--accent-blue-hover)",
};

const btnRectActive: React.CSSProperties = {
  ...btnBase,
  background: "linear-gradient(135deg, var(--accent-gold) 0%, var(--accent-gold-hover) 100%)",
  color: "#fff",
  border: "1px solid var(--accent-gold-hover)",
};

const btnDisabled: React.CSSProperties = {
  ...btnBase,
  opacity: 0.3,
  cursor: "default",
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
};

const kbdBadge: React.CSSProperties = {
  position: "absolute",
  bottom: -4,
  right: -4,
  fontSize: 9,
  fontWeight: 700,
  background: "var(--bg-tertiary)",
  color: "var(--text-secondary)",
  border: "1px solid var(--border-light)",
  borderRadius: 6,
  padding: "0 4px",
  lineHeight: "14px",
  height: 14,
  minWidth: 14,
  textAlign: "center",
};

const separator: React.CSSProperties = {
  width: 1,
  height: 24,
  background: "var(--border)",
  flexShrink: 0,
};

const tools: { tool: Tool; icon: string; key: string }[] = [
  { tool: "select", icon: "⬚", key: "V" },
  { tool: "draw-rectangle", icon: "▭", key: "R" },
];

export function Toolbar() {
  const activeTool = useUIStore((s) => s.activeTool);
  const setActiveTool = useUIStore((s) => s.setActiveTool);
  const past = useHistoryStore((s) => s.past);
  const future = useHistoryStore((s) => s.future);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);

  const handleToolClick = (tool: Tool) => {
    useAnnotationStore.getState().clearDrawing();
    setActiveTool(tool);
  };

  const toolBtnStyle = (tool: Tool) => {
    if (activeTool !== tool) return btnBase;
    return tool === "select" ? btnSelectActive : btnRectActive;
  };

  return (
    <div style={groupStyle}>
      {tools.map(({ tool, icon, key }) => (
        <button
          key={tool}
          style={toolBtnStyle(tool)}
          onClick={() => handleToolClick(tool)}
          title={`${tool === "select" ? "Select" : "Rectangle"} tool — press ${key}`}
        >
          <span>{icon}</span>
          <span style={kbdBadge}>{key}</span>
        </button>
      ))}
      <div style={separator} />
      <button
        style={past.length === 0 ? btnDisabled : btnBase}
        disabled={past.length === 0}
        onClick={() => undo()}
        title="Undo (Ctrl+Z)"
      >
        ↩
      </button>
      <button
        style={future.length === 0 ? btnDisabled : btnBase}
        disabled={future.length === 0}
        onClick={() => redo()}
        title="Redo (Ctrl+Shift+Z)"
      >
        ↪
      </button>
    </div>
  );
}
