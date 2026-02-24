import React, { useEffect, useState } from 'react';

type PDFLiteReaderModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  pdfUrl: string;
};

export function PDFLiteReaderModal({ open, onClose, title, pdfUrl }: PDFLiteReaderModalProps) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setFailed(null);
  }, [open, pdfUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

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
              <div className="text-xs text-white/80">Loading PDF…</div>
            </div>
          )}

          {failed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 z-10 p-6 text-center">
              <div className="text-sm text-white">Couldn't load the PDF preview.</div>
              <div className="text-xs text-white/70 max-w-[60ch]">{failed}</div>
              <div className="flex gap-2">
                <a className="text-xs px-3 py-1.5 rounded-md bg-white text-black" href={pdfUrl} target="_blank" rel="noreferrer">
                  Open in new tab
                </a>
                <button className="text-xs px-3 py-1.5 rounded-md bg-white/10 text-white" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          )}

          <object
            data={pdfUrl}
            type="application/pdf"
            className="w-full h-full touch-pan-y"
            onLoad={() => setLoading(false)}
          >
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <p className="text-white mb-4">PDF preview not supported in this browser.</p>
            </div>
          </object>
        </div>
      </div>
    </div>
  );
}
