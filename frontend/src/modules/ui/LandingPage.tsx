import { useState, useRef, useCallback } from "react";
import { uploadDocument } from "@/api/documents";
import { useNotificationStore } from "@/store/notificationStore";
import type { DocumentResponse } from "@/shared/types";

interface LandingPageProps {
  documents: DocumentResponse[];
  onSelectDocument: (id: string) => void;
  onDocumentsChange: (docs: DocumentResponse[]) => void;
}

const pageStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  background: "#F8FAFC",
  fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
  display: "flex",
  flexDirection: "column",
};

const heroStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "60px 24px 40px",
  textAlign: "center",
};

const titleStyle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
  color: "#111827",
  margin: 0,
  lineHeight: 1.15,
};

const taglineStyle: React.CSSProperties = {
  fontSize: 16,
  color: "#6B7280",
  margin: "12px 0 0",
  maxWidth: 480,
  lineHeight: 1.5,
};

const uploadZoneStyle: React.CSSProperties = {
  marginTop: 32,
  border: "2px dashed #E5E7EB",
  borderRadius: 12,
  padding: "32px 40px",
  background: "#FFFFFF",
  cursor: "pointer",
  transition: "all 0.2s",
  maxWidth: 440,
  width: "100%",
  boxSizing: "border-box",
  boxShadow: "0px 4px 20px rgba(0,0,0,0.08)",
};

const uploadActiveStyle: React.CSSProperties = {
  ...uploadZoneStyle,
  borderColor: "#2563eb",
  background: "#F8FAFC",
  boxShadow: "0px 4px 20px rgba(0,0,0,0.08), 0 0 0 3px rgba(37,99,235,0.1)",
};

const uploadDisabledStyle: React.CSSProperties = {
  ...uploadZoneStyle,
  cursor: "default",
  opacity: 0.6,
  borderColor: "#E5E7EB",
};

const spinnerStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  border: "3px solid #E5E7EB",
  borderTopColor: "#2563eb",
  borderRadius: "50%",
  animation: "upload-spin 0.8s linear infinite",
  margin: "0 auto 10px",
};

const uploadIconStyle: React.CSSProperties = {
  fontSize: 28,
  marginBottom: 10,
};

const uploadTextStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#374151",
  margin: 0,
};

const uploadHintStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#9CA3AF",
  margin: "4px 0 0",
};

const sectionStyle: React.CSSProperties = {
  maxWidth: 900,
  width: "100%",
  margin: "0 auto",
  padding: "0 24px 60px",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#6B7280",
  marginBottom: 16,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
  gap: 16,
};

const cardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  borderRadius: 12,
  padding: "18px 20px",
  cursor: "pointer",
  transition: "all 0.15s",
  boxShadow: "0px 4px 20px rgba(0,0,0,0.08)",
  border: "1px solid #F1F5F9",
};

const cardNameStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: "#111827",
  marginBottom: 4,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const cardMetaStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#6B7280",
};

export function LandingPage({
  documents,
  onSelectDocument,
  onDocumentsChange,
}: LandingPageProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      if (uploading) return;
      setUploading(true);
      setUploadFileName(file.name);
      try {
        const doc = await uploadDocument(file);
        useNotificationStore.getState().addNotification(
          `Uploaded "${doc.filename}"`,
          "success",
        );
        onDocumentsChange([...documents, doc]);
        onSelectDocument(doc.id);
      } catch (err) {
        console.error("Upload failed:", err);
        useNotificationStore.getState().addNotification(
          "Upload failed — check console",
          "error",
        );
        setUploading(false);
        setUploadFileName(null);
      }
    },
    [documents, onDocumentsChange, onSelectDocument, uploading],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (uploading) return;
    e.preventDefault();
    setDragging(true);
  }, [uploading]);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (uploading) return;
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file?.type === "application/pdf" || file?.type.startsWith("image/")) handleUpload(file);
    },
    [handleUpload, uploading],
  );

  const handleClick = useCallback(() => {
    if (uploading) return;
    inputRef.current?.click();
  }, [uploading]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload],
  );

  const zoneStyle = uploading
    ? uploadDisabledStyle
    : dragging
      ? uploadActiveStyle
      : uploadZoneStyle;

  return (
    <div style={pageStyle}>
      <style>{`@keyframes upload-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={heroStyle}>
        <h1 style={titleStyle}>Document Annotation Platform</h1>
        <p style={taglineStyle}>
          Upload, annotate, and export documents with precision.
          Draw rectangles, add labels, and generate annotated documents.
        </p>

        <div
          style={zoneStyle}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          {uploading ? (
            <>
              <div style={spinnerStyle} />
              <p style={uploadTextStyle}>
                Uploading{uploadFileName ? ` "${uploadFileName}"` : ""}…
              </p>
            </>
          ) : (
            <>
              <div style={uploadIconStyle}>📄</div>
              <p style={uploadTextStyle}>
                {dragging
                  ? "Drop your file here"
                  : "Click or drag a file to upload"}
              </p>
              <p style={uploadHintStyle}>PDF, PNG, JPEG, GIF, WebP, TIFF, BMP</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf,image/png,image/jpeg,image/gif,image/webp,image/tiff,image/bmp"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
        </div>
      </div>

      {documents.length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>
            {documents.length > 0
              ? `Your Documents (${documents.length})`
              : "Documents"}
          </div>
          <div style={gridStyle}>
            {documents.map((doc) => (
              <div
                key={doc.id}
                style={cardStyle}
                onClick={() => onSelectDocument(doc.id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,0,0,0.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "0px 4px 20px rgba(0,0,0,0.08)";
                }}
              >
                <div style={cardNameStyle}>{doc.filename}</div>
                <div style={cardMetaStyle}>
                  {doc.pageCount} {doc.mimeType?.startsWith("image/") ? "page" : "pages"} ·{" "}
                  {new Date(doc.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
