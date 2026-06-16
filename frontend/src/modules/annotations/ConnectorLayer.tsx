import { useEffect, useState, useRef } from "react";
import { useAnnotationStore } from "@/store/annotationStore";
import { useViewportStore } from "@/store/viewportStore";
import { annotationColor } from "./annotationColor";

interface Connector {
  id: string;
  path: string;
  color: string;
}

export function ConnectorLayer() {
  const annotations = useAnnotationStore((s) => s.annotations);
  const zoom = useViewportStore((s) => s.zoom);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [version, setVersion] = useState(0);
  const rafRef = useRef<number | null>(null);

  /* Recalculate on scroll/resize */
  useEffect(() => {
    const recalc = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setVersion((v) => v + 1);
      });
    };
    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, true);
    return () => {
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  /* Build connector paths */
  useEffect(() => {
    const labeled = annotations.filter((a) => a.label);
    const items: Connector[] = [];
    let paletteIndex = 0;

    for (const ann of labeled) {
      const pageEl = document.querySelector(`[data-pageid="${ann.pageNumber}"]`);
      const entryEl = document.querySelector(`[data-entry-id="${ann.id}"]`);
      if (!pageEl || !entryEl) continue;

      const pageRect = pageEl.getBoundingClientRect();
      const entryRect = entryEl.getBoundingClientRect();
      const pageW = (pageEl as HTMLElement).clientWidth;
      const pageH = (pageEl as HTMLElement).clientHeight;

      if (pageW === 0 || pageH === 0) continue;

      const color = annotationColor(ann.labelColor, paletteIndex++);

      /* Right edge center of rectangle */
      const rightX = Math.max(ann.points[0][0], ann.points[1][0]);
      const centerY = (ann.points[0][1] + ann.points[1][1]) / 2;

      const startX = pageRect.left + rightX * pageW;
      const startY = pageRect.top + centerY * pageH;

      /* Left edge center of sidebar entry */
      const endX = entryRect.left;
      const endY = entryRect.top + entryRect.height / 2;

      /* Cubic Bezier with S-curve */
      const dx = Math.abs(endX - startX);
      const cpOffset = Math.min(dx * 0.4, 120);
      const path = `M ${startX} ${startY} C ${startX + cpOffset} ${startY}, ${endX - cpOffset} ${endY}, ${endX} ${endY}`;

      items.push({ id: ann.id, path, color });
    }

    setConnectors(items);
  }, [annotations, zoom, version]);

  if (connectors.length === 0) return null;

  return (
    <svg
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      <defs>
        {connectors.map((c) => (
          <marker
            key={c.id}
            id={`conn-dot-${c.id}`}
            markerWidth={8}
            markerHeight={8}
            refX={4}
            refY={4}
          >
            <circle cx={4} cy={4} r={3.5} fill={c.color} />
          </marker>
        ))}
      </defs>
      {connectors.map((c) => (
        <path
          key={c.id}
          d={c.path}
          stroke={c.color}
          strokeWidth={2}
          fill="none"
          markerEnd={`url(#conn-dot-${c.id})`}
        />
      ))}
    </svg>
  );
}
