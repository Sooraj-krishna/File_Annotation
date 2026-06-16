/**
 * ViewportControls — floating zoom controls overlay.
 *
 * Renders in the bottom-right corner of the PDF viewport:
 *   [−]  [150%]  [+]  [⛶ fit]
 *
 * The fit-to-page button requires the parent to provide
 * a callback that knows the container and page dimensions.
 */

import { useViewportStore } from "@/store/viewportStore";
import { ZOOM_MIN, ZOOM_MAX } from "@/shared/constants";

interface ViewportControlsProps {
  /** Called when the user clicks "fit to page". */
  onFitToPage?: () => void;
}

const btnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  border: "1px solid #d1d5db",
  borderRadius: 8,
  background: "#fff",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 16,
  lineHeight: 1,
  color: "#374151",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  transition: "all 0.12s",
};

const containerStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 16,
  right: 16,
  display: "flex",
  alignItems: "center",
  gap: 6,
  zIndex: 10,
  pointerEvents: "auto",
  background: "rgba(255,255,255,0.95)",
  padding: "6px 8px",
  borderRadius: 12,
  boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
  backdropFilter: "blur(8px)",
};

const labelStyle: React.CSSProperties = {
  minWidth: 48,
  textAlign: "center",
  fontSize: 13,
  fontFamily: "monospace",
  color: "#374151",
  userSelect: "none",
  fontWeight: 500,
};

export function ViewportControls({ onFitToPage }: ViewportControlsProps) {
  const zoom = useViewportStore((s) => s.zoom);
  const setZoom = useViewportStore((s) => s.setZoom);

  return (
    <div style={containerStyle}>
      <button
        style={btnStyle}
        title="Zoom out"
        onClick={() => setZoom(zoom / 1.15)}
        disabled={zoom <= ZOOM_MIN}
      >
        −
      </button>
      <span style={labelStyle}>{Math.round(zoom * 100)}%</span>
      <button
        style={btnStyle}
        title="Zoom in"
        onClick={() => setZoom(zoom * 1.15)}
        disabled={zoom >= ZOOM_MAX}
      >
        +
      </button>
      {onFitToPage && (
        <button
          style={{ ...btnStyle, width: "auto", padding: "0 10px", fontSize: 13 }}
          title="Fit page to viewport"
          onClick={onFitToPage}
        >
          ⛶ fit
        </button>
      )}
    </div>
  );
}
