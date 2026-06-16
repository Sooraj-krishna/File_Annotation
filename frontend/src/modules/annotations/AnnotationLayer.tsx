/**
 * AnnotationLayer — the content inside the Konva <Layer>.
 *
 * Maps all annotations to AnnotationShape components
 * and renders the DrawingPreview when the user is drawing.
 */

import { useAnnotationStore } from "@/store/annotationStore";
import { AnnotationShape } from "./AnnotationShape";
import { DrawingPreview } from "./DrawingPreview";
import type { PageDimensions } from "@/modules/coordinates/coordinateEngine";

interface AnnotationLayerProps {
  pageNumber: number;
  pageDimensions: PageDimensions;
  mousePos: { x: number; y: number } | null;
}

import { annotationColor } from "./annotationColor";

export function AnnotationLayer({
  pageNumber,
  pageDimensions,
  mousePos,
}: AnnotationLayerProps) {
  const annotations = useAnnotationStore((s) => s.annotations);
  const labeled = annotations.filter((a) => a.label);
  const pageAnnotations = annotations.filter((a) => a.pageNumber === pageNumber);

  return (
    <>
      {pageAnnotations.map((ann) => {
        const idx = labeled.findIndex((a) => a.id === ann.id);
        const color = annotationColor(ann.labelColor, idx >= 0 ? idx : 0);
        return (
          <AnnotationShape
            key={ann.id}
            annotation={ann}
            pageDimensions={pageDimensions}
            color={color}
          />
        );
      })}
      <DrawingPreview mousePos={mousePos} />
    </>
  );
}
