/**
 * Extraction API — AI-powered label-value extraction and report generation.
 */

import api from "./client";
import type { ExtractedItem } from "@/shared/types";

export async function extractData(
  documentId: string,
): Promise<ExtractedItem[]> {
  const { data } = await api.post<{ items: ExtractedItem[] }>(
    `/documents/${documentId}/extract`,
  );
  return data.items;
}

export async function generateReport(
  documentId: string,
  items: ExtractedItem[],
): Promise<{ blob: Blob; filename: string }> {
  const response = await api.post(
    `/documents/${documentId}/generate-report`,
    { items },
    { responseType: "blob" },
  );
  const disposition = response.headers?.["content-disposition"] || "";
  const match = disposition.match(/filename="?(.+?)"?$/);
  const filename = match ? match[1] : "Extracted Data.pdf";
  return { blob: response.data, filename };
}

export async function getExtractionLog(
  documentId: string,
): Promise<unknown[]> {
  const { data } = await api.get<{ entries: unknown[] }>(
    `/documents/${documentId}/extraction-log`,
  );
  return data.entries;
}
