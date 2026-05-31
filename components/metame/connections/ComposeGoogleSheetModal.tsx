"use client";

/**
 * ComposeGoogleSheetModal — aigentMe Google Sheets compose surface.
 *
 * Mirrors the chief-of-staff pattern of ComposeGoogleDocModal. Drafter
 * strip on top; editable header + preview rows below. POSTs
 * /api/assistant/create-artifact with destination='drive' +
 * artifactType='google-sheet'. The spreadsheet is created privately;
 * sharing happens through the Drive surface, just like Slides.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Sparkles, X, Sheet, Plus, Minus } from "lucide-react";
import { MicButton } from "@/components/ui/MicButton";
import { transformEmailDictation } from "@/hooks/useSpeechRecognition";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (input: {
    title: string;
    sheetName: string;
    rows: string[][];
  }) => Promise<void>;
  onDraftWithAigentMe: (prompt: string) => Promise<{
    title: string;
    sheetName: string;
    rows: string[][];
    rationale: string;
    source: 'llm' | 'template';
  }>;
  theme?: "light" | "dark";
  /** See ComposeGmailDraftModal — Phase 2 inline host mode. */
  inline?: boolean;
  /** See ComposeGoogleDocModal — auto-fires draft on mount when set. */
  initialPrompt?: string;
}

function emptyRow(width: number): string[] {
  return new Array(width).fill("");
}

export function ComposeGoogleSheetModal({ open, onClose, onCreate, onDraftWithAigentMe, theme = "dark", inline = false, initialPrompt }: Props) {
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiRationale, setAiRationale] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<'llm' | 'template' | null>(null);
  const [title, setTitle] = useState("");
  const [sheetName, setSheetName] = useState("Sheet1");
  const [header, setHeader] = useState<string[]>(["Name", "Status", "Next step", "Owner"]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDark = theme === "dark";
  const overlayClass = "fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4";
  const panelClass = isDark
    ? "bg-slate-900 border border-slate-700 text-slate-100"
    : "bg-white border border-slate-200 text-slate-900";
  const labelClass = isDark ? "text-slate-300" : "text-slate-700";
  const inputClass = isDark
    ? "bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500"
    : "bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400";
  const submitBtn = isDark
    ? "bg-violet-500 hover:bg-violet-400 text-white"
    : "bg-violet-600 hover:bg-violet-700 text-white";
  const ghostBtn = isDark
    ? "border border-slate-700 text-slate-300 hover:border-slate-500"
    : "border border-slate-300 text-slate-700 hover:border-slate-500";

  const width = header.length;

  const draftWithPrompt = useCallback(async (promptToUse: string) => {
    const trimmed = promptToUse.trim();
    if (!trimmed) return;
    setError(null);
    setAiDrafting(true);
    try {
      const draft = await onDraftWithAigentMe(trimmed);
      setTitle(draft.title ?? "");
      setSheetName(draft.sheetName?.trim() || "Sheet1");
      if (Array.isArray(draft.rows) && draft.rows.length > 0) {
        const [hdr, ...rest] = draft.rows;
        setHeader(hdr.length > 0 ? hdr : ["Column 1"]);
        setDataRows(rest);
      } else {
        setHeader(["Column 1"]);
        setDataRows([]);
      }
      setAiRationale(draft.rationale ?? null);
      setAiSource(draft.source);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiDrafting(false);
    }
  }, [onDraftWithAigentMe]);

  const handleDraft = useCallback(() => {
    if (!aiPrompt.trim()) {
      setError('Tell aigentMe what the spreadsheet is for.');
      return;
    }
    void draftWithPrompt(aiPrompt);
  }, [aiPrompt, draftWithPrompt]);

  // Mount-fire from initialPrompt — see ComposeGoogleDocModal.
  const lastInitialPromptRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialPrompt || !initialPrompt.trim()) return;
    if (lastInitialPromptRef.current === initialPrompt) return;
    lastInitialPromptRef.current = initialPrompt;
    setAiPrompt(initialPrompt);
    void draftWithPrompt(initialPrompt);
  }, [initialPrompt, draftWithPrompt]);

  function updateHeaderCell(i: number, v: string) {
    setHeader((h) => h.map((c, idx) => (idx === i ? v : c)));
  }
  function updateDataCell(rowIdx: number, colIdx: number, v: string) {
    setDataRows((rows) => rows.map((r, ri) => (ri === rowIdx ? r.map((c, ci) => (ci === colIdx ? v : c)) : r)));
  }
  function addColumn() {
    setHeader((h) => [...h, `Column ${h.length + 1}`]);
    setDataRows((rows) => rows.map((r) => [...r, ""]));
  }
  function removeColumn() {
    if (header.length <= 1) return;
    setHeader((h) => h.slice(0, -1));
    setDataRows((rows) => rows.map((r) => r.slice(0, -1)));
  }
  function addRow() {
    setDataRows((rows) => [...rows, emptyRow(width)]);
  }
  function removeRow(idx: number) {
    setDataRows((rows) => rows.filter((_, i) => i !== idx));
  }

  const allRows = useMemo(() => [header, ...dataRows], [header, dataRows]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (header.length === 0 || header.every((c) => !c.trim())) {
      setError("At least one header column is required.");
      return;
    }
    setSubmitting(true);
    try {
      // Drop fully-empty data rows so we don't waste API quota.
      const cleanedData = dataRows.filter((r) => r.some((c) => c.trim().length > 0));
      const rows: string[][] = [header.map((c) => c.trim()), ...cleanedData];
      await onCreate({
        title: title.trim(),
        sheetName: sheetName.trim() || "Sheet1",
        rows,
      });
      setAiPrompt(""); setAiRationale(null); setAiSource(null);
      setTitle(""); setSheetName("Sheet1");
      setHeader(["Name", "Status", "Next step", "Owner"]);
      setDataRows([]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [title, sheetName, header, dataRows, onCreate, onClose]);

  if (!inline && !open) return null;

  const formBody = (
      <form onSubmit={handleSubmit} className={`rounded-lg p-5 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl ${panelClass}`}>
        {!inline && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Sheet className="w-4 h-4 text-violet-400" />
            <h3 className="font-semibold">Compose Google Sheet</h3>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} className="p-1 rounded hover:bg-slate-800/40" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        )}

        <div className={`mb-3 p-3 rounded border ${isDark ? 'border-violet-500/30 bg-violet-500/5' : 'border-violet-300 bg-violet-50'}`}>
          <label className="block">
            <span className={`block text-xs mb-1 ${labelClass}`}>
              What&apos;s the spreadsheet for? <span className="opacity-60">(aigentMe will draft the schema)</span>
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                name="aigentme-prompt"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. a tracker for Q1 partner outreach with name, status, last contact, next step"
                className={`flex-1 px-3 py-2 rounded ${inputClass}`}
                disabled={aiDrafting || submitting}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleDraft(); } }}
              />
              <MicButton
                onTranscript={(text) =>
                  setAiPrompt((prev) => (prev ? `${prev.trimEnd()} ${text}` : text))
                }
                transform={transformEmailDictation}
                disabled={aiDrafting || submitting}
                theme={theme}
              />
              <button
                type="button"
                onClick={handleDraft}
                disabled={aiDrafting || submitting || !aiPrompt.trim()}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${submitBtn}`}
              >
                {aiDrafting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {aiDrafting ? 'Drafting…' : 'Draft for me'}
              </button>
            </div>
          </label>
          {aiRationale && (
            <p className={`text-[11px] mt-2 ${labelClass}`}>
              <span className="font-medium">aigentMe:</span> {aiRationale}
              {aiSource === 'template' && <span className="opacity-60"> (template fallback)</span>}
            </p>
          )}
        </div>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-3 gap-3">
            <label className="block col-span-2">
              <span className={`block text-xs mb-1 ${labelClass}`}>Title</span>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={`w-full px-3 py-2 rounded ${inputClass}`} disabled={submitting} />
            </label>
            <label className="block">
              <span className={`block text-xs mb-1 ${labelClass}`}>Tab name</span>
              <input type="text" value={sheetName} onChange={(e) => setSheetName(e.target.value)} className={`w-full px-3 py-2 rounded ${inputClass}`} disabled={submitting} />
            </label>
          </div>

          <div className="flex items-center justify-between">
            <span className={`text-xs ${labelClass}`}>Schema preview</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={removeColumn} disabled={submitting || header.length <= 1} className={`p-1 rounded ${ghostBtn} disabled:opacity-40`} title="Remove column">
                <Minus className="w-3 h-3" />
              </button>
              <button type="button" onClick={addColumn} disabled={submitting} className={`p-1 rounded ${ghostBtn}`} title="Add column">
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {header.map((cell, i) => (
                    <th key={i} className={`text-left p-1 ${labelClass}`}>
                      <input
                        type="text"
                        value={cell}
                        onChange={(e) => updateHeaderCell(i, e.target.value)}
                        className={`w-full px-2 py-1 rounded text-xs font-semibold ${inputClass}`}
                        disabled={submitting}
                      />
                    </th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {row.map((cell, colIdx) => (
                      <td key={colIdx} className="p-1">
                        <input
                          type="text"
                          value={cell}
                          onChange={(e) => updateDataCell(rowIdx, colIdx, e.target.value)}
                          className={`w-full px-2 py-1 rounded text-xs ${inputClass}`}
                          disabled={submitting}
                        />
                      </td>
                    ))}
                    <td className="p-1">
                      <button type="button" onClick={() => removeRow(rowIdx)} disabled={submitting} className={`p-1 rounded ${ghostBtn}`} title="Remove row">
                        <Minus className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <button type="button" onClick={addRow} disabled={submitting} className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${ghostBtn}`}>
              <Plus className="w-3 h-3" /> Add row
            </button>
          </div>
        </div>

        {error && (
          <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2 mt-3">{error}</div>
        )}

        <p className={`text-[11px] mt-3 ${labelClass}`}>
          The spreadsheet is created privately in your Drive. {allRows.length - 1 > 0 && `${allRows.length - 1} data row${allRows.length - 1 === 1 ? '' : 's'} will be seeded.`}
        </p>

        <div className="flex items-center justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} disabled={submitting} className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${ghostBtn}`}>Cancel</button>
          <button type="submit" disabled={submitting} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${submitBtn}`}>
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {submitting ? 'Creating…' : 'Create spreadsheet'}
          </button>
        </div>
      </form>
  );

  if (inline) return formBody;

  return (
    <div className={overlayClass} role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      {formBody}
    </div>
  );
}

export default ComposeGoogleSheetModal;
