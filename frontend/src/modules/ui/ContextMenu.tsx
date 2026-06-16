/**
 * ContextMenu — right-click menu for annotations.
 *
 * Rendered as a fixed-position overlay at the mouse cursor.
 * Closes on: menu action, click outside, Escape, or scroll.
 * Provides "Edit label" and "Delete" options.
 */

import { useEffect, useRef } from "react";

interface ContextMenuProps {
  x: number;
  y: number;
  onEditLabel: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 999,
};

const menuStyle: React.CSSProperties = {
  position: "fixed",
  zIndex: 1000,
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
  minWidth: 150,
  padding: "4px 0",
  overflow: "hidden",
};

const itemStyle: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: 13,
  color: "#111827",
  cursor: "pointer",
  border: "none",
  background: "none",
  width: "100%",
  textAlign: "left",
  display: "block",
};

export function ContextMenu({
  x,
  y,
  onEditLabel,
  onDelete,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Prevent browser context menu inside our menu
  useEffect(() => {
    const prevent = (e: MouseEvent) => e.preventDefault();
    const el = menuRef.current;
    if (!el) return;
    el.addEventListener("contextmenu", prevent);
    return () => el.removeEventListener("contextmenu", prevent);
  }, []);

  // Clamp position so menu stays inside viewport
  const menuWidth = 170;
  const menuHeight = 80;
  const clampedX = Math.min(x, window.innerWidth - menuWidth - 8);
  const clampedY = Math.min(y, window.innerHeight - menuHeight - 8);

  return (
    <>
      <div style={overlayStyle} onClick={onClose} />
      <div
        ref={menuRef}
        style={{ ...menuStyle, left: clampedX, top: clampedY }}
      >
        <button
          style={itemStyle}
          onClick={() => {
            onEditLabel();
            onClose();
          }}
        >
          ✏ Edit label
        </button>
        <button
          style={{ ...itemStyle, color: "#dc2626" }}
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          🗑 Delete
        </button>
      </div>
    </>
  );
}
