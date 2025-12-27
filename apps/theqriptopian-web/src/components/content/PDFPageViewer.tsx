/**
 * PDFPageViewer - Lazy-loading page-based PDF viewer
 * 
 * Renders PDFs as individual page images loaded on-demand.
 * Avoids CloudFront 413 errors by requesting small WebP page images.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PDFPageViewerProps {
  cid: string;
  title?: string;
  pdfLiteUrl?: string | null;
  onClose: () => void;
}

interface PageMeta {
  pages: number;
  suggestedWidth: number;
  pdfLiteUrl?: string;
}

export function PDFPageViewer({ cid, title, pdfLiteUrl, onClose }: PDFPageViewerProps) {
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loadingMeta, setLoadingMeta] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set());
  const [failedPages, setFailedPages] = useState<Set<number>>(new Set());
  
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL || '';

  // Fetch PDF metadata
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        console.log('[PDFPageViewer] Fetching metadata for CID:', cid);
        const response = await fetch(`${apiUrl}/api/content/pdf-meta/${cid}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        console.log('[PDFPageViewer] Metadata:', data);
        setMeta(data);
        setLoadingMeta(false);
      } catch (err) {
        console.error('[PDFPageViewer] Meta fetch error:', err);
        setError(`Failed to load PDF metadata: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setLoadingMeta(false);
      }
    };
    fetchMeta();
  }, [cid, apiUrl]);

  // Setup intersection observer for lazy loading
  useEffect(() => {
    if (!meta) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.getAttribute('data-page') || '0', 10);
            if (pageNum > 0) {
              setLoadedPages((prev) => new Set(prev).add(pageNum));
            }
          }
        });
      },
      {
        root: containerRef.current,
        rootMargin: '200px', // Preload pages 200px before they're visible
        threshold: 0.01,
      }
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, [meta]);

  // Observe page elements
  useEffect(() => {
    if (!observerRef.current || !meta) return;

    const pageElements = containerRef.current?.querySelectorAll('[data-page]');
    pageElements?.forEach((el) => observerRef.current?.observe(el));

    return () => {
      pageElements?.forEach((el) => observerRef.current?.unobserve(el));
    };
  }, [meta]);

  const goToPrevPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      scrollToPage(newPage);
    }
  };

  const goToNextPage = () => {
    if (meta && currentPage < meta.pages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      scrollToPage(newPage);
    }
  };

  const scrollToPage = (pageNum: number) => {
    const pageEl = containerRef.current?.querySelector(`[data-page="${pageNum}"]`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePageInView = useCallback((pageNum: number) => {
    setCurrentPage(pageNum);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goToPrevPage();
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goToNextPage();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, currentPage, meta]);

  // Prevent context menu
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  if (loadingMeta) {
    return (
      <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
        {/* Header with close button */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">
            {title || 'PDF Viewer'}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Loading content */}
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

  if (!meta) {
    return null;
  }

  // If pdf_lite_url is available (from prop or meta), use iframe rendering (preferred)
  const effectivePdfLiteUrl = pdfLiteUrl || meta.pdfLiteUrl;
  if (effectivePdfLiteUrl) {
    return (
      <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">
            {title || 'PDF Viewer'}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        {/* PDF iframe */}
        <div className="flex-1 relative">
          <iframe
            src={effectivePdfLiteUrl}
            className="absolute inset-0 w-full h-full border-0"
            title={title || 'PDF Viewer'}
          />
        </div>
      </div>
    );
  }

  // Fallback to page-by-page rendering
  const width = Math.min(meta.suggestedWidth, 1200);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white truncate max-w-md">
            {title || 'PDF Viewer'}
          </h2>
          <span className="text-sm text-gray-400">
            Page {currentPage} of {meta.pages}
          </span>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Scrollable page container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="flex flex-col items-center gap-4 p-4">
          {Array.from({ length: meta.pages }, (_, i) => i + 1).map((pageNum) => (
            <PDFPageImage
              key={pageNum}
              cid={cid}
              pageNum={pageNum}
              width={width}
              apiUrl={apiUrl}
              shouldLoad={loadedPages.has(pageNum)}
              onInView={handlePageInView}
              onError={() => setFailedPages((prev) => new Set(prev).add(pageNum))}
              isFailed={failedPages.has(pageNum)}
            />
          ))}
        </div>
      </div>

      {/* Navigation Footer */}
      {meta.pages > 1 && (
        <div className="flex items-center justify-center gap-4 px-4 py-3 bg-gray-900 border-t border-gray-800">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevPage}
            disabled={currentPage <= 1}
            className="flex items-center gap-1"
          >
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
                const page = parseInt(e.target.value, 10);
                if (page >= 1 && page <= meta.pages) {
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

      {/* Footer hint */}
      <div className="px-4 py-2 bg-gray-900/50 text-center">
        <span className="text-xs text-gray-500">
          Press ESC to close • Use arrow keys or scroll to navigate
        </span>
      </div>
    </div>
  );
}

interface PDFPageImageProps {
  cid: string;
  pageNum: number;
  width: number;
  apiUrl: string;
  shouldLoad: boolean;
  onInView: (pageNum: number) => void;
  onError: () => void;
  isFailed: boolean;
}

function PDFPageImage({ 
  cid, 
  pageNum, 
  width, 
  apiUrl, 
  shouldLoad, 
  onInView,
  onError,
  isFailed,
}: PDFPageImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const pageUrl = `${apiUrl}/api/content/pdf-page/${cid}?page=${pageNum}&width=${width}`;

  // Track when page enters viewport
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onInView(pageNum);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [pageNum, onInView]);

  // Load image when shouldLoad becomes true
  useEffect(() => {
    if (shouldLoad && !loaded && !loading && !isFailed) {
      setLoading(true);
    }
  }, [shouldLoad, loaded, loading, isFailed]);

  const handleLoad = () => {
    setLoaded(true);
    setLoading(false);
    console.log(`[PDFPageViewer] Loaded page ${pageNum}`);
  };

  const handleError = () => {
    setLoading(false);
    onError();
    console.error(`[PDFPageViewer] Failed to load page ${pageNum}`);
  };

  return (
    <div
      ref={containerRef}
      data-page={pageNum}
      className="relative bg-gray-900 rounded shadow-2xl"
      style={{ 
        width: `${width}px`,
        minHeight: loading || !loaded ? '800px' : 'auto',
      }}
    >
      {/* Page number badge */}
      <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-10">
        Page {pageNum}
      </div>

      {/* Loading state */}
      {loading && !loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
      )}

      {/* Error state */}
      {isFailed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-red-400">
            <p className="text-sm">Failed to load page {pageNum}</p>
            <button
              onClick={() => {
                onError();
                setLoading(true);
              }}
              className="text-xs text-cyan-400 hover:underline mt-2"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Actual image */}
      {loading && (
        <img
          ref={imgRef}
          src={pageUrl}
          alt={`Page ${pageNum}`}
          onLoad={handleLoad}
          onError={handleError}
          className={`w-full h-auto select-none ${loaded ? 'block' : 'hidden'}`}
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
        />
      )}
    </div>
  );
}
