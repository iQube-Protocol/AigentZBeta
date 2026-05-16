/**
 * PDFLiteReaderModal - Lightweight PDF Reader Modal
 *
 * Desktop: <object type="application/pdf"> — renders cross-origin PDFs
 * inline reliably in Firefox / Chromium / Safari when the file exists.
 * Mobile:  <iframe> — iOS Safari + Android Chrome render PDFs inline
 * from iframes; <object> historically did not on iOS.
 *
 * Spinner-dismissal strategy (critical detail): <object>.onLoad fires
 * inconsistently or never for cross-origin PDFs in Brave / Chromium.
 * Treating it as a wall and showing a "Preview timed out" overlay used
 * to obscure a successfully-rendered PDF behind a fake error message.
 * Instead we use a short fixed delay (5s for first loads, 1.5s for URLs
 * the device has loaded before) to hide the spinner, then let the
 * <object> itself paint whatever it can — either the PDF (success) or
 * the browser's own error UI underneath. No "timed out" message ever.
 */

import { useEffect, useState } from 'react';

const LOADED_URLS_KEY = 'codex:pdflite:loaded-urls:v1';
const FIRST_LOAD_SPINNER_MS = 5000;         // hide spinner after 5s on first load
const REPEAT_LOAD_SPINNER_MS = 1500;        // hide spinner after 1.5s when cache-hit is likely
const LOADED_URL_TTL_MS = 7 * 24 * 60 * 60 * 1000; // remember a successful load for 7 days

function getLoadedUrls(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOADED_URLS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function markUrlLoaded(url: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getLoadedUrls();
    const now = Date.now();
    const cleaned: Record<string, number> = { [url]: now };
    for (const [u, ts] of Object.entries(existing)) {
      if (typeof ts === 'number' && now - ts < LOADED_URL_TTL_MS && u !== url) {
        cleaned[u] = ts;
      }
    }
    window.localStorage.setItem(LOADED_URLS_KEY, JSON.stringify(cleaned));
  } catch {
    // localStorage quota / disabled — non-fatal
  }
}

function urlPreviouslyLoaded(url: string): boolean {
  const existing = getLoadedUrls();
  const ts = existing[url];
  return typeof ts === 'number' && Date.now() - ts < LOADED_URL_TTL_MS;
}

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
  const safePdfUrl = buildSecureViewerUrl(pdfUrl);
  const isMobile = useIsMobileViewport();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
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
    // Spinner-dismissal delay — short, because <object>.onLoad is unreliable
    // for cross-origin PDFs and the timer is purely visual. The actual PDF
    // either paints in the <object> below or doesn't; we never claim it
    // timed out.
    const delayMs = urlPreviouslyLoaded(pdfUrl)
      ? REPEAT_LOAD_SPINNER_MS
      : FIRST_LOAD_SPINNER_MS;
    const timer = window.setTimeout(() => {
      setLoading(false);
      markUrlLoaded(pdfUrl);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [open, loading, pdfUrl]);

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
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 z-10 pointer-events-none">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              <div className="text-xs text-white/80">Loading PDF…</div>
            </div>
          )}

          {isMobile ? (
            <iframe
              src={safePdfUrl}
              className="w-full h-full touch-pan-y"
              title={title || 'PDF preview'}
              onLoad={() => {
                setLoading(false);
                markUrlLoaded(pdfUrl);
              }}
            />
          ) : (
            <object
              data={safePdfUrl}
              type="application/pdf"
              className="w-full h-full touch-pan-y"
              onLoad={() => {
                setLoading(false);
                markUrlLoaded(pdfUrl);
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
