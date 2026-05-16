/**
 * PDFLiteReaderModal - Lightweight PDF Reader Modal
 *
 * Desktop + Mobile: <iframe>. Per CLAUDE.md, <object type="application/pdf">
 * makes Firefox throw NS_ERROR_WONT_HANDLE_CONTENT and refuse to render
 * cross-origin PDFs inline (the response transfers as 0 bytes and the
 * embed never paints). <iframe> works on Firefox, Chromium, Safari
 * desktop, iOS Safari, and Android Chrome. The earlier <object>
 * desktop split (pre-2026-05-16) was an attempt to fix a different
 * Firefox regression but introduced a worse one.
 */

import { useEffect, useState } from 'react';

interface PDFLiteReaderModalProps {
  open: boolean;
  pdfUrl: string;
  title?: string;
  onClose: () => void;
}

function buildSecureViewerUrl(rawUrl: string): string {
  const [base, hash = ''] = rawUrl.split('#');
  const params = new URLSearchParams(hash);
  // Browser support varies, but these are the native viewer controls we can hint off.
  params.set('toolbar', '0');
  params.set('navpanes', '0');
  params.set('statusbar', '0');
  params.set('messages', '0');
  return `${base}#${params.toString()}`;
}

export function PDFLiteReaderModal({ open, pdfUrl, title, onClose }: PDFLiteReaderModalProps) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const safePdfUrl = buildSecureViewerUrl(pdfUrl);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setFailed(null);
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
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
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
    }, 24000);
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

          <iframe
            src={safePdfUrl}
            className="w-full h-full touch-pan-y"
            title={title || 'PDF preview'}
            onLoad={() => {
              setLoading(false);
              setFailed(null);
            }}
          />
          {/* Toolbar guard rail: hides and blocks top native controls when browser ignores toolbar=0 */}
          <div className="pointer-events-auto absolute top-0 left-0 right-0 h-11 bg-zinc-950/95" />
        </div>
      </div>
    </div>
  );
}
