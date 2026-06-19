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
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
  fontFamily: '"Plus Jakarta Sans", sans-serif',
  display: "flex",
  flexDirection: "column",
};

const heroStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "80px 24px 48px",
  textAlign: "center",
};

const titleStyle: React.CSSProperties = {
  fontSize: 38,
  fontWeight: 800,
  color: "var(--text-primary)",
  margin: 0,
  lineHeight: 1.1,
  letterSpacing: "-0.03em",
};

const taglineStyle: React.CSSProperties = {
  fontSize: 15,
  color: "var(--text-secondary)",
  margin: "16px 0 0",
  maxWidth: 580,
  lineHeight: 1.6,
};

const statsContainerStyle: React.CSSProperties = {
  display: "flex",
  gap: 32,
  marginTop: 32,
};

const statStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const statValueStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: "var(--accent-emerald)",
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: "var(--text-light)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginTop: 4,
};

const uploadZoneStyle: React.CSSProperties = {
  marginTop: 40,
  border: "1px dashed var(--border-light)",
  borderRadius: 16,
  padding: "48px 40px",
  background: "rgba(15, 23, 42, 0.45)",
  backdropFilter: "blur(12px)",
  cursor: "pointer",
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  maxWidth: 520,
  width: "100%",
  boxSizing: "border-box",
  boxShadow: "0px 12px 32px rgba(0,0,0,0.15)",
};

const uploadActiveStyle: React.CSSProperties = {
  ...uploadZoneStyle,
  borderColor: "var(--accent-emerald)",
  background: "rgba(16, 185, 129, 0.05)",
  boxShadow: "0px 12px 32px rgba(16, 185, 129, 0.08), 0 0 0 3px rgba(16, 185, 129, 0.15)",
};

const uploadDisabledStyle: React.CSSProperties = {
  ...uploadZoneStyle,
  cursor: "default",
  opacity: 0.6,
};

const spinnerStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  border: "3px solid var(--border-light)",
  borderTopColor: "var(--accent-emerald)",
  borderRadius: "50%",
  animation: "upload-spin 0.8s linear infinite",
  margin: "0 auto 16px",
};

const uploadIconStyle: React.CSSProperties = {
  fontSize: 32,
  marginBottom: 16,
  color: "var(--accent-emerald)",
};

const uploadTextStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: "var(--text-primary)",
  margin: 0,
};

const uploadHintStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-light)",
  margin: "6px 0 0",
};

const sectionStyle: React.CSSProperties = {
  maxWidth: 1040,
  width: "100%",
  margin: "0 auto",
  padding: "0 24px 80px",
  boxSizing: "border-box",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "var(--text-secondary)",
  marginBottom: 20,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  textAlign: "left",
  background: "var(--bg-secondary)",
  borderRadius: 12,
  overflow: "hidden",
  border: "1px solid var(--border)",
  boxShadow: "0px 8px 24px rgba(0,0,0,0.12)",
};

const thStyle: React.CSSProperties = {
  padding: "16px 24px",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--text-secondary)",
  borderBottom: "1px solid var(--border)",
  background: "rgba(15, 23, 42, 0.6)",
};

const tdStyle: React.CSSProperties = {
  padding: "16px 24px",
  fontSize: 13,
  color: "var(--text-primary)",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "middle",
};

const statusBadgeStyle = (mimeType?: string): React.CSSProperties => {
  const isImage = mimeType?.startsWith("image/");
  return {
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    padding: "3px 8px",
    borderRadius: 6,
    background: isImage ? "rgba(59, 130, 246, 0.1)" : "rgba(16, 185, 129, 0.1)",
    color: isImage ? "var(--accent-blue)" : "var(--accent-emerald)",
    display: "inline-block",
  };
};

const actionButtonStyle: React.CSSProperties = {
  background: "var(--bg-tertiary)",
  color: "var(--text-primary)",
  border: "1px solid var(--border-light)",
  borderRadius: 6,
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.15s",
};

export function LandingPage({
  documents,
  onSelectDocument,
  onDocumentsChange,
}: LandingPageProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [hoveredDocId, setHoveredDocId] = useState<string | null>(null);
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
      <style>{`
        @keyframes upload-spin { to { transform: rotate(360deg); } }
      `}</style>
      <div style={heroStyle}>
        <h1 style={titleStyle}>Financial Document Intelligence</h1>
        <p style={taglineStyle}>
          Audits, balance sheets, and transaction logs annotated in seconds. 
          Extract key ledger values, verify tables with AI, and generate professional reports.
        </p>

        <div style={statsContainerStyle}>
          <div style={statStyle}>
            <span style={statValueStyle}>99.4%</span>
            <span style={statLabelStyle}>Extraction Accuracy</span>
          </div>
          <div style={statStyle}>
            <span style={statValueStyle}>&lt; 1.8s</span>
            <span style={statLabelStyle}>Processing Speed</span>
          </div>
          <div style={statStyle}>
            <span style={statValueStyle}>AES-256</span>
            <span style={statLabelStyle}>Audit Security</span>
          </div>
        </div>

        <div
          style={zoneStyle}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          onMouseEnter={(e) => {
            if (!uploading && !dragging) {
              e.currentTarget.style.borderColor = "var(--accent-emerald)";
              e.currentTarget.style.boxShadow = "0px 12px 32px rgba(16, 185, 129, 0.04)";
            }
          }}
          onMouseLeave={(e) => {
            if (!uploading && !dragging) {
              e.currentTarget.style.borderColor = "var(--border-light)";
              e.currentTarget.style.boxShadow = "0px 12px 32px rgba(0,0,0,0.15)";
            }
          }}
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
              <div style={uploadIconStyle}>📥</div>
              <p style={uploadTextStyle}>
                {dragging
                  ? "Drop financial document here"
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
          <div style={sectionTitleStyle}>Ledger & Documents ({documents.length})</div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Document Name</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Pages / Dimension</th>
                <th style={thStyle}>Uploaded</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const isHovered = hoveredDocId === doc.id;
                return (
                  <tr
                    key={doc.id}
                    onMouseEnter={() => setHoveredDocId(doc.id)}
                    onMouseLeave={() => setHoveredDocId(null)}
                    style={{
                      background: isHovered ? "rgba(30, 41, 59, 0.25)" : "transparent",
                      transition: "background 0.15s",
                      cursor: "pointer",
                    }}
                    onClick={() => onSelectDocument(doc.id)}
                  >
                    <td style={{ ...tdStyle, fontWeight: 500 }}>
                      <span style={{ marginRight: 8 }}>📄</span>
                      {doc.filename}
                    </td>
                    <td style={tdStyle}>
                      <span style={statusBadgeStyle(doc.mimeType)}>
                        {doc.mimeType?.split("/")[1]?.toUpperCase() || "PDF"}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {doc.pageCount} {doc.pageCount === 1 ? "page" : "pages"}
                    </td>
                    <td style={tdStyle}>
                      {new Date(doc.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: "var(--accent-emerald)", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-emerald)" }} />
                        Ready
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <button
                        style={{
                          ...actionButtonStyle,
                          background: isHovered ? "var(--accent-emerald)" : "var(--bg-tertiary)",
                          color: isHovered ? "#FFFFFF" : "var(--text-primary)",
                          borderColor: isHovered ? "var(--accent-emerald)" : "var(--border-light)",
                        }}
                      >
                        Analyze →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
