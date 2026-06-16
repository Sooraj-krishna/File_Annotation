/**
 * Viewport interaction — wheel zoom toward cursor + drag-to-pan.
 *
 * Wheel zoom:
 *   Attaches to the outer viewport container. Zooms toward the cursor
 *   position by adjusting both zoom and pan so the point under the
 *   cursor remains fixed on screen.
 *
 * Pan drag:
 *   Returns Stage-level event handlers. When `activeTool === "pan"`,
 *   mousedown/mousemove/mouseup delta-track the pointer and update
 *   panX/panY accordingly. Handlers are stable references (use refs
 *   internally) so they don't cause unnecessary re-renders.
 */

import { useEffect, useRef } from "react";
import { useViewportStore } from "@/store/viewportStore";
import { useUIStore } from "@/store/uiStore";
import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from "@/shared/constants";

interface PanHandlers {
  onMouseDown: (e: any) => void;
  onMouseMove: (e: any) => void;
  onMouseUp: () => void;
}

export function useViewportInteraction(
  viewportRef: React.RefObject<HTMLDivElement | null>,
): { panHandlers: PanHandlers } {
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  /* ── Wheel zoom toward cursor ── */

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const { zoom, panX, panY } = useViewportStore.getState();
      const delta = -e.deltaY;

      // Exponential scale: 1.15^(delta/100) ≈ 1.14x per mouse notch
      const scale = Math.pow(ZOOM_STEP, delta / 100);
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * scale));

      // Keep the point under the cursor fixed
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      const newPanX = cx - (cx - panX) * (newZoom / zoom);
      const newPanY = cy - (cy - panY) * (newZoom / zoom);

      useViewportStore.getState().setPan(newPanX, newPanY);
      useViewportStore.getState().setZoom(newZoom);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [viewportRef]);

  /* ── Pan drag handlers (stable refs — no deps needed) ── */

  const onMouseDown = (e: any) => {
    if (useUIStore.getState().activeTool !== "pan") return;
    isPanning.current = true;
    const pos = e.target.getStage().getPointerPosition();
    if (pos) lastPos.current = { x: pos.x, y: pos.y };
  };

  const onMouseMove = (e: any) => {
    if (!isPanning.current) return;
    if (useUIStore.getState().activeTool !== "pan") {
      isPanning.current = false;
      return;
    }
    const pos = e.target.getStage().getPointerPosition();
    if (!pos) return;
    const dx = pos.x - lastPos.current.x;
    const dy = pos.y - lastPos.current.y;
    lastPos.current = { x: pos.x, y: pos.y };

    const { panX, panY } = useViewportStore.getState();
    useViewportStore.getState().setPan(panX + dx, panY + dy);
  };

  const onMouseUp = () => {
    isPanning.current = false;
  };

  return { panHandlers: { onMouseDown, onMouseMove, onMouseUp } };
}
