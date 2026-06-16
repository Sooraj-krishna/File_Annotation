import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Stage, Layer } from "react-konva";
import { useViewportStore } from "@/store/viewportStore";
import { useAnnotationStore } from "@/store/annotationStore";
import { useUIStore } from "@/store/uiStore";
import { useHistoryStore } from "@/store/historyStore";
import { AnnotationLayer } from "@/modules/annotations/AnnotationLayer";
import { LabelPopup } from "@/modules/annotations/LabelPopup";
import type { Annotation } from "@/shared/types";
import { usePageAnnotations } from "@/modules/annotations/usePageAnnotations";
import { ViewportControls } from "@/modules/viewport/ViewportControls";
import { getDocument, getDocumentFileUrl } from "@/api/documents";
import { screenToDocument } from "@/modules/coordinates/coordinateEngine";
import { ZOOM_MIN, ZOOM_MAX, ZOOM_WHEEL_SENSITIVITY } from "@/shared/constants";
import { ContextMenu } from "@/modules/ui/ContextMenu";
import { usePdfDocument } from "./usePdfDocument";

interface PdfRendererProps {
  documentId: string;
}

function PdfRenderer({ documentId }: PdfRendererProps) {
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [docMetaLoading, setDocMetaLoading] = useState(true);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  const imageUrl = useMemo(() => {
    if (!documentId) return null;
    return getDocumentFileUrl(documentId);
  }, [documentId]);

  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;
    getDocument(documentId).then((d) => {
      if (cancelled) return;
      setMimeType(d.mimeType);
      setDocMetaLoading(false);
    }).catch(() => {
      if (!cancelled) setDocMetaLoading(false);
    });
    return () => { cancelled = true; };
  }, [documentId]);

  const isImage = mimeType?.startsWith("image/");

  useEffect(() => {
    if (!isImage || !imageUrl) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = imageUrl;
    return () => { cancelled = true; };
  }, [isImage, imageUrl]);

  const pdfUrl = documentId && !isImage && !docMetaLoading ? getDocumentFileUrl(documentId) : null;
  const { pageCount, pageDimensions, renderPage, loaded, error } = usePdfDocument(pdfUrl);

  const effectivePageCount = isImage ? 1 : pageCount;
  const effectivePageDimensions = isImage && imageDimensions
    ? new Map([[1, imageDimensions]])
    : pageDimensions;

  const zoom = useViewportStore((s) => s.zoom);
  const activeTool = useUIStore((s) => s.activeTool);
  const setActiveTool = useUIStore((s) => s.setActiveTool);
  const drawing = useAnnotationStore((s) => s.drawing);
  const selectAnnotation = useAnnotationStore((s) => s.selectAnnotation);
  const selectedId = useAnnotationStore((s) => s.selectedId);
  const addDrawingPoint = useAnnotationStore((s) => s.addDrawingPoint);
  const setDrawingPoint = useAnnotationStore((s) => s.setDrawingPoint);
  const clearDrawing = useAnnotationStore((s) => s.clearDrawing);
  const setDrawing = useAnnotationStore((s) => s.setDrawing);

  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    annotationId: string;
  } | null>(null);
  const [drawingPage, setDrawingPage] = useState<number | null>(null);
  const [labelPopupAnnId, setLabelPopupAnnId] = useState<string | null>(null);
  const [labelPopupPos, setLabelPopupPos] = useState<{ x: number; y: number } | null>(null);

  usePageAnnotations(documentId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const [autoFitted, setAutoFitted] = useState(false);

  /* ── Auto-fit on first load — gate canvas render until after fit ── */
  useEffect(() => {
    const ready = isImage ? (imageDimensions !== null) : (loaded && pageDimensions.size > 0);
    if (ready && !autoFitted) {
      const dims = effectivePageDimensions.get(1);
      if (dims && scrollRef.current) {
        const vw = scrollRef.current.clientWidth;
        const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, (vw - 40) / dims.width));
        useViewportStore.getState().setZoom(z);
      }
      setAutoFitted(true);
    }
  }, [isImage, imageDimensions, loaded, pageDimensions, effectivePageDimensions, autoFitted]);

  /* ── Ctrl+wheel zoom toward cursor ── */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();

      const { zoom } = useViewportStore.getState();
      const factor = 1 - e.deltaY * ZOOM_WHEEL_SENSITIVITY;
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * factor));
      useViewportStore.getState().setZoom(newZoom);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [loaded, isImage]);

  /* ── Scroll to page when sidebar label is clicked ── */
  const scrollTargetPage = useUIStore((s) => s.scrollTargetPage);
  useEffect(() => {
    if (scrollTargetPage === null) return;
    const el = pageElementsRef.current.get(scrollTargetPage);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    useUIStore.getState().setScrollTargetPage(null);
  }, [scrollTargetPage]);

  /* ── Re-render canvases when zoom changes (gated by auto-fit) ── */
  useEffect(() => {
    if (isImage) return;
    if (!loaded || !autoFitted) return;
    const renderAll = async () => {
      const currentZoom = useViewportStore.getState().zoom;
      for (let i = 1; i <= pageCount; i++) {
        const el = pageElementsRef.current.get(i);
        const canvas = el?.querySelector("canvas");
        if (canvas) {
          const dims = pageDimensions.get(i);
          if (dims) {
            canvas.width = dims.width * currentZoom;
            canvas.height = dims.height * currentZoom;
            await renderPage(i, canvas, currentZoom).catch(() => {});
          }
        }
      }
    };
    renderAll();
  }, [isImage, loaded, autoFitted, zoom, pageCount, pageDimensions, renderPage]);

  /* ── Page-level event handlers ── */

  const handlePageMouseDown = useCallback(
    (page: number, e: any) => {
      if (activeTool === "draw-rectangle") {
        const pos = e.target.getStage().getPointerPosition();
        if (!pos) return;
        e.evt.preventDefault();
        setDrawingPage(page);
        clearDrawing();
        setDrawing(true);
        addDrawingPoint([pos.x, pos.y]);
        setMousePos({ x: pos.x, y: pos.y });
        return;
      }

      if (e.target === e.target.getStage()) {
        selectAnnotation(null);
      }
    },
    [activeTool, clearDrawing, addDrawingPoint, setDrawing, selectAnnotation],
  );

  const handlePageMouseMove = useCallback(
    (e: any) => {
      if (activeTool === "draw-rectangle" && drawing) {
        const pos = e.target.getStage().getPointerPosition();
        if (pos) {
          setMousePos({ x: pos.x, y: pos.y });
          setDrawingPoint(1, [pos.x, pos.y]);
        }
      }
    },
    [activeTool, drawing, setDrawingPoint],
  );

  const handlePageMouseUp = useCallback(
    (page: number, e: any) => {
      if (activeTool === "draw-rectangle" && drawing) {
        const pos = e.target.getStage().getPointerPosition();
        if (!pos) return;
        setDrawingPoint(1, [pos.x, pos.y]);
        completeDrawing(page);
      }
    },
    [activeTool, drawing, setDrawingPoint],
  );

  const handlePageDblClick = useCallback(
    (page: number, e: any) => {
      if (drawing) {
        e.evt.preventDefault();
        completeDrawing(page);
      }
    },
    [drawing],
  );

  const handleContextMenuEvent = useCallback(
    (e: any) => {
      if (drawing) {
        e.evt.preventDefault();
        clearDrawing();
        setDrawingPage(null);
        return;
      }
      if (selectedId) {
        e.evt.preventDefault();
        setContextMenu({
          x: e.evt.clientX,
          y: e.evt.clientY,
          annotationId: selectedId,
        });
      }
    },
    [drawing, selectedId, clearDrawing],
  );

  const completeDrawing = useCallback(
    (page: number) => {
      const state = useAnnotationStore.getState();
      const pts = state.drawingPoints;
      if (pts.length < 2) {
        state.clearDrawing();
        setDrawingPage(null);
        return;
      }

      const dims = effectivePageDimensions.get(page);
      if (!dims) {
        state.clearDrawing();
        setDrawingPage(null);
        return;
      }

      const viewport = { zoom, panX: 0, panY: 0 };

      // Normalize both corners
      const norm0 = screenToDocument(pts[0][0], pts[0][1], dims, viewport);
      const norm1 = screenToDocument(pts[1][0], pts[1][1], dims, viewport);

      // Ensure top-left, bottom-right ordering
      const topLeft: [number, number] = [
        Math.min(norm0[0], norm1[0]),
        Math.min(norm0[1], norm1[1]),
      ];
      const bottomRight: [number, number] = [
        Math.max(norm0[0], norm1[0]),
        Math.max(norm0[1], norm1[1]),
      ];

      // Minimum size threshold (skip accidental clicks)
      const MIN_SIZE = 0.005;
      if (
        bottomRight[0] - topLeft[0] < MIN_SIZE ||
        bottomRight[1] - topLeft[1] < MIN_SIZE
      ) {
        state.clearDrawing();
        setDrawingPage(null);
        return;
      }

      const annotation: Annotation = {
        id: crypto.randomUUID(),
        documentId,
        pageNumber: page,
        label: null,
        labelColor: null,
        annotationType: "extraction",
        points: [topLeft, bottomRight],
        labelPosition: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      state.addAnnotation(annotation);

      useHistoryStore.getState().pushCommand({
        type: "create",
        annotationId: annotation.id,
        before: null,
        after: { ...annotation } as Partial<Annotation>,
      });

      state.clearDrawing();
      state.selectAnnotation(annotation.id);
      setDrawingPage(null);
      setActiveTool("select");

      /* Show label naming popup near the rectangle */
      const pageEl = pageElementsRef.current.get(page);
      if (pageEl) {
        const pr = pageEl.getBoundingClientRect();
        const pw = pageEl.clientWidth;
        const ph = pageEl.clientHeight;
        const popupX = pr.left + bottomRight[0] * pw + 12;
        const popupY = pr.top + topLeft[1] * ph + 12;
        setLabelPopupAnnId(annotation.id);
        setLabelPopupPos({ x: popupX, y: popupY });
      }
    },
    [documentId, effectivePageDimensions, zoom, setActiveTool],
  );

  /* ── Keyboard shortcuts ── */

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "Escape") {
        if (drawing) {
          clearDrawing();
          setDrawingPage(null);
          return;
        }
        selectAnnotation(null);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId && !drawing) {
          const ann = useAnnotationStore
            .getState()
            .annotations.find((a) => a.id === selectedId);
          if (ann) {
            useHistoryStore.getState().pushCommand({
              type: "delete",
              annotationId: selectedId,
              before: { ...ann } as Partial<Annotation>,
              after: null,
            });
          }
          useAnnotationStore.getState().removeAnnotation(selectedId);
          selectAnnotation(null);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        if (e.shiftKey) {
          useHistoryStore.getState().redo();
        } else {
          useHistoryStore.getState().undo();
        }
      }
      if (e.key === "Enter" && drawing && drawingPage) {
        e.preventDefault();
        completeDrawing(drawingPage);
        return;
      }
    },
    [drawing, selectedId, drawingPage, clearDrawing, selectAnnotation, completeDrawing],
  );

  /* ── Global shortcuts ── */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        useAnnotationStore.getState().clearDrawing();
        useUIStore.getState().setActiveTool("select");
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        useAnnotationStore.getState().clearDrawing();
        useUIStore.getState().setActiveTool("draw-rectangle");
      }

    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* ── Context menu actions ── */

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const contextDelete = useCallback(() => {
    if (!contextMenu) return;
    const ann = useAnnotationStore
      .getState()
      .annotations.find((a) => a.id === contextMenu.annotationId);
    if (ann) {
      useHistoryStore.getState().pushCommand({
        type: "delete",
        annotationId: contextMenu.annotationId,
        before: { ...ann } as Partial<Annotation>,
        after: null,
      });
    }
    useAnnotationStore.getState().removeAnnotation(contextMenu.annotationId);
    selectAnnotation(null);
    setContextMenu(null);
  }, [contextMenu, selectAnnotation]);

  if (error) {
    return <div>Failed to load PDF: {error}</div>;
  }

  if (docMetaLoading || (isImage && !imageDimensions) || (!isImage && (!loaded || pageDimensions.size === 0))) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#e5e7eb",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            border: "3px solid #d1d5db",
            borderTopColor: "#3b82f6",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <div style={{ fontSize: 13, color: "#6b7280" }}>Loading document…</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
        style={{
          width: "100%",
          height: "100%",
          overflow: "auto",
          outline: "none",
          background: "#E2E8F0",
        }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "24px 0",
          gap: 20,
        }}
      >
        {Array.from({ length: effectivePageCount }, (_, i) => i + 1).map((page) => {
          const dims = effectivePageDimensions.get(page);
          if (!dims) return null;
          const w = dims.width * zoom;
          const h = dims.height * zoom;

          return (
            <div
              key={page}
              data-pageid={page}
              ref={(el) => {
                if (el) pageElementsRef.current.set(page, el);
                else pageElementsRef.current.delete(page);
              }}
              style={{
                position: "relative",
                width: w,
                height: h,
                boxShadow: "0px 4px 20px rgba(0,0,0,0.08)",
                background: "#fff",
              }}
            >
              {isImage ? (
                <img
                  src={imageUrl!}
                  alt={`Document page ${page}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: w,
                    height: h,
                    display: "block",
                    objectFit: "contain",
                  }}
                />
              ) : (
                <canvas
                  width={w}
                  height={h}
                  style={{ position: "absolute", top: 0, left: 0, display: "block" }}
                />
              )}
              <Stage
                x={0}
                y={0}
                width={w}
                height={h}
                style={{ position: "absolute", top: 0, left: 0 }}
                onMouseDown={(e) => handlePageMouseDown(page, e)}
                onMouseMove={handlePageMouseMove}
                onMouseUp={(e) => handlePageMouseUp(page, e)}
                onDblClick={(e) => handlePageDblClick(page, e)}
                onContextMenu={handleContextMenuEvent}
              >
                <Layer>
                  <AnnotationLayer
                    pageNumber={page}
                    pageDimensions={dims}
                    mousePos={drawing && drawingPage === page ? mousePos : null}
                  />
                </Layer>
              </Stage>
            </div>
          );
        })}
      </div>

      <ViewportControls />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onEditLabel={() => {}}
          onDelete={contextDelete}
          onClose={closeContextMenu}
        />
      )}

      {labelPopupAnnId && labelPopupPos && (
        <LabelPopup
          annotationId={labelPopupAnnId}
          position={labelPopupPos}
          onClose={() => {
            setLabelPopupAnnId(null);
            setLabelPopupPos(null);
          }}
        />
      )}
    </div>
  );
}

export { PdfRenderer };
