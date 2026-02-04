/**
 * PDFLiteReaderModal - Lightweight PDF Reader Modal
 * 
 * Ported from Qriptopian Web App with SmartTriad integration
 * Displays PDF content using a lightweight iframe approach.
 */

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PDFLiteReaderModalProps {
  open: boolean;
  pdfUrl: string;
  title: string;
  onClose: () => void;
}

export function PDFLiteReaderModal({ open, pdfUrl, title, onClose }: PDFLiteReaderModalProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && pdfUrl) {
      setLoading(true);
      // Simulate loading time
      const timer = setTimeout(() => setLoading(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [open, pdfUrl]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/60 hover:text-white hover:bg-white/10"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 relative overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-white/60" />
                <p className="text-white/60">Loading PDF...</p>
              </div>
            </div>
          ) : (
            <iframe
              src={pdfUrl}
              className="w-full h-full border-0"
              title={title}
              onLoad={() => setLoading(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
