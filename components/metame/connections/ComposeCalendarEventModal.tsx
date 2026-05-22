"use client";

/**
 * ComposeCalendarEventModal — aigentMe Phase 6.b Part 2.5c.
 *
 * Mirrors ComposeGmailDraftModal: top strip is aigentMe's drafter
 * ("What's the meeting for?"), the fields below auto-populate from the
 * draft and remain editable.
 *
 * On submit, POSTs /api/assistant/create-artifact with
 * destination='calendar'. The route:
 *   - eager-creates a private event when no attendees,
 *   - returns a runtime-only artifact bound to calendar.invite-external
 *     when attendees are present (approval-gated send).
 */

import React, { useState, useCallback } from "react";
import { Loader2, X, Calendar, Sparkles } from "lucide-react";
import { MicButton } from "@/components/ui/MicButton";
import { transformEmailDictation } from "@/hooks/useSpeechRecognition";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (input: {
    summary: string;
    description: string;
    startIso: string;
    endIso: string;
    timeZone: string;
    attendeeEmails: string[];
  }) => Promise<void>;
  onDraftWithAigentMe: (prompt: string) => Promise<{
    summary: string;
    description: string;
    startIso: string;
    endIso: string;
    timeZone: string;
    attendeeEmails: string[];
    rationale: string;
    source: 'llm' | 'template';
  }>;
  theme?: "light" | "dark";
}

/** Convert RFC3339 → datetime-local value (no trailing Z, no offset). */
function isoToLocalInput(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

function localInputToIso(value: string): string {
  if (!value) return "";
  try {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  } catch {
    return "";
  }
}

export function ComposeCalendarEventModal({
  open,
  onClose,
  onCreate,
  onDraftWithAigentMe,
  theme = "dark",
}: Props) {
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiRationale, setAiRationale] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<'llm' | 'template' | null>(null);
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [timeZone, setTimeZone] = useState("UTC");
  const [attendees, setAttendees] = useState("");
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

  const handleDraft = useCallback(async () => {
    setError(null);
    if (!aiPrompt.trim()) {
      setError('Tell aigentMe what the meeting is for.');
      return;
    }
    setAiDrafting(true);
    try {
      const draft = await onDraftWithAigentMe(aiPrompt.trim());
      setSummary(draft.summary ?? "");
      setDescription(draft.description ?? "");
      setStartLocal(isoToLocalInput(draft.startIso));
      setEndLocal(isoToLocalInput(draft.endIso));
      setTimeZone(draft.timeZone || "UTC");
      setAttendees((draft.attendeeEmails ?? []).join(", "));
      setAiRationale(draft.rationale ?? null);
      setAiSource(draft.source);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiDrafting(false);
    }
  }, [aiPrompt, onDraftWithAigentMe]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!summary.trim() || !startLocal || !endLocal) {
      setError("Summary, start and end are required.");
      return;
    }
    const startIso = localInputToIso(startLocal);
    const endIso = localInputToIso(endLocal);
    if (!startIso || !endIso) {
      setError("Invalid start or end time.");
      return;
    }
    const attendeeEmails = attendees
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && /@/.test(s));
    setSubmitting(true);
    try {
      await onCreate({
        summary: summary.trim(),
        description,
        startIso,
        endIso,
        timeZone: timeZone.trim() || "UTC",
        attendeeEmails,
      });
      setAiPrompt(""); setAiRationale(null); setAiSource(null);
      setSummary(""); setDescription(""); setStartLocal(""); setEndLocal("");
      setTimeZone("UTC"); setAttendees("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [summary, description, startLocal, endLocal, timeZone, attendees, onCreate, onClose]);

  if (!open) return null;

  return (
    <div
      className={overlayClass}
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
    >
      <form onSubmit={handleSubmit} className={`rounded-lg p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl ${panelClass}`}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-violet-400" />
            <h3 className="font-semibold">Compose Calendar event</h3>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} className="p-1 rounded hover:bg-slate-800/40" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className={`mb-3 p-3 rounded border ${isDark ? 'border-violet-500/30 bg-violet-500/5' : 'border-violet-300 bg-violet-50'}`}>
          <label className="block">
            <span className={`block text-xs mb-1 ${labelClass}`}>
              What&apos;s the meeting for? <span className="opacity-60">(aigentMe will draft it)</span>
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
                placeholder="e.g. 30-min intro call with alice@example.com next Tuesday afternoon about the metaMe alpha"
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
          <label className="block">
            <span className={`block text-xs mb-1 ${labelClass}`}>Title</span>
            <input type="text" value={summary} onChange={(e) => setSummary(e.target.value)} className={`w-full px-3 py-2 rounded ${inputClass}`} disabled={submitting} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={`block text-xs mb-1 ${labelClass}`}>Start</span>
              <input type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} className={`w-full px-3 py-2 rounded ${inputClass}`} disabled={submitting} />
            </label>
            <label className="block">
              <span className={`block text-xs mb-1 ${labelClass}`}>End</span>
              <input type="datetime-local" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} className={`w-full px-3 py-2 rounded ${inputClass}`} disabled={submitting} />
            </label>
          </div>
          <label className="block">
            <span className={`block text-xs mb-1 ${labelClass}`}>Time zone (IANA)</span>
            <input type="text" value={timeZone} onChange={(e) => setTimeZone(e.target.value)} placeholder="e.g. America/New_York" className={`w-full px-3 py-2 rounded ${inputClass}`} disabled={submitting} />
          </label>
          <label className="block">
            <span className={`block text-xs mb-1 ${labelClass}`}>Attendees (optional, comma-separated)</span>
            <input type="text" value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="alice@example.com, bob@example.com" className={`w-full px-3 py-2 rounded ${inputClass}`} disabled={submitting} />
          </label>
          <label className="block">
            <span className={`block text-xs mb-1 ${labelClass}`}>Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`w-full px-3 py-2 rounded font-sans ${inputClass}`} disabled={submitting} />
          </label>
        </div>

        {error && (
          <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2 mt-3">{error}</div>
        )}

        <p className={`text-[11px] mt-3 ${labelClass}`}>
          With no attendees, the event is created privately. With attendees, invites send only after a second-tier approval.
        </p>

        <div className="flex items-center justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} disabled={submitting} className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${ghostBtn}`}>Cancel</button>
          <button type="submit" disabled={submitting} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${submitBtn}`}>
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {submitting ? 'Creating…' : 'Create event'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ComposeCalendarEventModal;
