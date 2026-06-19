import { useAnnotationStore } from "@/store/annotationStore";
import { useHistoryStore } from "@/store/historyStore";
import { useUIStore } from "@/store/uiStore";
import { ExtractionPanel } from "@/modules/extraction/ExtractionPanel";
import { Toolbar } from "@/modules/ui/Toolbar";
import { annotationColor } from "@/modules/annotations/annotationColor";
import type { Annotation } from "@/shared/types";

interface LabelingPanelProps {
  documentId: string;
  onSave: () => void;
  onPdfSave: () => void;
}

const panelStyle: React.CSSProperties = {
  width: "35%",
  minWidth: 300,
  maxWidth: 420,
  flexShrink: 0,
  borderLeft: "1px solid #E5E7EB",
  background: "#F8FAFC",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const scrollStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "0 12px 12px",
};

const cardBase: React.CSSProperties = {
  background: "#FFFFFF",
  borderRadius: 8,
  padding: 20,
  marginBottom: 16,
  boxShadow: "0px 4px 20px rgba(0,0,0,0.08)",
};

const sectionHeader: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#6B7280",
  marginBottom: 12,
};

const annEntryStyle: React.CSSProperties = {
  padding: "10px 12px 10px 16px",
  fontSize: 13,
  color: "#374151",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 8,
  borderLeft: "3px solid transparent",
  marginBottom: 4,
  borderRadius: 8,
  transition: "all 0.12s",
  background: "#F8FAFC",
  border: "1px solid #F1F5F9",
};

const annEntrySel: React.CSSProperties = {
  ...annEntryStyle,
  background: "#F0FDF4",
  borderLeft: "5px solid #22C55E",
  borderColor: "#F1F5F9",
};

const annDot: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  flexShrink: 0,
};

const connectorLine: React.CSSProperties = {
  width: 20,
  height: 2,
  flexShrink: 0,
  borderRadius: 1,
};

const arrowHeadStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: "14px",
  flexShrink: 0,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#6B7280",
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  fontSize: 13,
  fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
  outline: "none",
  resize: "vertical",
  minHeight: 50,
};

const bottomBarStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderTop: "1px solid #E5E7EB",
  background: "#FFFFFF",
  display: "flex",
  gap: 10,
  boxShadow: "0 -4px 16px rgba(0,0,0,0.06)",
};

const btnBase: React.CSSProperties = {
  flex: 1,
  height: 42,
  border: "none",
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

const btnSave: React.CSSProperties = {
  ...btnBase,
  background: "linear-gradient(135deg, #00A3A4 0%, #008384 100%)",
  color: "#fff",
  boxShadow: "0 6px 18px rgba(0,131,132,0.30), 0 2px 6px rgba(0,131,132,0.15)",
};

const btnPdf: React.CSSProperties = {
  ...btnBase,
  background: "#FFFFFF",
  color: "#374151",
  border: "1px solid #E5E7EB",
  boxShadow: "0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
};

const btnDisabled: React.CSSProperties = {
  ...btnBase,
  background: "#F3F4F6",
  color: "#D1D5DB",
  cursor: "default",
  boxShadow: "none",
};

export function LabelingPanel({
  documentId,
  onSave,
  onPdfSave,
}: LabelingPanelProps) {
  const annotations = useAnnotationStore((s) => s.annotations);
  const selectedId = useAnnotationStore((s) => s.selectedId);
  const selectAnnotation = useAnnotationStore((s) => s.selectAnnotation);
  const updateAnnotation = useAnnotationStore((s) => s.updateAnnotation);
  const removeAnnotation = useAnnotationStore((s) => s.removeAnnotation);
  const saveStatus = useUIStore((s) => s.saveStatus);
  const pdfSaveStatus = useUIStore((s) => s.pdfSaveStatus);
  const setScrollTargetPage = useUIStore((s) => s.setScrollTargetPage);

  const selected = annotations.find((a) => a.id === selectedId) ?? null;

  const pages = Array.from(new Set(annotations.map((a) => a.pageNumber))).sort(
    (a, b) => a - b,
  );

  const handleEntryClick = (ann: Annotation) => {
    selectAnnotation(ann.id);
    setScrollTargetPage(ann.pageNumber);
  };

  const handleDelete = () => {
    if (!selected) return;
    useHistoryStore.getState().pushCommand({
      type: "delete",
      annotationId: selected.id,
      before: { ...selected } as Partial<Annotation>,
      after: null,
    });
    removeAnnotation(selected.id);
    selectAnnotation(null);
  };

  const saveLabel = () => {
    switch (saveStatus) {
      case "saving": return "⏳ Saving…";
      case "completed": return "✅ Saved";
      case "failed": return "❌ Failed";
      default: return "💾 Save";
    }
  };

  let globalIndex = 0;

  return (
    <div style={panelStyle}>
      <Toolbar />

      <div style={scrollStyle}>
        <div style={cardBase}>
          <div style={sectionHeader}>Annotations</div>

          {annotations.length === 0 && (
            <div style={{ padding: "8px 0", fontSize: 13, color: "#9CA3AF" }}>
              No annotations yet. Select the Rect tool and drag on the PDF to add one.
            </div>
          )}

          {pages.map((page) => (
            <div key={page}>
              <div
                style={{
                  padding: "4px 0 2px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#9CA3AF",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Page {page}
              </div>
              {annotations
                .filter((a) => a.pageNumber === page)
                .map((ann) => {
                  const idx = globalIndex++;
                  const color = annotationColor(ann.labelColor, idx);
                  return (
                    <div
                      key={ann.id}
                      data-entry-id={ann.id}
                      style={ann.id === selectedId ? annEntrySel : annEntryStyle}
                      onClick={() => handleEntryClick(ann)}
                    >
                      <div style={{ ...annDot, background: color }} />
                      <div style={{ ...connectorLine, background: color }} />
                      <span style={{ color, ...arrowHeadStyle }}>→</span>
                      <span
                        style={{
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {ann.label || "Rectangle"}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: (ann.annotationType === "extraction" || ann.annotationType === "table") ? "#D1FAF5" : "#F3F4F6",
                          color: (ann.annotationType === "extraction" || ann.annotationType === "table") ? "#008384" : "#6B7280",
                          flexShrink: 0,
                        }}
                      >
                        {(ann.annotationType === "extraction" || ann.annotationType === "table") ? "AI" : "Ref"}
                      </span>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>

        {selected && (
          <div style={cardBase}>
            <div style={labelStyle}>Description / Question(s)</div>
            <textarea
              style={inputStyle}
              value={selected.label ?? ""}
              placeholder="Describe what to extract or ask questions (e.g. what is the total?)"
              rows={3}
              onChange={(e) =>
                updateAnnotation(selected.id, {
                  label: e.target.value || null,
                })
              }
            />

            <div style={{ ...labelStyle, marginTop: 16 }}>Type</div>
            <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid #D1D5DB", marginBottom: 4 }}>
              <button
                style={{
                  flex: 1,
                  height: 30,
                  border: "none",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: '"Inter", system-ui, sans-serif',
                  fontWeight: (selected.annotationType === "extraction" || selected.annotationType === "table") ? 600 : 500,
                  background: (selected.annotationType === "extraction" || selected.annotationType === "table") ? "#E8F8F8" : "#fff",
                  color: (selected.annotationType === "extraction" || selected.annotationType === "table") ? "#008384" : "#374151",
                }}
                onClick={() => updateAnnotation(selected.id, { annotationType: "extraction" })}
              >
                AI Extract
              </button>
              <button
                style={{
                  flex: 1,
                  height: 30,
                  border: "none",
                  borderLeft: "1px solid #D1D5DB",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: '"Inter", system-ui, sans-serif',
                  fontWeight: selected.annotationType === "reference" ? 600 : 500,
                  background: selected.annotationType === "reference" ? "#F3F4F6" : "#fff",
                  color: selected.annotationType === "reference" ? "#6B7280" : "#374151",
                }}
                onClick={() => updateAnnotation(selected.id, { annotationType: "reference" })}
              >
                Reference
              </button>
            </div>

            <button
              onClick={handleDelete}
              title="Delete annotation"
              style={{
                marginTop: 16,
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "1px solid #FCA5A5",
                background: "#FEF2F2",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                boxShadow: "0 2px 8px rgba(239,68,68,0.15)",
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              🗑
            </button>
          </div>
        )}

        <ExtractionPanel documentId={documentId} annotations={annotations} />
      </div>

      <div style={bottomBarStyle}>
        <button
          style={saveStatus === "saving" ? btnDisabled : btnSave}
          disabled={saveStatus === "saving"}
          onClick={onSave}
          title="Save annotations to server"
        >
          {saveLabel()}
        </button>
        <button
          style={pdfSaveStatus === "saving" ? btnDisabled : btnPdf}
          disabled={pdfSaveStatus === "saving"}
          onClick={onPdfSave}
          title="Generate and download annotated PDF"
        >
          {pdfSaveStatus === "saving"
            ? "⏳ PDF…"
            : pdfSaveStatus === "completed"
              ? "✅ PDF"
              : pdfSaveStatus === "failed"
                ? "❌ PDF"
                : "📄 PDF"}
        </button>
      </div>
    </div>
  );
}
