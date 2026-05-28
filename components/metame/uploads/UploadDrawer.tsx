"use client";

/**
 * UploadDrawer — modal for uploading files into the persona's upload
 * library for use by aigentMe + Studio skills.
 *
 * Phase 1 (this file):
 *   - Drag-and-drop OR file picker
 *   - Destination picker: Include in next prompt | Use as tool input
 *     | Save to myWorkbench | General (no commitment)
 *   - Optional label + tags
 *   - Lists recently uploaded files inside the drawer so the operator
 *     sees provenance + can manage / archive without leaving the modal
 *
 * Phase 2 (deferred):
 *   - Inline preview of parsed text
 *   - "Attach to next message" / "Re-use as tool" affordances
 *   - Drag-to-reorder of attached uploads on the chat input
 *
 * The drawer renders as a backdrop-blur overlay over the right pane;
 * close handlers clear local state but keep the upload library in DB.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload as UploadIcon,
  X,
  FileText,
  FileJson,
  FileSpreadsheet,
  Image as ImageIcon,
  Mic,
  Loader2,
  Check,
  AlertCircle,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import type {
  PersonaUploadRow,
  PersonaUploadFull,
  UploadUseKind,
} from "@/services/uploads/personaUploadService";

interface Props {
  open: boolean;
  onClose: () => void;
  personaId?: string;
  theme?: "light" | "dark";
}

const USE_KIND_OPTIONS: Array<{ id: UploadUseKind; label: string; description: string }> = [
  { id: 'context',          label: 'Add to next aigentMe prompt', description: 'Parsed text is attached to the next chat message as context.' },
  { id: 'tool',             label: 'Use as a tool input',         description: 'JSON / CSV exposed as a structured tool the LLM can query.' },
  { id: 'email_attachment', label: 'Attach to a Gmail or Marketa send',  description: 'Surfaces first in both the Gmail compose modal and the Marketa campaign compose modal attachment pickers.' },
  { id: 'iqube_payload',    label: 'Embed inside an iQube',       description: 'Stages the file for embed at iQube mint time (Phase 2 wires the payload writer).' },
  { id: 'workbench',        label: 'Save to myWorkbench',         description: 'Lands as a private draft for later reuse.' },
  { id: 'general',          label: 'Just save for now',           description: "No commitment — you can re-route the upload later." },
];

function iconForMime(mime: string, ext: string): React.ReactNode {
  if (mime === 'application/json' || ext === 'json') return <FileJson className="w-4 h-4" />;
  if (mime === 'text/csv' || ext === 'csv') return <FileSpreadsheet className="w-4 h-4" />;
  if (mime.startsWith('image/')) return <ImageIcon className="w-4 h-4" />;
  if (mime.startsWith('audio/')) return <Mic className="w-4 h-4" />;
  return <FileText className="w-4 h-4" />;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i + 1).toLowerCase();
}

export function UploadDrawer({ open, onClose, personaId, theme = "dark" }: Props) {
  const isDark = theme === "dark";
  const inputRef = useRef<HTMLInputElement>(null);
  const [useKind, setUseKind] = useState<UploadUseKind>('general');
  const [label, setLabel] = useState('');
  const [tags, setTags] = useState('');
  const [uploads, setUploads] = useState<PersonaUploadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<PersonaUploadFull | null>(null);

  const surfaceClass = isDark
    ? "bg-slate-900 border-slate-700/60 text-slate-100"
    : "bg-white border-slate-200 text-slate-900";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const inputClass = isDark
    ? "bg-slate-900/60 border-slate-700 text-slate-200 placeholder-slate-500"
    : "bg-white border-slate-300 text-slate-800 placeholder-slate-400";

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch('/api/uploads?limit=20', { personaIdHint: personaId });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || body?.error || `list failed (${res.status})`);
      }
      const json = (await res.json()) as { uploads: PersonaUploadRow[] };
      setUploads(json.uploads);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => {
    if (open) void loadList();
  }, [open, loadList]);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      setUploading(true);
      setError(null);
      setLatestResult(null);
      try {
        for (const file of Array.from(fileList)) {
          const form = new FormData();
          form.append('file', file);
          form.append('useKind', useKind);
          if (label.trim()) form.append('label', label.trim());
          if (tags.trim()) form.append('tags', tags.trim());
          const res = await personaFetch('/api/uploads', {
            method: 'POST',
            body: form,
            personaIdHint: personaId,
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.detail || body?.error || `upload failed (${res.status})`);
          }
          const json = (await res.json()) as { ok: true; upload: PersonaUploadFull };
          setLatestResult(json.upload);
        }
        await loadList();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setUploading(false);
      }
    },
    [useKind, label, tags, personaId, loadList],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      void handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleArchive = useCallback(
    async (uploadId: string) => {
      try {
        await personaFetch(`/api/uploads/${uploadId}`, {
          method: 'DELETE',
          personaIdHint: personaId,
        });
        await loadList();
      } catch {
        // best-effort
      }
    },
    [personaId, loadList],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className={`relative z-10 w-full md:max-w-2xl md:mx-4 max-h-[92%] overflow-auto rounded-xl border shadow-2xl ${surfaceClass}`}>
        <header className="flex items-start justify-between gap-3 p-5 border-b border-slate-800/40">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <UploadIcon className={`w-4 h-4 ${isDark ? "text-violet-300" : "text-violet-700"}`} />
              <span className={`text-xs uppercase tracking-wider ${mutedClass}`}>Upload</span>
            </div>
            <h3 className="text-lg font-semibold">Add files for aigentMe</h3>
            <p className={`text-sm mt-1 ${mutedClass}`}>
              PDFs, docs, JSON, CSVs, images, audio. Choose how aigentMe should use the file — context, tool input, or workbench draft.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-800/40" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-5 space-y-4">
          {/* Destination picker */}
          <fieldset>
            <legend className={`text-[11px] uppercase tracking-wider mb-2 ${mutedClass}`}>
              How should aigentMe use this?
            </legend>
            <div className="space-y-1.5">
              {USE_KIND_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-2 p-2 rounded-md border cursor-pointer transition ${
                    useKind === opt.id
                      ? isDark
                        ? "border-violet-500/60 bg-violet-500/10"
                        : "border-violet-400 bg-violet-50"
                      : isDark
                        ? "border-slate-700 hover:border-slate-500"
                        : "border-slate-300 hover:border-slate-500"
                  }`}
                >
                  <input
                    type="radio"
                    name="use-kind"
                    value={opt.id}
                    checked={useKind === opt.id}
                    onChange={() => setUseKind(opt.id)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className={`text-[11px] ${mutedClass}`}>{opt.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Optional metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className={`uppercase tracking-wider ${mutedClass}`}>Label (optional)</span>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Defaults to filename"
                className={`rounded-md border px-2 py-1.5 text-sm ${inputClass}`}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className={`uppercase tracking-wider ${mutedClass}`}>Tags (comma-separated)</span>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="partner, q3, brief"
                className={`rounded-md border px-2 py-1.5 text-sm ${inputClass}`}
              />
            </label>
          </div>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={() => inputRef.current?.click()}
            className={`rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition ${
              uploading
                ? "border-violet-500/40 bg-violet-500/5"
                : isDark
                  ? "border-slate-700 hover:border-violet-500/60 hover:bg-slate-800/40"
                  : "border-slate-300 hover:border-violet-400 hover:bg-slate-50"
            }`}
            role="button"
            tabIndex={0}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            {uploading ? (
              <div className={`flex items-center justify-center gap-2 text-sm ${mutedClass}`}>
                <Loader2 className="w-4 h-4 animate-spin" /> Uploading & indexing…
              </div>
            ) : (
              <div>
                <UploadIcon className={`w-6 h-6 mx-auto ${isDark ? "text-slate-400" : "text-slate-500"}`} />
                <p className="text-sm mt-2">Drag &amp; drop, or click to choose files</p>
                <p className={`text-[11px] mt-1 ${mutedClass}`}>
                  PDF · DOCX · MD · TXT · CSV · JSON · PNG · JPG · MP4 · WAV — up to 50 MB each
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {latestResult && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 flex items-start gap-2">
              <Check className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                <strong>{latestResult.label ?? latestResult.filename}</strong> uploaded — status {latestResult.status}.
                {latestResult.index?.summary ? ` ${latestResult.index.summary}` : ''}
              </span>
            </div>
          )}

          {/* Library */}
          <section className="pt-2 border-t border-slate-800/40">
            <header className="flex items-center justify-between mb-2">
              <h4 className={`text-[11px] uppercase tracking-wider ${mutedClass}`}>Recent uploads</h4>
              <button
                onClick={loadList}
                className={`text-[11px] inline-flex items-center gap-1 ${mutedClass} hover:underline`}
                title="Reload"
              >
                <RefreshCw className="w-3 h-3" /> Reload
              </button>
            </header>
            {loading ? (
              <div className={`flex items-center gap-2 text-sm ${mutedClass}`}>
                <Loader2 className="w-4 h-4 animate-spin" /> Loading library…
              </div>
            ) : uploads.length === 0 ? (
              <p className={`text-sm ${mutedClass}`}>No uploads yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {uploads.map((u) => (
                  <li
                    key={u.id}
                    className={`flex items-center gap-3 rounded-md border px-3 py-2 ${
                      isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-white"
                    }`}
                  >
                    <span className={mutedClass}>{iconForMime(u.mimeType, extOf(u.filename))}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{u.label ?? u.filename}</div>
                      <div className={`text-[10px] ${mutedClass}`}>
                        {u.useKind} · {u.status} · {formatBytes(u.sizeBytes)} · {new Date(u.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleArchive(u.id)}
                      className="p-1 rounded hover:bg-slate-800/40"
                      title="Archive"
                      aria-label="Archive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default UploadDrawer;
