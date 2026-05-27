"use client";

/**
 * UploadAttachmentPicker — inline multi-select of persona uploads for
 * use as outbound email attachments. Mounts inside compose modals
 * (Gmail, Marketa) above the body field.
 *
 * Lists READY uploads only — parsing-in-flight / failed / archived
 * uploads are excluded so the operator can't queue an attachment that
 * won't resolve at send time.
 *
 * Uploads tagged `use_kind='email_attachment'` surface first; the
 * rest follow in created_at order. Operator can still pick any ready
 * upload regardless of use_kind.
 */

import React, { useEffect, useState } from "react";
import { Paperclip, X, Loader2, FileText, FileJson, FileSpreadsheet, Image as ImageIcon, Mic, Upload } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import type { PersonaUploadRow } from "@/services/uploads/personaUploadService";

interface Props {
  /** Active persona id — required for the upload list fetch. */
  personaId?: string;
  /** Currently selected upload ids. Controlled by the parent modal. */
  value: string[];
  onChange: (next: string[]) => void;
  /** Opens the full UploadDrawer for adding a new file mid-compose.
   *  Optional — when omitted, the "Upload" affordance hides. */
  onOpenUploader?: () => void;
  theme?: "light" | "dark";
}

function iconForMime(mime: string, ext: string): React.ReactNode {
  if (mime === 'application/json' || ext === 'json') return <FileJson className="w-3.5 h-3.5" />;
  if (mime === 'text/csv' || ext === 'csv') return <FileSpreadsheet className="w-3.5 h-3.5" />;
  if (mime.startsWith('image/')) return <ImageIcon className="w-3.5 h-3.5" />;
  if (mime.startsWith('audio/')) return <Mic className="w-3.5 h-3.5" />;
  return <FileText className="w-3.5 h-3.5" />;
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i + 1).toLowerCase();
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function UploadAttachmentPicker({ personaId, value, onChange, onOpenUploader, theme = "dark" }: Props) {
  const isDark = theme === "dark";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const [uploads, setUploads] = useState<PersonaUploadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await personaFetch('/api/uploads?status=ready&limit=50', { personaIdHint: personaId });
        if (!res.ok) return;
        const json = (await res.json()) as { uploads: PersonaUploadRow[] };
        if (cancelled) return;
        // Sort email_attachment kind first.
        const sorted = [...json.uploads].sort((a, b) => {
          const aw = a.useKind === 'email_attachment' ? 0 : 1;
          const bw = b.useKind === 'email_attachment' ? 0 : 1;
          if (aw !== bw) return aw - bw;
          return a.createdAt < b.createdAt ? 1 : -1;
        });
        setUploads(sorted);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [open, personaId]);

  const selected = uploads.filter((u) => value.includes(u.id));

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className={`text-xs uppercase tracking-wider ${mutedClass}`}>
          Attachments
          {value.length > 0 && <span className="ml-1 text-violet-300">· {value.length}</span>}
        </label>
        <div className="flex items-center gap-2">
          {onOpenUploader && (
            <button
              type="button"
              onClick={onOpenUploader}
              className={`inline-flex items-center gap-1 text-[11px] underline ${mutedClass} hover:text-violet-300`}
              title="Upload a new file"
            >
              <Upload className="w-3 h-3" /> Upload new
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={`inline-flex items-center gap-1 text-[11px] underline ${mutedClass} hover:text-violet-300`}
          >
            <Paperclip className="w-3 h-3" /> {open ? 'Hide picker' : 'Pick from library'}
          </button>
        </div>
      </div>

      {/* Selected chips (always visible when there are selections) */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <span
              key={u.id}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] ${
                isDark ? "border-violet-500/40 bg-violet-500/10 text-violet-200" : "border-violet-400 bg-violet-50 text-violet-800"
              }`}
              title={`${u.filename} · ${formatBytes(u.sizeBytes)}`}
            >
              {iconForMime(u.mimeType, extOf(u.filename))}
              <span className="max-w-[180px] truncate">{u.label ?? u.filename}</span>
              <button
                type="button"
                onClick={() => toggle(u.id)}
                className="hover:text-rose-300"
                aria-label="Remove attachment"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Library picker — collapsed by default. */}
      {open && (
        <div className={`rounded-md border max-h-48 overflow-auto p-2 ${
          isDark ? "border-slate-700 bg-slate-900/60" : "border-slate-200 bg-white"
        }`}>
          {loading ? (
            <div className={`flex items-center gap-2 text-xs ${mutedClass}`}>
              <Loader2 className="w-3 h-3 animate-spin" /> Loading library…
            </div>
          ) : uploads.length === 0 ? (
            <p className={`text-xs ${mutedClass}`}>No ready uploads — use "Upload new" above.</p>
          ) : (
            <ul className="space-y-0.5">
              {uploads.map((u) => {
                const isSel = value.includes(u.id);
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => toggle(u.id)}
                      className={`w-full flex items-center gap-2 rounded px-2 py-1 text-left text-xs transition ${
                        isSel
                          ? isDark ? "bg-violet-500/15 text-violet-100" : "bg-violet-100 text-violet-900"
                          : isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"
                      }`}
                    >
                      {iconForMime(u.mimeType, extOf(u.filename))}
                      <span className="flex-1 truncate">{u.label ?? u.filename}</span>
                      <span className={`text-[10px] ${mutedClass}`}>{formatBytes(u.sizeBytes)}</span>
                      {u.useKind === 'email_attachment' && (
                        <span className={`text-[9px] uppercase tracking-wider px-1 rounded ${
                          isDark ? "bg-violet-500/20 text-violet-200" : "bg-violet-100 text-violet-700"
                        }`}>email</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default UploadAttachmentPicker;
