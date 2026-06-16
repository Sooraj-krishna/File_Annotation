/**
 * DrawingPreview — ghost rectangle shown while the user draws.
 *
 * Renders a dashed rectangle from the start corner to current
 * mouse position.
 */

import { Rect } from "react-konva";
import { useAnnotationStore } from "@/store/annotationStore";

interface DrawingPreviewProps {
  mousePos: { x: number; y: number } | null;
}

export function DrawingPreview({ mousePos }: DrawingPreviewProps) {
  const drawing = useAnnotationStore((s) => s.drawing);
  const drawingPoints = useAnnotationStore((s) => s.drawingPoints);

  if (!drawing || drawingPoints.length < 1 || !mousePos) return null;

  const start = drawingPoints[0];
  const x = Math.min(start[0], mousePos.x);
  const y = Math.min(start[1], mousePos.y);
  const w = Math.abs(mousePos.x - start[0]);
  const h = Math.abs(mousePos.y - start[1]);

  return (
    <Rect
      x={x}
      y={y}
      width={w}
      height={h}
      stroke="#2563eb"
      strokeWidth={2}
      dash={[6, 4]}
      listening={false}
    />
  );
}