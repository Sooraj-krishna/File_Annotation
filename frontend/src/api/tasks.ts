/**
 * Task API — initiate and poll async PDF save operations.
 *
 * The save endpoint returns immediately with a task ID. The
 * pollUntilComplete helper handles the polling loop and
 * progress callback for easy integration with the UI store.
 *
 * NOTE: The backend returns snake_case fields. We transform
 * them to camelCase at the API boundary to match frontend conventions.
 */

import api from "./client";
import type { SaveTask } from "@/shared/types";

function toCamelCase(raw: any): SaveTask {
  return {
    taskId: raw.task_id,
    status: raw.status,
    progress: raw.progress,
    resultUrl: raw.result_url,
  };
}

export async function startSave(documentId: string): Promise<SaveTask> {
  const { data } = await api.post(`/documents/${documentId}/save`);
  return toCamelCase(data);
}

export async function pollTask(taskId: string): Promise<SaveTask> {
  const { data } = await api.get(`/tasks/${taskId}`);
  return toCamelCase(data);
}

/**
 * Poll a save task until completion, calling onProgress on each update.
 *
 * Polls every 1 second. Resolves when the task completes, or
 * rejects with an error message if the task fails.
 */
export function pollUntilComplete(
  taskId: string,
  onProgress?: (progress: number) => void,
): Promise<SaveTask> {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const task = await pollTask(taskId);
        onProgress?.(task.progress);

        if (task.status === "completed") {
          clearInterval(interval);
          resolve(task);
        } else if (task.status === "failed") {
          clearInterval(interval);
          reject(new Error("Save failed"));
        }
      } catch (err) {
        clearInterval(interval);
        reject(err);
      }
    }, 1000);
  });
}
