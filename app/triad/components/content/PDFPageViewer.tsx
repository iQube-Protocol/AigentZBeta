/**
 * PDFPageViewer - PDF Content Viewer
 * 
 * Ported from Qriptopian Web App with SmartTriad integration
 * Displays PDF content with page navigation and zoom controls.
 */

import { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PDFPageViewerProps {
  cid: string;
  title: string;
  pdfLiteUrl?: string | null;
  onClose: () => void;
}

export function PDFPageViewer({ cid, title, pdfLiteUrl, onClose }: PDFPageViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // For now, use a simple implementation with the lite URL if available
  useEffect(() => {
    if (pdfLiteUrl) {
      setLoading(false);
      setTotalPages(1); // Simplified for lite viewer
    }
  }, [pdfLiteUrl]);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            {totalPages > 1 && (
              <span className="text-sm text-white/60">
                Page {currentPage} of {totalPages}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/60 hover:text-white hover:bg-white/10"
              onClick={handleZoomOut}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm text-white/60">{Math.round(scale * 100)}%</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-white/60 hover:text-white hover:bg-white/10"
              onClick={handleZoomIn}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-white/60 hover:text-white hover:bg-white/10"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 relative overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-white/60" />
                <p className="text-white/60">Loading PDF...</p>
              </div>
            </div>
          ) : pdfLiteUrl ? (
            <div className="flex items-center justify-center min-h-full p-8">
              <iframe
                src={pdfLiteUrl}
                className="w-full h-full rounded-lg ring-1 ring-white/10"
                style={{ 
                  maxWidth: '1200px',
                  maxHeight: '800px',
                  transform: `scale(${scale})`,
                  transformOrigin: 'center'
                }}
                title={title}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <canvas
                ref={canvasRef}
                className="ring-1 ring-white/10 rounded-lg"
                style={{ transform: `scale(${scale})` }}
              />
            </div>
          )}
        </div>

        {/* Page Navigation */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 p-4 border-t border-white/10">
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 text-white/60 hover:text-white hover:bg-white/10"
              onClick={handlePrevPage}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-white/60">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 text-white/60 hover:text-white hover:bg-white/10"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
