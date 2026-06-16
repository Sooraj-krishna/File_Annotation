import { useState, useEffect, useRef, useCallback } from "react";
import { useExtractionStore } from "@/store/extractionStore";
import { useAnnotationStore } from "@/store/annotationStore";
import { useHistoryStore } from "@/store/historyStore";
import { useNotificationStore } from "@/store/notificationStore";
import { extractData, generateReport } from "@/api/extraction";
import { syncAnnotations } from "@/api/annotations";
import { TableEditor } from "@/modules/extraction/TableEditor";
import type { Annotation, TableData } from "@/shared/types";

interface ExtractionPanelProps {
  documentId: string;
  annotations: Annotation[];
}

const sectionStyle: React.CSSProperties = {
  background: "#FFFFFF",
  borderRadius: 12,
  padding: 24,
  marginBottom: 20,
  boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
  border: "1px solid rgba(0,0,0,0.04)",
};

const btnFloating: React.CSSProperties = {
  width: "100%",
  height: 44,
  borderRadius: 12,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  transition: "all 0.15s",
  letterSpacing: "0.01em",
};

const btnWhite: React.CSSProperties = {
  ...btnFloating,
  background: "#FFFFFF",
  color: "#374151",
  border: "1px solid #E5E7EB",
  boxShadow: "0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
};

const btnDisabled: React.CSSProperties = {
  ...btnFloating,
  background: "#F3F4F6",
  color: "#D1D5DB",
  cursor: "default",
  boxShadow: "none",
  border: "none",
};

const resultCardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px 14px",
  marginBottom: 8,
  background: "#F8FAFC",
  borderRadius: 10,
  border: "1px solid #F1F5F9",
};

const inputBase: React.CSSProperties = {
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  outline: "none",
  background: "#FFFFFF",
  fontFamily: '"Inter", system-ui, sans-serif',
  boxSizing: "border-box",
  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
};

const labelInputStyle: React.CSSProperties = {
  ...inputBase,
  fontWeight: 600,
  width: "40%",
  textAlign: "start",
  color: "#111827",
};

const cropDisplayStyle: React.CSSProperties = {
  flex: 1,
  borderRadius: 6,
  objectFit: "cover",
  border: "1px solid #E5E7EB",
  background: "#F3F4F6",
  height: 56,
  width: "100%",
};

const errorCardStyle: React.CSSProperties = {
  padding: 14,
  background: "#FEF2F2",
  border: "1px solid #FCA5A5",
  borderRadius: 10,
  fontSize: 12,
  color: "#DC2626",
  marginTop: 8,
  borderLeft: "5px solid #EF4444",
};

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#9CA3AF",
  textAlign: "center",
  padding: "6px 0",
  fontStyle: "italic",
};

const btnGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  marginTop: 16,
};

export function ExtractionPanel({ documentId, annotations }: ExtractionPanelProps) {
  const [extractHovered, setExtractHovered] = useState(false);
  const extractedData = useExtractionStore((s) => s.extractedData);
  const extracting = useExtractionStore((s) => s.extracting);
  const extractError = useExtractionStore((s) => s.extractError);
  const generating = useExtractionStore((s) => s.generating);
  const setExtractedData = useExtractionStore((s) => s.setExtractedData);
  const setExtracting = useExtractionStore((s) => s.setExtracting);
  const setExtractError = useExtractionStore((s) => s.setExtractError);
  const setGenerating = useExtractionStore((s) => s.setGenerating);

  const btnExtractHover: React.CSSProperties = extractHovered
    ? {
        ...btnFloating,
        background: "linear-gradient(135deg, #00A3A4 0%, #008384 100%)",
        color: "#fff",
        border: "none",
        boxShadow: "0 6px 18px rgba(0,131,132,0.30), 0 2px 6px rgba(0,131,132,0.15)",
      }
    : btnWhite;

  const addNotification = useNotificationStore((s) => s.addNotification);

  const handleItemChange = (index: number, field: "label" | "value", newValue: string) => {
    if (!extractedData) return;
    const updated = extractedData.map((item, i) =>
      i === index ? { ...item, [field]: newValue } : item,
    );
    setExtractedData(updated);

    if (field === "label") {
      const item = extractedData[index];
      if (item.annotation_id) {
        const ann = useAnnotationStore.getState().annotations.find(
          (a) => a.id === item.annotation_id,
        );
        if (ann) {
          const oldLabel = ann.label;
          useAnnotationStore.getState().updateAnnotation(item.annotation_id, {
            label: newValue || null,
          });
          useHistoryStore.getState().pushCommand({
            type: "rename-label",
            annotationId: item.annotation_id,
            before: { label: oldLabel } as Partial<Annotation>,
            after: { label: newValue || null } as Partial<Annotation>,
          });
        }
      }
    }
  };

  const handleTableChange = (index: number, newTable: TableData) => {
    if (!extractedData) return;
    const updated = extractedData.map((item, i) =>
      i === index ? { ...item, table_json: newTable } : item,
    );
    setExtractedData(updated);
  };

  // Track annotation state at time of last extraction to detect changes
  const annotationSnapshot = useRef<string | null>(null);
  const [annotationsChanged, setAnnotationsChanged] = useState(false);

  const annotationSignature = useCallback(() => {
    return JSON.stringify(
      annotations.map((a) => ({ page: a.pageNumber, label: a.label })),
    );
  }, [annotations]);

  useEffect(() => {
    if (extractedData && annotationSnapshot.current) {
      const current = annotationSignature();
      setAnnotationsChanged(current !== annotationSnapshot.current);
    }
  }, [annotations, extractedData, annotationSignature]);

  const handleExtract = async () => {
    if (extracting) return;

    const storeAnnotations = useAnnotationStore.getState().annotations;
    if (storeAnnotations.length === 0) return;

    setExtracting(true);
    setExtractError(null);

    try {
      // Persist latest annotations to database before extraction
      const pages = new Map<number, any[]>();
      for (const a of storeAnnotations) {
        const arr = pages.get(a.pageNumber) ?? [];
        arr.push({
          label: a.label,
          label_color: a.labelColor ?? undefined,
          annotation_type: a.annotationType ?? "extraction",
          points: a.points.map((p: [number, number]) => [p[0], p[1]]),
          label_position: a.labelPosition ?? undefined,
          table_json: a.tableJson ?? undefined,
        });
        pages.set(a.pageNumber, arr);
      }
      let synced: any[] = [];
      for (const [pageNumber, payload] of pages) {
        const created = (await syncAnnotations(
          documentId,
          pageNumber,
          payload,
        )) as any[];
        synced = synced.concat(created);
      }
      const storeSetAnnotations = useAnnotationStore.getState().setAnnotations;
      const updated = synced.map((a: any) => ({
        id: a.id,
        documentId: a.document_id,
        pageNumber: a.page_number,
        label: a.label,
        labelColor: a.label_color ?? null,
        annotationType: a.annotation_type ?? "extraction",
        points: a.points as [number, number][],
        labelPosition: a.label_position ?? null,
        tableJson: a.table_json ?? null,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
      }));
      storeSetAnnotations(updated);

      const items = await extractData(documentId);
      setExtractedData(items);
      annotationSnapshot.current = annotationSignature();
      setAnnotationsChanged(false);
      addNotification(`Extracted ${items.length} values`, "success");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Extraction failed";
      setExtractError(msg);
      addNotification(msg, "error");
    } finally {
      setExtracting(false);
    }
  };

  const handleGenerateReport = async () => {
    if (generating || !extractedData || extractedData.length === 0) return;

    setGenerating(true);
    try {
      const { blob, filename } = await generateReport(documentId, extractedData);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addNotification("Report downloaded", "success");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Report generation failed";
      addNotification(msg, "error");
    } finally {
      setGenerating(false);
    }
  };

  if (extracting) {
    return (
      <div style={sectionStyle}>
        <div style={{ textAlign: "center", padding: "12px 0" }}>
          <span style={{ fontSize: 14, color: "#6b7280", fontWeight: 500 }}>⏳ Extracting…</span>
        </div>
      </div>
    );
  }

  if (extractError) {
    return (
      <div style={sectionStyle}>
        <div style={errorCardStyle}>{extractError}</div>
        <div style={btnGroupStyle}>
          <button
            style={btnExtractHover}
            onClick={handleExtract}
            onMouseEnter={() => setExtractHovered(true)}
            onMouseLeave={() => setExtractHovered(false)}
          >
            ⟳ Retry Extraction
          </button>
        </div>
      </div>
    );
  }

  if (extractedData) {
    return (
      <div style={sectionStyle}>
        <div
          style={{
            textAlign: "center",
            fontSize: 13,
            fontWeight: 600,
            color: "#374151",
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: "1px solid #F1F5F9",
          }}
        >
          Extracted Results ({extractedData.length})
        </div>

        {extractedData.map((item, i) => {
          const isRef = item.annotation_type === "reference";
          return (
            <div
              key={i}
              style={{
                ...resultCardStyle,
                flexDirection: isRef ? "row" : "column",
                alignItems: isRef ? "center" : "stretch",
                gap: isRef ? 12 : 8,
              }}
            >
              {isRef ? (
                <>
                  <input
                    style={labelInputStyle}
                    value={item.label}
                    dir="auto"
                    onChange={(e) => handleItemChange(i, "label", e.target.value)}
                  />
                  {item.crop_url ? (
                    <img
                      style={cropDisplayStyle}
                      src={item.crop_url}
                      alt={item.label}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div style={{ ...cropDisplayStyle, display: "flex", alignItems: "center", justifyContent: "center", color: "#D1D5DB", fontSize: 11 }}>
                      no crop
                    </div>
                  )}
                </>
              ) : (
                <>
                  <input
                    style={{ ...labelInputStyle, width: "100%" }}
                    value={item.label}
                    dir="auto"
                    onChange={(e) => handleItemChange(i, "label", e.target.value)}
                  />
                  <TableEditor
                    data={item.table_json ?? {
                      headings: ["Question / Field", "Answer / Value"],
                      rows: [[item.label || "", item.value || ""]],
                    }}
                    onChange={(newTable) => handleTableChange(i, newTable)}
                  />
                </>
              )}
            </div>
          );
        })}

        {annotationsChanged && (
          <div style={hintStyle}>⟳ Annotations changed — re-extract to update values</div>
        )}

        <div style={btnGroupStyle}>
          <button
            style={btnExtractHover}
            onClick={handleExtract}
            onMouseEnter={() => setExtractHovered(true)}
            onMouseLeave={() => setExtractHovered(false)}
          >
            ⟳ Re-extract
          </button>
          <button
            style={generating ? btnDisabled : btnWhite}
            disabled={generating || extractedData.length === 0}
            onClick={handleGenerateReport}
          >
            {generating ? "⏳ Generating…" : "📄 Generate Report"}
          </button>
        </div>
      </div>
    );
  }

  const noAnnotations = annotations.length === 0;
  return (
    <div style={sectionStyle}>
      <div style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 12 }}>
        AI Extraction
      </div>
      <button
        style={noAnnotations ? btnDisabled : btnExtractHover}
        disabled={noAnnotations}
        onClick={handleExtract}
        onMouseEnter={() => setExtractHovered(true)}
        onMouseLeave={() => setExtractHovered(false)}
        title={noAnnotations ? "Add at least one rectangle first" : undefined}
      >
        🤖 Extract with AI
      </button>
    </div>
  );
}
