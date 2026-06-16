/**
 * Annotation API — create, read, update, and delete rectangle annotations.
 */

import api from "./client";
import type {
  Annotation,
  AnnotationCreate,
  AnnotationUpdate,
} from "@/shared/types";

export async function getAnnotations(
  documentId: string,
  page?: number,
): Promise<Annotation[]> {
  const { data } = await api.get<Annotation[]>(
    `/documents/${documentId}/annotations`,
    { params: page ? { page } : {} },
  );
  return data;
}

export async function createAnnotation(
  payload: AnnotationCreate,
): Promise<Annotation> {
  const { data } = await api.post<Annotation>("/annotations", {
    document_id: payload.documentId,
    page_number: payload.pageNumber,
    label: payload.label,
    points: payload.points,
  });
  return data;
}

export async function updateLabelPosition(
  id: string,
  labelPosition: { x: number; y: number },
): Promise<Annotation> {
  const { data } = await api.put<Annotation>(`/annotations/${id}`, {
    label_position: labelPosition,
  });
  return data;
}

export async function updateAnnotation(
  id: string,
  payload: AnnotationUpdate,
): Promise<Annotation> {
  const body: Record<string, unknown> = {};
  if (payload.label !== undefined) body.label = payload.label;
  if (payload.labelColor !== undefined) body.label_color = payload.labelColor;
  if (payload.points !== undefined) body.points = payload.points;
  const { data } = await api.put<Annotation>(`/annotations/${id}`, body);
  return data;
}

export async function deleteAnnotation(id: string): Promise<void> {
  await api.delete(`/annotations/${id}`);
}

export async function syncAnnotations(
  documentId: string,
  pageNumber: number,
  annotations: Array<{
    label: string | null;
    label_color?: string | null;
    points: number[][];
    label_position?: { x: number; y: number };
  }>,
): Promise<unknown> {
  const { data } = await api.post("/annotations/sync", {
    page_number: pageNumber,
    annotations,
  }, { params: { document_id: documentId } });
  return data;
}
