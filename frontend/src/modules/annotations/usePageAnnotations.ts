import { useEffect, useRef } from "react";
import { getAnnotations } from "@/api/annotations";
import { useAnnotationStore } from "@/store/annotationStore";
import type { Annotation, LabelPosition } from "@/shared/types";

function transformAnnotation(raw: any): Annotation {
  const labelPos = raw.label_position
    ? (raw.label_position as LabelPosition)
    : null;
  return {
    id: raw.id as string,
    documentId: raw.document_id as string,
    pageNumber: raw.page_number as number,
    label: (raw.label as string | null) ?? null,
    labelColor: (raw.label_color as string | null) ?? null,
    annotationType: (raw.annotation_type as string) ?? "extraction",
    points: raw.points as [number, number][],
    labelPosition: labelPos,
    tableJson: (raw.table_json as any) ?? null,
    createdAt: raw.created_at as string,
    updatedAt: raw.updated_at as string,
  };
}

export function usePageAnnotations(
  documentId: string | null,
): void {
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!documentId) return;

    cancelledRef.current = false;

    useAnnotationStore.getState().clearDrawing();
    useAnnotationStore.getState().setAnnotations([]);

    getAnnotations(documentId)
      .then((raw) => {
        if (cancelledRef.current) return;
        const annotations = raw.map(transformAnnotation);
        useAnnotationStore.getState().setAnnotations(annotations);
      })
      .catch((err) => {
        if (!cancelledRef.current) {
          console.error("Failed to load annotations:", err);
        }
      });

    return () => {
      cancelledRef.current = true;
    };
  }, [documentId]);
}
