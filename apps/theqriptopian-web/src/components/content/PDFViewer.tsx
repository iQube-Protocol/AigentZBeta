/**
 * PDFViewer - Canvas-based PDF viewer using PDF.js
 * 
 * Renders PDFs to canvas elements for secure viewing.
 * Prevents downloading by not exposing the raw PDF file.
 */

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Load PDF.js from CDN - using stable version 3.11.174
const PDFJS_VERSION = '3.11.174';
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

// Dynamically load PDF.js
let pdfjsLib: any = null;
const loadPdfJs = async () => {
  if (pdfjsLib) return pdfjsLib;
  
  // Load the library
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
  
  // @ts-ignore - PDF.js adds to window
  pdfjsLib = window.pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
  
  return pdfjsLib;
};

interface PDFViewerProps {
  pdfUrl: string;
  title?: string;
  onClose: () => void;
}

// Page cache for preloaded pages
type PageCache = Map<string, ImageData>;

export function PDFViewer({ pdfUrl, title, onClose }: PDFViewerProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageCacheRef = useRef<PageCache>(new Map());
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load PDF.js and fetch PDF
  useEffect(() => {
    let cancelled = false;
    
    const loadPdf = async () => {
      try {
        console.log('[PDFViewer] Loading PDF.js...');
        const pdfjs = await loadPdfJs();
        
        console.log('[PDFViewer] Fetching PDF from:', pdfUrl);
        const response = await fetch(pdfUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        console.log('[PDFViewer] Fetched', arrayBuffer.byteLength, 'bytes');
        
        if (cancelled) return;
        
        // Load the PDF document
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        if (cancelled) return;
        
        console.log('[PDFViewer] PDF loaded, pages:', pdf.numPages);
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setLoading(false);
      } catch (err) {
        console.error('[PDFViewer] Load error:', err);
        if (!cancelled) {
          setError(`Failed to load PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
          setLoading(false);
        }
      }
    };
    
    loadPdf();
    return () => { cancelled = true; };
  }, [pdfUrl]);

  // Track render state with ref to avoid re-render loops
  const renderingRef = useRef(false);
  const lastRenderRef = useRef({ page: 0, scale: 0 });
  const preloadingRef = useRef<Set<string>>(new Set());

  // Get cache key for a page at a specific scale
  const getCacheKey = (pageNum: number, pageScale: number) => `${pageNum}-${pageScale.toFixed(2)}`;

  // Render a page to ImageData (for caching)
  const renderPageToImageData = async (pageNum: number, pageScale: number): Promise<ImageData | null> => {
    if (!pdfDoc) return null;
    
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: pageScale });
      
      // Create or reuse offscreen canvas
      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
      }
      const offscreen = offscreenCanvasRef.current;
      offscreen.width = viewport.width;
      offscreen.height = viewport.height;
      
      const context = offscreen.getContext('2d');
      if (!context) return null;
      
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;
      
      return context.getImageData(0, 0, viewport.width, viewport.height);
    } catch (err) {
      console.error('[PDFViewer] Preload error for page', pageNum, err);
      return null;
    }
  };

  // Preload adjacent pages
  const preloadAdjacentPages = async (centerPage: number, pageScale: number) => {
    if (!pdfDoc) return;
    
    const pagesToPreload = [
      centerPage - 1,
      centerPage + 1,
    ].filter(p => p >= 1 && p <= numPages && p !== centerPage);
    
    for (const pageNum of pagesToPreload) {
      const cacheKey = getCacheKey(pageNum, pageScale);
      
      // Skip if already cached or being preloaded
      if (pageCacheRef.current.has(cacheKey) || preloadingRef.current.has(cacheKey)) {
        continue;
      }
      
      preloadingRef.current.add(cacheKey);
      
      // Preload in background
      renderPageToImageData(pageNum, pageScale).then(imageData => {
        if (imageData) {
          pageCacheRef.current.set(cacheKey, imageData);
          console.log('[PDFViewer] Preloaded page', pageNum, 'at scale', pageScale);
        }
        preloadingRef.current.delete(cacheKey);
      });
    }
  };

  // Clear cache when scale changes significantly
  useEffect(() => {
    // Clear cache entries that don't match current scale
    const currentScaleStr = scale.toFixed(2);
    const keysToDelete: string[] = [];
    
    pageCacheRef.current.forEach((_, key) => {
      if (!key.endsWith(`-${currentScaleStr}`)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => pageCacheRef.current.delete(key));
  }, [scale]);

  // Render current page to canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || loading) return;
    
    // Skip if already rendering or same page/scale
    if (renderingRef.current) return;
    if (lastRenderRef.current.page === currentPage && 
        lastRenderRef.current.scale === scale) return;
    
    renderingRef.current = true;
    
    const renderPage = async () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const context = canvas.getContext('2d');
        if (!context) return;
        
        const cacheKey = getCacheKey(currentPage, scale);
        const cachedImageData = pageCacheRef.current.get(cacheKey);
        
        if (cachedImageData) {
          // Use cached image data - instant render!
          canvas.width = cachedImageData.width;
          canvas.height = cachedImageData.height;
          context.putImageData(cachedImageData, 0, 0);
          console.log('[PDFViewer] Rendered page', currentPage, 'from cache');
        } else {
          // Render fresh
          const page = await pdfDoc.getPage(currentPage);
          const viewport = page.getViewport({ scale });
          
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;
          
          // Cache the rendered page
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          pageCacheRef.current.set(cacheKey, imageData);
          console.log('[PDFViewer] Rendered page', currentPage, 'fresh');
        }
        
        // Track what we rendered
        lastRenderRef.current = { page: currentPage, scale };
        
        // Preload adjacent pages
        preloadAdjacentPages(currentPage, scale);
      } catch (err) {
        console.error('[PDFViewer] Render error:', err);
      } finally {
        renderingRef.current = false;
      }
    };
    
    renderPage();
  }, [pdfDoc, currentPage, scale, loading, numPages]);

  // Navigation handlers
  const goToPrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, numPages));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3.0));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.25));
  };

  // Prevent right-click context menu and keyboard shortcuts
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'p')) {
        e.preventDefault();
        return false;
      }
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'ArrowLeft') {
        goToPrevPage();
      }
      if (e.key === 'ArrowRight') {
        goToNextPage();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, numPages]);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white truncate max-w-md">
            {title || 'PDF Viewer'}
          </h2>
          {!loading && numPages > 0 && (
            <span className="text-sm text-gray-400">
              Page {currentPage} of {numPages}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomOut}
            disabled={scale <= 0.25}
            className="text-gray-400 hover:text-white"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm text-gray-400 w-16 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomIn}
            disabled={scale >= 3.0}
            className="text-gray-400 hover:text-white"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          
          <div className="w-px h-6 bg-gray-700 mx-2" />
          
          {/* Close button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* PDF Content */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto flex items-start justify-center p-4"
      >
        {loading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <span className="ml-3 text-gray-400">Loading PDF...</span>
          </div>
        )}
        
        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}

        {!loading && !error && pdfDoc && (
          <canvas 
            ref={canvasRef} 
            className="shadow-2xl select-none"
            style={{ 
              maxWidth: '100%',
              height: 'auto',
            }}
          />
        )}
      </div>

      {/* Navigation Footer */}
      {!loading && !error && numPages > 1 && (
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
              max={numPages}
              value={currentPage}
              onChange={(e) => {
                const page = parseInt(e.target.value, 10);
                if (page >= 1 && page <= numPages) {
                  setCurrentPage(page);
                }
              }}
              className="w-16 px-2 py-1 text-center bg-gray-800 border border-gray-700 rounded text-white text-sm"
            />
            <span className="text-gray-400">/ {numPages}</span>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextPage}
            disabled={currentPage >= numPages}
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
          Press ESC to close • Use arrow keys or buttons to navigate
        </span>
      </div>
    </div>
  );
}
