import { useState, useRef, useEffect } from "react";
import { useAnnotationStore } from "@/store/annotationStore";
import { useHistoryStore } from "@/store/historyStore";
import type { Annotation } from "@/shared/types";

interface LabelPopupProps {
  annotationId: string;
  position: { x: number; y: number };
  onClose: () => void;
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#6B7280",
  marginBottom: 6,
};

export function LabelPopup({ annotationId, position, onClose }: LabelPopupProps) {
  const [label, setLabel] = useState("");
  const [annotType, setAnnotType] = useState("extraction");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const POPUP_WIDTH = 312;
  const clampedX = Math.min(position.x, window.innerWidth - POPUP_WIDTH - 16);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const updates: Partial<Annotation> = { annotationType: annotType };
    if (label.trim()) {
      updates.label = label.trim();
    }
    useAnnotationStore.getState().updateAnnotation(annotationId, updates);
    useHistoryStore.getState().pushCommand({
      type: "rename-label",
      annotationId,
      before: { label: null, annotationType: "extraction" } as Partial<Annotation>,
      after: updates as Partial<Annotation>,
    });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const btnBase: React.CSSProperties = {
    flex: 1,
    height: 32,
    border: "1px solid #D1D5DB",
    background: "#fff",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    color: "#374151",
    fontFamily: "system-ui, sans-serif",
  };

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.3)",
          zIndex: 40,
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed",
          left: clampedX,
          top: position.y,
          zIndex: 50,
          width: 280,
          background: "#fff",
          borderRadius: 10,
          boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
          padding: 16,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#111827",
            marginBottom: 12,
          }}
        >
          Description / Question(s)
        </div>

        <textarea
          ref={inputRef}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe what to extract or ask questions (e.g. what is the total?)"
          rows={3}
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            padding: "8px 10px",
            fontSize: 13,
            fontFamily: "system-ui, sans-serif",
            outline: "none",
            marginBottom: 14,
            resize: "vertical",
          }}
        />

        <div style={LABEL_STYLE}>Type</div>
        <div
          style={{
            display: "flex",
            borderRadius: 8,
            overflow: "hidden",
            border: "1px solid #D1D5DB",
            marginBottom: 14,
          }}
        >
          <button
            style={{
              ...btnBase,
              background: annotType === "extraction" ? "#E8F8F8" : "#fff",
              color: annotType === "extraction" ? "#008384" : "#374151",
              fontWeight: annotType === "extraction" ? 600 : 500,
              borderRight: "1px solid #D1D5DB",
            }}
            onClick={() => setAnnotType("extraction")}
          >
            AI Extract
          </button>
          <button
            style={{
              ...btnBase,
              background: annotType === "reference" ? "#F3F4F6" : "#fff",
              color: annotType === "reference" ? "#6B7280" : "#374151",
              fontWeight: annotType === "reference" ? 600 : 500,
            }}
            onClick={() => setAnnotType("reference")}
          >
            Reference
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={handleSubmit}
            style={{
              background: "#FFFFFF",
              color: "#374151",
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              height: 34,
              padding: "0 16px",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "system-ui, sans-serif",
              boxShadow: "0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            {label.trim() ? "Add" : "Skip"}
          </button>
        </div>
      </div>
    </>
  );
}
