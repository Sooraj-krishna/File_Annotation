/**
 * usePdfSave — hook that generates + downloads the annotated PDF.
 *
 * Calls POST /api/documents/{id}/save to start the async task,
 * polls until complete, then triggers a download of the generated
 * PDF. Updates uiStore.pdfSaveStatus and fires toast notifications.
 */

import { useCallback } from "react";
import { useUIStore } from "@/store/uiStore";
import { useNotificationStore } from "@/store/notificationStore";
import { startSave, pollUntilComplete } from "@/api/tasks";
import { getDocumentFileUrl } from "@/api/documents";
import { getAnnotations } from "@/api/annotations";

export function usePdfSave(documentId: string) {
  const doPdfSave = useCallback(async () => {
    const { setPdfSaveStatus } = useUIStore.getState();
    const { addNotification } = useNotificationStore.getState();

    setPdfSaveStatus("saving", 0);

    try {
      const task = await startSave(documentId);
      setPdfSaveStatus("saving", 10);

      await pollUntilComplete(task.taskId, (progress) => {
        setPdfSaveStatus("saving", progress);
      });

      setPdfSaveStatus("completed", 100);

      // Trigger download of the annotated PDF
      const url = getDocumentFileUrl(documentId);
      const a = document.createElement("a");
      a.href = url;
      a.download = `annotated-${documentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      addNotification("Annotated PDF downloaded", "success");

      const allAnnotations = await getAnnotations(documentId);
      const payload = {
        documentId,
        annotations: allAnnotations,
      };
      console.log(JSON.stringify(payload, null, 2));

      setTimeout(() => setPdfSaveStatus("idle"), 2000);
    } catch (err) {
      console.error("PDF save failed:", err);
      setPdfSaveStatus("failed");
      addNotification("PDF save failed — check console", "error");
      setTimeout(() => setPdfSaveStatus("idle"), 3000);
    }
  }, [documentId]);

  return { doPdfSave };
}
