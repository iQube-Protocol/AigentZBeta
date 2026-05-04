/**
 * PDFPageViewer - Lazy-loading page-based PDF viewer
 *
 * Custody-safe page-image renderer.
 * Uses page manifests + page image streaming (/api/content/pdf-page) to avoid
 * exposing raw PDF URLs to clients.
 *
 * Mobile note: page-image streaming + IntersectionObserver scroll viewer
 * doesn't fit a small viewport. On mobile we hand off to the OS-native PDF
 * reader (Safari/Chrome built-in) via target="_blank" — same pattern as
 * PDFLiteReaderModal. Desktop keeps the page-image flow intact.
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

function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isMobile;
}

/**
 * Resolve a "cid" parameter to a fetchable PDF URL. For Supabase-hosted
 * masters, auto_drive_cid is already an http(s) URL — use it directly.
 * For Auto-Drive CIDs, route through the decryption proxy with proper
 * URL-encoding so slashes don't collapse into the dynamic route.
 */
function resolvePdfHref(cid: string, apiBase: string): string {
  if (cid.startsWith('http://') || cid.startsWith('https://')) return cid;
  return `${apiBase}/api/content/pdf/${encodeURIComponent(cid)}`;
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
  const isMobile = useIsMobileViewport();
  const isUrlCid = cid.startsWith('http://') || cid.startsWith('https://');
  const directPdfHref = resolvePdfHref(cid, apiBase);

  useEffect(() => {
    // Mobile or URL-hosted PDF: skip the page-manifest fetch entirely. We're
    // handing off to the OS-native viewer; the page-image flow doesn't apply.
    if (isMobile || isUrlCid) {
      setLoadingMeta(false);
      return;
    }
    const fetchPages = async () => {
      try {
        const manifestRes = await fetch(`${apiBase}/api/content/pdf-pages/${encodeURIComponent(cid)}`);
        if (manifestRes.ok) {
          const data = await manifestRes.json();
          setManifest(data);
          setMeta({ pages: data.pagesCount, suggestedWidth: data.width });
          setLoadingMeta(false);
          return;
        }

        const metaRes = await fetch(`${apiBase}/api/content/pdf-meta/${encodeURIComponent(cid)}`);
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
  }, [apiBase, cid, isMobile, isUrlCid]);

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

  // Mobile branch: skip the in-page renderer and hand off to the OS-native
  // PDF reader. Same UX as PDFLiteReaderModal so users get a consistent
  // mobile experience regardless of which viewer was selected.
  if (isMobile || isUrlCid) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-2xl"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="relative w-full h-full md:w-[min(560px,95vw)] md:h-auto md:max-h-[60vh] bg-zinc-950 border border-white/10 rounded-none md:rounded-xl overflow-hidden shadow-xl">
          <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">
                {title || 'Reading'}
              </div>
              <div className="text-xs text-white/60 truncate">PDF reader</div>
            </div>
            <button
              className="w-10 h-10 rounded-full bg-black/50 border border-white/20 text-white hover:bg-black/70 transition-colors flex items-center justify-center"
              onClick={onClose}
              aria-label="Close PDF preview"
            >
              ×
            </button>
          </div>
          <div className="flex flex-col items-center justify-center px-6 py-8 text-center gap-5">
            <div className="text-sm text-white/90 max-w-[36ch]">
              Open the PDF in your browser&rsquo;s native reader for the
              best experience{isMobile ? ' on mobile' : ''}.
            </div>
            <a
              href={directPdfHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/20 px-5 py-3 text-sm font-medium text-white transition-colors"
              onClick={() => {
                setTimeout(onClose, 100);
              }}
            >
              Open PDF
            </a>
            <div className="text-[11px] text-white/50 max-w-[36ch]">
              {title || 'Document'}
            </div>
          </div>
        </div>
      </div>
    );
  }

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
