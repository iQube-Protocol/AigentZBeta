/**
 * PDFPageViewer - Lazy-loading page-based PDF viewer
 *
 * Custody-safe page-image renderer.
 * Uses page manifests + page image streaming (/api/content/pdf-page) to avoid
 * exposing raw PDF URLs to clients.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/app/config/api";

interface PDFPageViewerProps {
  cid: string;
  title?: string;
  onClose: () => void;
}

interface PageMeta {
  pages: number;
  suggestedWidth?: number;
}

interface PageManifest {
  pagesCount: number;
  width: number;
  pages: string[];
  cached?: boolean;
}

export function PDFPageViewer({ cid, title, onClose }: PDFPageViewerProps) {
  const [manifest, setManifest] = useState<PageManifest | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loadingMeta, setLoadingMeta] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set());
  const [failedPages, setFailedPages] = useState<Set<number>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const apiBase = API_BASE_URL;

  useEffect(() => {
    const fetchPages = async () => {
      try {
        const manifestRes = await fetch(`${apiBase}/api/content/pdf-pages/${cid}`);
        if (manifestRes.ok) {
          const data = await manifestRes.json();
          setManifest(data);
          setMeta({ pages: data.pagesCount, suggestedWidth: data.width });
          setLoadingMeta(false);
          return;
        }

        const metaRes = await fetch(`${apiBase}/api/content/pdf-meta/${cid}`);
        if (!metaRes.ok) throw new Error(`HTTP ${metaRes.status}`);
        const data = await metaRes.json();
        setMeta(data);
        setLoadingMeta(false);
      } catch (err) {
        setError(`Failed to load PDF: ${err instanceof Error ? err.message : "Unknown error"}`);
        setLoadingMeta(false);
      }
    };
    fetchPages();
  }, [apiBase, cid]);

  useEffect(() => {
    if (!meta) return;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const pageNum = Number(entry.target.getAttribute("data-page"));
          if (!Number.isInteger(pageNum) || pageNum < 1) return;
          setLoadedPages((prev) => {
            const next = new Set(prev);
            next.add(pageNum);
            return next;
          });
        });
      },
      {
        root: containerRef.current,
        rootMargin: "200px",
        threshold: 0.01,
      }
    );
    return () => observerRef.current?.disconnect();
  }, [meta]);

  useEffect(() => {
    if (!observerRef.current || !meta) return;
    const pageElements = containerRef.current?.querySelectorAll("[data-page]");
    pageElements?.forEach((el) => observerRef.current?.observe(el));
    return () => {
      pageElements?.forEach((el) => observerRef.current?.unobserve(el));
    };
  }, [meta]);

  const scrollToPage = useCallback((pageNum: number) => {
    const pageEl = containerRef.current?.querySelector(`[data-page="${pageNum}"]`);
    pageEl?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const goToPrevPage = useCallback(() => {
    if (currentPage <= 1) return;
    const nextPage = currentPage - 1;
    setCurrentPage(nextPage);
    scrollToPage(nextPage);
  }, [currentPage, scrollToPage]);

  const goToNextPage = useCallback(() => {
    if (!meta || currentPage >= meta.pages) return;
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    scrollToPage(nextPage);
  }, [currentPage, meta, scrollToPage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goToPrevPage();
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goToNextPage();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [goToNextPage, goToPrevPage, onClose]);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  if (loadingMeta) {
    return (
      <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">{title || "PDF Viewer"}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <span className="ml-3 text-gray-400">Loading PDF...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  if (!meta) return null;

  const width = Math.min(meta.suggestedWidth || 1200, 1200);
  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white truncate max-w-md">{title || "PDF Viewer"}</h2>
          <span className="text-sm text-gray-400">
            Page {currentPage} of {meta.pages}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden" style={{ scrollBehavior: "smooth" }}>
        <div className="flex flex-col items-center gap-4 p-4">
          {Array.from({ length: meta.pages }, (_, i) => i + 1).map((pageNum) => (
            <PDFPageImage
              key={pageNum}
              cid={cid}
              pageNum={pageNum}
              width={width}
              apiBase={apiBase}
              shouldLoad={loadedPages.has(pageNum)}
              onInView={(num) => setCurrentPage(num)}
              onError={() =>
                setFailedPages((prev) => {
                  const next = new Set(prev);
                  next.add(pageNum);
                  return next;
                })
              }
              onRetry={() =>
                setFailedPages((prev) => {
                  const next = new Set(prev);
                  next.delete(pageNum);
                  return next;
                })
              }
              isFailed={failedPages.has(pageNum)}
              pageUrl={manifest?.pages[pageNum - 1]}
            />
          ))}
        </div>
      </div>

      {meta.pages > 1 && (
        <div className="flex items-center justify-center gap-4 px-4 py-3 bg-gray-900 border-t border-gray-800">
          <Button variant="outline" size="sm" onClick={goToPrevPage} disabled={currentPage <= 1} className="flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>

          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={meta.pages}
              value={currentPage}
              onChange={(e) => {
                const page = Number(e.target.value);
                if (Number.isInteger(page) && page >= 1 && page <= meta.pages) {
                  setCurrentPage(page);
                  scrollToPage(page);
                }
              }}
              className="w-16 px-2 py-1 text-center bg-gray-800 border border-gray-700 rounded text-white text-sm"
            />
            <span className="text-gray-400">/ {meta.pages}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={goToNextPage}
            disabled={currentPage >= meta.pages}
            className="flex items-center gap-1"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

interface PDFPageImageProps {
  cid: string;
  pageNum: number;
  width: number;
  apiBase: string;
  shouldLoad: boolean;
  onInView: (pageNum: number) => void;
  onError: () => void;
  onRetry: () => void;
  isFailed: boolean;
  pageUrl?: string;
}

function PDFPageImage({
  cid,
  pageNum,
  width,
  apiBase,
  shouldLoad,
  onInView,
  onError,
  onRetry,
  isFailed,
  pageUrl: prerenderedUrl,
}: PDFPageImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageUrl = prerenderedUrl || `${apiBase}/api/content/pdf-page/${cid}?page=${pageNum}&width=${width}`;

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onInView(pageNum);
      },
      { threshold: 0.5 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [onInView, pageNum]);

  useEffect(() => {
    if (shouldLoad && !loaded && !loading && !isFailed) {
      setLoading(true);
    }
  }, [isFailed, loaded, loading, shouldLoad]);

  return (
    <div
      ref={containerRef}
      data-page={pageNum}
      className="relative bg-gray-900 rounded shadow-2xl"
      style={{
        width: `${width}px`,
        minHeight: loading || !loaded ? "800px" : "auto",
      }}
    >
      <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-10">Page {pageNum}</div>

      {loading && !loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
      )}

      {isFailed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-red-400">
            <p className="text-sm">Failed to load page {pageNum}</p>
            <button
              onClick={() => {
                onRetry();
                setLoaded(false);
                setLoading(true);
              }}
              className="text-xs text-cyan-400 hover:underline mt-2"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {(shouldLoad || loaded || loading) && !isFailed && (
        <img
          src={pageUrl}
          alt={`Page ${pageNum}`}
          onLoad={() => {
            setLoaded(true);
            setLoading(false);
          }}
          onError={() => {
            setLoading(false);
            onError();
          }}
          className={`w-full h-auto select-none ${loaded ? "block" : "hidden"}`}
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
        />
      )}
    </div>
  );
}
