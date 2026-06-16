import { useState, useEffect } from "react";
import { PdfRenderer } from "@/modules/pdf-viewer/PdfRenderer";
import { LabelingPanel } from "@/modules/ui/LabelingPanel";
import { ConnectorLayer } from "@/modules/annotations/ConnectorLayer";
import { ToastContainer } from "@/modules/ui/ToastContainer";
import { ShortcutHelp } from "@/modules/ui/ShortcutHelp";
import { useSave } from "@/modules/ui/useSave";
import { usePdfSave } from "@/modules/ui/usePdfSave";

interface DocumentViewerProps {
  documentId: string;
}

export function DocumentViewer({
  documentId,
}: DocumentViewerProps) {
  const { doSave } = useSave(documentId);
  const { doPdfSave } = usePdfSave(documentId);

  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "?") {
        e.preventDefault();
        setShowShortcuts((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <div style={{ flex: "1 1 65%", display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>
        <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
          <PdfRenderer documentId={documentId} />
        </div>
      </div>

      <LabelingPanel
        documentId={documentId}
        onSave={doSave}
        onPdfSave={doPdfSave}
      />

      <ConnectorLayer />
      <ToastContainer />
      {showShortcuts && <ShortcutHelp onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}
