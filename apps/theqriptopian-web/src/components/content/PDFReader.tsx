/**
 * PDFReader - In-app PDF viewer that prevents downloading
 * 
 * Renders PDFs as canvas elements to prevent direct file access.
 * Disables right-click context menu and keyboard shortcuts.
 */

import { useState, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFReaderProps {
  pdfUrl: string;
  title?: string;
  onClose: () => void;
}

export function PDFReader({ pdfUrl, title, onClose }: PDFReaderProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);

  // Fetch PDF data on mount
  useEffect(() => {
    const fetchPdf = async () => {
      try {
        console.log('[PDFReader] Fetching PDF from:', pdfUrl);
        const response = await fetch(pdfUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.arrayBuffer();
        console.log('[PDFReader] Fetched', data.byteLength, 'bytes');
        setPdfData(data);
      } catch (err) {
        console.error('[PDFReader] Fetch error:', err);
        setError(`Failed to fetch PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setLoading(false);
      }
    };
    fetchPdf();
  }, [pdfUrl]);

  // Prevent right-click context menu
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Prevent keyboard shortcuts for saving/printing
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'p')) {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('[PDFReader] Load error:', error);
    console.error('[PDFReader] PDF URL:', pdfUrl);
    setError(`Failed to load PDF: ${error.message}`);
    setLoading(false);
  }, [pdfUrl]);

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white truncate max-w-md">
            {title || 'PDF Reader'}
          </h2>
          {!loading && numPages > 0 && (
            <span className="text-sm text-gray-400">
              Page {pageNumber} of {numPages}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomOut}
            disabled={scale <= 0.5}
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
      <div className="flex-1 overflow-auto flex items-start justify-center p-4">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <span className="ml-3 text-gray-400">Loading PDF...</span>
          </div>
        )}
        
        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-red-400 mb-2">{error}</p>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}

        {pdfData && (
          <Document
            file={{ data: pdfData }}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={null}
            className="select-none"
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="shadow-2xl"
            />
          </Document>
        )}
      </div>

      {/* Navigation Footer */}
      {!loading && !error && numPages > 1 && (
        <div className="flex items-center justify-center gap-4 px-4 py-3 bg-gray-900 border-t border-gray-800">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
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
              value={pageNumber}
              onChange={(e) => {
                const page = parseInt(e.target.value, 10);
                if (page >= 1 && page <= numPages) {
                  setPageNumber(page);
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
            disabled={pageNumber >= numPages}
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
