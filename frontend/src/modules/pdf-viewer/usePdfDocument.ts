import { useEffect, useRef, useState, useCallback } from "react";
import { PdfJsRenderer } from "./PdfJsRenderer";
import type { PdfRenderer } from "./PdfRenderer.interface";

interface UsePdfDocumentResult {
  pageCount: number;
  pageDimensions: Map<number, { width: number; height: number }>;
  renderPage: (page: number, canvas: HTMLCanvasElement, scale: number) => Promise<void>;
  error: string | null;
  loaded: boolean;
}

export function usePdfDocument(url: string | null): UsePdfDocumentResult {
  const rendererRef = useRef<PdfRenderer | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageDimensions, setPageDimensions] = useState<Map<number, { width: number; height: number }>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!url) return;

    let cancelled = false;
    const renderer = new PdfJsRenderer();

    renderer
      .load(url)
      .then(async () => {
        if (cancelled) {
          renderer.destroy();
          return;
        }
        rendererRef.current = renderer;
        const count = renderer.getPageCount();
        setPageCount(count);

        const entries = await Promise.all(
          Array.from({ length: count }, (_, i) =>
            renderer.getPageDimensions(i + 1).then((d) => [i + 1, d] as const)
          )
        );
        if (cancelled) return;
        setPageDimensions(new Map(entries));
        setLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load PDF");
        }
      });

    return () => {
      cancelled = true;
      rendererRef.current = null;
      renderer.destroy();
      setLoaded(false);
      setPageCount(0);
      setPageDimensions(new Map());
    };
  }, [url]);

  const renderPage = useCallback(
    async (page: number, canvas: HTMLCanvasElement, scale: number) => {
      if (!rendererRef.current) throw new Error("PDF not loaded");
      return rendererRef.current.renderToCanvas(page, canvas, scale);
    },
    [],
  );

  return { pageCount, pageDimensions, renderPage, error, loaded };
}
