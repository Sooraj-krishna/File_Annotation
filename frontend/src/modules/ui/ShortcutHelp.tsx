/**
 * ShortcutHelp — modal listing all keyboard shortcuts.
 *
 * Triggered by pressing ? anywhere (handled by global listener
 * in the parent). Displays a simple overlay with the shortcut table.
 */

import { useEffect } from "react";

interface ShortcutHelpProps {
  onClose: () => void;
}

const shortcuts = [
  { key: "V", desc: "Select tool" },
  { key: "R", desc: "Rectangle draw tool" },
  { key: "Ctrl+Z", desc: "Undo" },
  { key: "Ctrl+Shift+Z", desc: "Redo" },
  { key: "Delete / Backspace", desc: "Delete selected annotation" },
  { key: "Escape", desc: "Deselect / cancel drawing" },
  { key: "?", desc: "Show this help" },
];

export function ShortcutHelp({ onClose }: ShortcutHelpProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") {
        // Don't close on ? if it re-triggers our own mount
        if (e.key === "Escape") onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.3)",
          zIndex: 9998,
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          zIndex: 9999,
          padding: 24,
          minWidth: 360,
          maxWidth: "90vw",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, color: "#111827" }}>
            Keyboard Shortcuts
          </h3>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 18,
              color: "#9ca3af",
              padding: 0,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
              <th
                style={{
                  textAlign: "left",
                  padding: "6px 12px",
                  fontSize: 12,
                  color: "#6b7280",
                  fontWeight: 600,
                }}
              >
                Key
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "6px 12px",
                  fontSize: 12,
                  color: "#6b7280",
                  fontWeight: 600,
                }}
              >
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {shortcuts.map((s) => (
              <tr key={s.key} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td
                  style={{
                    padding: "8px 12px",
                    fontFamily: "monospace",
                    fontSize: 13,
                    color: "#374151",
                    fontWeight: 600,
                  }}
                >
                  {s.key}
                </td>
                <td style={{ padding: "8px 12px", fontSize: 13, color: "#6b7280" }}>
                  {s.desc}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
