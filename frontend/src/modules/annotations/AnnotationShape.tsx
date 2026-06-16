import { Group, Rect } from "react-konva";
import { useAnnotationStore } from "@/store/annotationStore";
import { useViewportStore } from "@/store/viewportStore";
import { documentToScreen } from "@/modules/coordinates/coordinateEngine";
import type { Annotation } from "@/shared/types";
import type { PageDimensions } from "@/modules/coordinates/coordinateEngine";

interface AnnotationShapeProps {
  annotation: Annotation;
  pageDimensions: PageDimensions;
  color: string;
}

export function AnnotationShape({
  annotation,
  pageDimensions,
  color,
}: AnnotationShapeProps) {
  const zoom = useViewportStore((s) => s.zoom);
  const selectedId = useAnnotationStore((s) => s.selectedId);
  const selectAnnotation = useAnnotationStore((s) => s.selectAnnotation);

  const isSelected = selectedId === annotation.id;
  const viewport = { zoom, panX: 0, panY: 0 };

  const topLeft = documentToScreen(
    annotation.points[0][0],
    annotation.points[0][1],
    pageDimensions,
    viewport,
  );
  const bottomRight = documentToScreen(
    annotation.points[1][0],
    annotation.points[1][1],
    pageDimensions,
    viewport,
  );
  const rx = Math.min(topLeft[0], bottomRight[0]);
  const ry = Math.min(topLeft[1], bottomRight[1]);
  const rw = Math.abs(bottomRight[0] - topLeft[0]);
  const rh = Math.abs(bottomRight[1] - topLeft[1]);

  return (
    <Group>
      <Rect
        x={rx}
        y={ry}
        width={rw}
        height={rh}
        stroke={color}
        strokeWidth={isSelected ? 3 : 2}
        fill={isSelected ? `${color}1F` : ""}
        cornerRadius={4}
        onClick={() => selectAnnotation(annotation.id)}
        onTap={() => selectAnnotation(annotation.id)}
      />
    </Group>
  );
}
