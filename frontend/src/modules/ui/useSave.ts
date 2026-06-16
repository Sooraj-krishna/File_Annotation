import { useCallback } from "react";
import { useAnnotationStore } from "@/store/annotationStore";
import { useUIStore } from "@/store/uiStore";
import { useNotificationStore } from "@/store/notificationStore";
import { syncAnnotations } from "@/api/annotations";

export function useSave(documentId: string) {
  const annotations = useAnnotationStore((s) => s.annotations);
  const setAnnotations = useAnnotationStore((s) => s.setAnnotations);

  const doSave = useCallback(async () => {
    const { setSaveStatus } = useUIStore.getState();
    const { addNotification } = useNotificationStore.getState();

    setSaveStatus("saving", 0);

    try {
      const pages = new Map<number, any[]>();
      for (const a of annotations) {
        const arr = pages.get(a.pageNumber) ?? [];
        arr.push({
          label: a.label,
          label_color: a.labelColor ?? undefined,
          annotation_type: a.annotationType ?? "extraction",
          points: a.points.map((p: [number, number]) => [p[0], p[1]]),
          label_position: a.labelPosition ?? undefined,
        });
        pages.set(a.pageNumber, arr);
      }

      let synced: any[] = [];
      let done = 0;
      const total = pages.size;

      for (const [pageNumber, payload] of pages) {
        const created = (await syncAnnotations(
          documentId,
          pageNumber,
          payload,
        )) as any[];
        synced = synced.concat(created);
        done++;
        setSaveStatus("saving", Math.round((done / total) * 100));
      }

      const updated = synced.map((a: any) => ({
        id: a.id,
        documentId: a.document_id,
        pageNumber: a.page_number,
        label: a.label,
        labelColor: a.label_color ?? null,
        annotationType: a.annotation_type ?? "extraction",
        points: a.points as [number, number][],
        labelPosition: a.label_position ?? null,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
      }));

      setAnnotations(updated);
      setSaveStatus("completed", 100);
      addNotification("Annotations saved", "success");

      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      console.error("Save failed:", err);
      setSaveStatus("failed");
      addNotification("Save failed — check console for details", "error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, [documentId, annotations, setAnnotations]);

  return { doSave };
}
