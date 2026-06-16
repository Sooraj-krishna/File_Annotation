/**
 * Document API — upload, list, retrieve, and delete PDF documents.
 */

import api from "./client";
import type { DocumentList, DocumentResponse } from "@/shared/types";

export async function uploadDocument(file: File): Promise<DocumentResponse> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/documents", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return transformDocument(data);
}

function transformDocument(raw: any): DocumentResponse {
  return {
    id: raw.id as string,
    filename: raw.filename as string,
    mimeType: raw.mime_type as string,
    pageCount: raw.page_count as number,
    createdAt: raw.created_at as string,
    updatedAt: raw.updated_at as string,
  };
}

export async function listDocuments(
  skip = 0,
  limit = 100,
): Promise<DocumentList> {
  const { data } = await api.get("/documents", {
    params: { skip, limit },
  });
  return {
    documents: (data.documents as any[]).map(transformDocument),
    total: data.total as number,
  };
}

export async function getDocument(id: string): Promise<DocumentResponse> {
  const { data } = await api.get(`/documents/${id}`);
  return transformDocument(data);
}

export async function deleteDocument(id: string): Promise<void> {
  await api.delete(`/documents/${id}`);
}

/**
 * Returns the URL for streaming a PDF file for PDF.js rendering.
 * This is a direct URL, not an API call through the Axios client.
 */
export function getDocumentFileUrl(id: string): string {
  return `/api/documents/${id}/file`;
}
