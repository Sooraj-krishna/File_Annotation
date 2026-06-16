/**
 * PageNavigation — prev/next and page-input controls.
 *
 * Renders a compact bar:
 *   [◀]  [42] of [128]  [▶]
 *
 * The input clamps to [1, totalPages]; invalid input resets to the
 * current page. Prev is disabled at page 1, next at the last page.
 */

import { useState, useEffect, useCallback } from "react";
import { useViewportStore } from "@/store/viewportStore";

const barStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 16px",
  background: "#f9fafb",
  borderBottom: "1px solid #e5e7eb",
  flexShrink: 0,
};

const btnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  border: "1px solid #d1d5db",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  fontSize: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#374151",
};

const btnDisabled: React.CSSProperties = {
  ...btnStyle,
  opacity: 0.4,
  cursor: "default",
};

const inputStyle: React.CSSProperties = {
  width: 48,
  height: 28,
  textAlign: "center",
  border: "1px solid #d1d5db",
  borderRadius: 4,
  fontSize: 13,
  fontFamily: "monospace",
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  userSelect: "none",
};

export function PageNavigation() {
  const currentPage = useViewportStore((s) => s.currentPage);
  const totalPages = useViewportStore((s) => s.totalPages);
  const setPage = useViewportStore((s) => s.setPage);

  const [input, setInput] = useState(String(currentPage));

  useEffect(() => setInput(String(currentPage)), [currentPage]);

  const submit = useCallback(() => {
    const p = parseInt(input, 10);
    if (p >= 1 && p <= totalPages) setPage(p);
    else setInput(String(currentPage));
  }, [input, currentPage, totalPages, setPage]);

  return (
    <div style={barStyle}>
      <button
        style={currentPage <= 1 ? btnDisabled : btnStyle}
        disabled={currentPage <= 1}
        title="Previous page"
        onClick={() => setPage(currentPage - 1)}
      >
        ◀
      </button>

      <input
        style={inputStyle}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onBlur={submit}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        aria-label="Page number"
      />

      <span style={labelStyle}>of {totalPages}</span>

      <button
        style={currentPage >= totalPages ? btnDisabled : btnStyle}
        disabled={currentPage >= totalPages}
        title="Next page"
        onClick={() => setPage(currentPage + 1)}
      >
        ▶
      </button>
    </div>
  );
}
