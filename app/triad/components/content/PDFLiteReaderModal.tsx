/**
 * PDFLiteReaderModal - Lightweight PDF Reader Modal
 *
 * Ported from Qriptopian Web App object-based rendering.
 * Fetches PDF into a local Blob URL so all browsers (including Firefox) render
 * it inline — blob: URLs are same-origin and bypass Content-Disposition issues.
 */

import { useEffect, useState } from 'react';

interface PDFLiteReaderModalProps {
  open: boolean;
  pdfUrl: string;
  title?: string;
  onClose: () => void;
}

export function PDFLiteReaderModal({ open, pdfUrl, title, onClose }: PDFLiteReaderModalProps) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    setLoading(true);
    setFailed(null);
    setBlobUrl(null);

    fetch(pdfUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoading(false);
        setFailed(`Could not load PDF preview. ${err instanceof Error ? err.message : 'Unknown error'}`);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, pdfUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // Disable common print/save/download shortcuts while preview is open.
      if ((e.metaKey || e.ctrlKey) && ['s', 'p', 'd'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    window.addEventListener('keydown', onKey);
    window.addEventListener('contextmenu', onContextMenu);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('contextmenu', onContextMenu);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !loading) return;
    const timer = window.setTimeout(() => {
      setLoading(false);
      setFailed('Preview timed out. Please close and retry.');
    }, 20000);
    return () => window.clearTimeout(timer);
  }, [open, loading]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-2xl"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full h-full md:w-[min(896px,95vw)] md:h-[min(100%,900px)] bg-zinc-950 border border-white/10 rounded-none md:rounded-xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-4 md:px-6 py-4 md:py-5 border-b border-white/10">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">
              {title || 'Reading'}
            </div>
            <div className="text-xs text-white/60 truncate">
              PDF-lite (fast preview)
            </div>
          </div>

          <button
            className="w-10 h-10 rounded-full bg-black/50 border border-white/20 text-white hover:bg-black/70 transition-colors flex items-center justify-center"
            onClick={onClose}
            aria-label="Close PDF preview"
          >
            ×
          </button>
        </div>

        <div className="relative w-full h-[calc(100%-60px)]">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 z-10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              <div className="text-xs text-white/80">Loading PDF...</div>
            </div>
          )}

          {failed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 z-10 p-6 text-center">
              <div className="text-sm text-white">Could not load the PDF preview.</div>
              <div className="text-xs text-white/70 max-w-[60ch]">{failed}</div>
              <button className="text-xs px-3 py-1.5 rounded-md bg-white/10 text-white" onClick={onClose}>
                Close
              </button>
            </div>
          )}

          {blobUrl && (
            <iframe
              src={blobUrl}
              className="w-full h-full touch-pan-y"
              title={title || 'PDF preview'}
            />
          )}
          {/* Toolbar guard rail: hides and blocks top native controls when browser ignores toolbar=0 */}
          <div className="pointer-events-auto absolute top-0 left-0 right-0 h-11 bg-zinc-950/95" />
        </div>
      </div>
    </div>
  );
}
