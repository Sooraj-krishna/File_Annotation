import { useState, useEffect, useCallback } from "react";
import { listDocuments } from "@/api/documents";
import { DocumentViewer } from "@/modules/page-manager/DocumentViewer";
import { LandingPage } from "@/modules/ui/LandingPage";
import { ErrorBoundary } from "@/modules/ui/ErrorBoundary";
import { ToastContainer } from "@/modules/ui/ToastContainer";
import type { DocumentResponse } from "@/shared/types";

type Screen = "loading" | "landing" | "workspace";

const HEADER = {
  height: 64,
  flexShrink: 0,
  background: "var(--bg-secondary)",
  borderBottom: "1px solid var(--border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 32px",
  boxSizing: "border-box",
} as const;

const headerTitle = {
  color: "var(--text-primary)",
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: "-0.02em",
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontFamily: '"Plus Jakarta Sans", sans-serif',
} as const;

const headerSubtitle = {
  color: "var(--text-secondary)",
  fontSize: 12,
  fontWeight: 400,
  background: "var(--bg-tertiary)",
  border: "1px solid var(--border-light)",
  padding: "3px 8px",
  borderRadius: 6,
  marginLeft: 12,
  fontFamily: '"Plus Jakarta Sans", sans-serif',
} as const;

function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    listDocuments()
      .then((res: { documents: DocumentResponse[] }) => {
        setDocuments(res.documents);
        const saved = localStorage.getItem("selectedDocumentId");
        const match = saved
          ? res.documents.find((d: DocumentResponse) => d.id === saved)
          : null;
        if (match) {
          setSelectedId(match.id);
          setScreen("workspace");
        } else {
          setScreen("landing");
        }
      })
      .catch((err) => {
        console.error("Failed to fetch documents:", err);
        setScreen("landing");
      });
  }, []);

  useEffect(() => {
    if (selectedId) {
      localStorage.setItem("selectedDocumentId", selectedId);
    } else {
      localStorage.removeItem("selectedDocumentId");
    }
  }, [selectedId]);

  const handleSelectDocument = useCallback((id: string) => {
    setSelectedId(id);
    setScreen("workspace");
  }, []);

  const handleBack = useCallback(() => {
    setSelectedId(null);
    setScreen("landing");
    listDocuments()
      .then((res) => setDocuments(res.documents))
      .catch(() => {});
  }, []);

  const selectedDoc = documents.find((d) => d.id === selectedId) ?? null;

  if (screen === "loading") {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          color: "#6b7280",
          fontSize: 14,
          background: "#0f172a",
        }}
      >
        Loading…
      </div>
    );
  }

  const header = (
    <header style={HEADER}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={headerTitle}>
          <span style={{ color: "var(--accent-emerald)", fontSize: 20 }}>❖</span> VALOIS
        </span>
        {screen === "workspace" && selectedDoc && (
          <span style={headerSubtitle}>{selectedDoc.filename}</span>
        )}
      </div>
      {screen === "workspace" && (
        <button
          onClick={handleBack}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
        >
          ← Dashboard
        </button>
      )}
    </header>
  );

  if (screen === "landing") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        {header}
        <LandingPage
          documents={documents}
          onSelectDocument={handleSelectDocument}
          onDocumentsChange={setDocuments}
        />
        <ToastContainer />
      </div>
    );
  }

  if (!selectedDoc) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          color: "#6b7280",
          fontSize: 14,
          background: "#0f172a",
        }}
      >
        Document not found.{' '}
        <button
          onClick={handleBack}
          style={{
            marginLeft: 8,
            border: "none",
            background: "none",
            color: "#60a5fa",
            cursor: "pointer",
            fontSize: 14,
            textDecoration: "underline",
          }}
        >
          Go home
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        {header}
        <DocumentViewer
          documentId={selectedDoc.id}
        />
      </div>
    </ErrorBoundary>
  );
}

export default App;
