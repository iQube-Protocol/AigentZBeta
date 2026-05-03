/**
 * PDFLiteReaderModal - Lightweight PDF Reader Modal
 *
 * Ported from Qriptopian Web App object-based rendering.
 * Uses native browser PDF preview when pdf_lite_url is available.
 *
 * Mobile note: iOS Safari and most mobile browsers refuse to render PDFs
 * inline via <object>/<embed>/<iframe>. On mobile we swap to a "Open PDF"
 * CTA that hands off to the OS-native viewer (Safari/Chrome PDF viewer)
 * via target="_blank". Desktop continues to use the existing <object>
 * embed exactly as before.
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
  // Single source of truth for "mobile" inside this modal: viewport width
  // < 768px. Avoids UA sniffing while still keeping desktop behavior intact.
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
    // Desktop-only: the <object> load timeout. On mobile we don't render the
    // <object> at all, so this timeout would fire incorrectly.
    if (!open || !loading || isMobile) return;
    const timer = window.setTimeout(() => {
      setLoading(false);
      setFailed('Preview timed out. Please close and retry.');
    }, 20000);
    return () => window.clearTimeout(timer);
  }, [open, loading, isMobile]);

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
              {isMobile ? 'PDF reader' : 'PDF-lite (fast preview)'}
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
          {isMobile ? (
            // Mobile: <object>/<embed>/<iframe> all fail to render PDFs
            // inline on iOS Safari and most mobile browsers. Hand off to the
            // OS-native viewer via target="_blank" — opens in Safari/Chrome's
            // built-in PDF reader where pinch-zoom + scroll work properly.
            <div className="flex flex-col items-center justify-center h-full px-6 py-8 text-center gap-5">
              <div className="text-sm text-white/90 max-w-[36ch]">
                Open the PDF in your browser&rsquo;s native reader for the
                best experience on mobile.
              </div>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/20 px-5 py-3 text-sm font-medium text-white transition-colors"
                onClick={() => {
                  // Close the modal once the user has dispatched the open —
                  // they're being taken to a new tab/system viewer anyway.
                  setTimeout(onClose, 100);
                }}
              >
                Open PDF
              </a>
              <div className="text-[11px] text-white/50 max-w-[36ch]">
                {title || 'Document'}
              </div>
            </div>
          ) : (
            <>
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
              {/* Toolbar guard rail: hides and blocks top native controls when browser ignores toolbar=0 */}
              <div className="pointer-events-auto absolute top-0 left-0 right-0 h-11 bg-zinc-950/95" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
