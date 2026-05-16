/**
 * PDFLiteReaderModal - Lightweight PDF Reader Modal
 *
 * Desktop: <object type="application/pdf"> — renders cross-origin PDFs
 * inline reliably in Firefox / Chromium / Safari when the file exists.
 * Mobile:  <iframe> — iOS Safari + Android Chrome render PDFs inline
 * from iframes; <object> historically did not on iOS.
 *
 * Why not <iframe> on desktop: Firefox often downloads cross-origin PDFs
 * from <iframe> instead of rendering inline. The earlier CLAUDE.md note
 * blamed <object> for NS_ERROR_WONT_HANDLE_CONTENT, but that error is
 * actually <object>'s response when the URL returns 0 bytes / a missing
 * file. With a healthy file, <object> renders fine. The right fix for
 * NS_ERROR_WONT_HANDLE_CONTENT is to ensure the file exists at the URL,
 * not to switch the embed element.
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

export function PDFLiteReaderModal({ open, pdfUrl, title, onClose }: PDFLiteReaderModalProps) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const safePdfUrl = buildSecureViewerUrl(pdfUrl);
  const isMobile = useIsMobileViewport();

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

          {isMobile ? (
            <iframe
              src={safePdfUrl}
              className="w-full h-full touch-pan-y"
              title={title || 'PDF preview'}
              onLoad={() => {
                setLoading(false);
                setFailed(null);
              }}
            />
          ) : (
            <object
              data={safePdfUrl}
              type="application/pdf"
              className="w-full h-full touch-pan-y"
              onLoad={() => {
                setLoading(false);
                setFailed(null);
              }}
              aria-label={title || 'PDF preview'}
            >
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <p className="text-white mb-4">PDF preview not supported in this browser.</p>
              </div>
            </object>
          )}
          {/* Toolbar guard rail: hides and blocks top native controls when browser ignores toolbar=0 */}
          <div className="pointer-events-auto absolute top-0 left-0 right-0 h-11 bg-zinc-950/95" />
        </div>
      </div>
    </div>
  );
}
