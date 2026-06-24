"use client";

/**
 * StandingSignalsPanel — the operator's work log.
 *
 * Lets the operator record work DONE so it becomes a verified Standing signal
 * (activity receipt + Personal Standing) that grounded progress reports read as
 * movement from the ingested baseline. Two inputs:
 *   - Log an action  — work done on- or off-platform (produced a doc, sent an
 *     email, made a call). "Not everything needs attestation": the operator's
 *     own log of their own work counts.
 *   - Add a document — a proof-of-work file (e.g. a partner proposal). Uploaded
 *     as use-kind 'standing_document', then logged as proof of work + context.
 *
 * Reads/writes /api/assistant/standing-signal and /api/uploads via the spine
 * (personaFetch attaches the Bearer token).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Plus, ClipboardList, FileUp, FileText, Activity, CalendarDays, CalendarClock, Check } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface StandingSignal {
  id: string;
  kind: "operator_action_logged" | "standing_document_added";
  summary: string;
  ventureRef: string | null;
  uploadId: string | null;
  receiptStatus: string;
  createdAt: string;
}

interface CalendarEvent {
  id: string;
  summary: string;
  startIso: string | null;
  endIso: string | null;
  isPast: boolean;
  attendeeCount: number;
  htmlLink: string | null;
}

export function StandingSignalsPanel({ personaId }: { personaId?: string }) {
  const [signals, setSignals] = useState<StandingSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"action" | "document" | null>(null);
  const [summary, setSummary] = useState("");
  const [ventureRef, setVentureRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Calendar ingest (read-on-demand). null = not loaded / not connected → hidden.
  const [calPast, setCalPast] = useState<CalendarEvent[] | null>(null);
  const [calUpcoming, setCalUpcoming] = useState<CalendarEvent[] | null>(null);
  const [loggedEventIds, setLoggedEventIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await personaFetch("/api/assistant/standing-signal?limit=25", {
        personaIdHint: personaId,
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.ok) setSignals(data.signals ?? []);
      }
    } catch { /* best-effort */ } finally {
      setLoading(false);
    }
  }, [personaId]);

  const loadCalendar = useCallback(async () => {
    try {
      const res = await personaFetch("/api/assistant/calendar-events?days=30", {
        personaIdHint: personaId,
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.ok) { setCalPast(data.past ?? []); setCalUpcoming(data.upcoming ?? []); }
      }
      // 409 not-connected / errors → leave null so the section stays hidden.
    } catch { /* calendar not connected — hidden */ }
  }, [personaId]);

  useEffect(() => { void load(); void loadCalendar(); }, [load, loadCalendar]);

  const logEvent = async (ev: CalendarEvent) => {
    try {
      const res = await personaFetch("/api/assistant/standing-signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        personaIdHint: personaId,
        body: JSON.stringify({ kind: "action", summary: ev.summary }),
      });
      if (res.ok) {
        setLoggedEventIds((prev) => new Set(prev).add(ev.id));
        void load();
      }
    } catch { /* best-effort */ }
  };

  const reset = () => {
    setMode(null); setSummary(""); setVentureRef(""); setFile(null); setError(null);
  };

  const submit = async () => {
    if (!summary.trim()) { setError("Describe the work done."); return; }
    if (mode === "document" && !file) { setError("Choose a file to upload."); return; }
    setBusy(true);
    setError(null);
    try {
      let uploadId: string | null = null;
      if (mode === "document" && file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("useKind", "standing_document");
        fd.append("label", summary.trim().slice(0, 200));
        const up = await personaFetch("/api/uploads", { method: "POST", personaIdHint: personaId, body: fd });
        const upData = await up.json();
        if (!up.ok || !upData?.upload?.id) throw new Error(upData?.detail || upData?.error || "Upload failed");
        uploadId = upData.upload.id;
      }
      const res = await personaFetch("/api/assistant/standing-signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        personaIdHint: personaId,
        body: JSON.stringify({
          kind: mode,
          summary: summary.trim(),
          ventureRef: ventureRef.trim() || null,
          uploadId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || `Save failed (${res.status})`);
      reset();
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-300" />
          <h3 className="text-sm font-semibold text-white">Work log — standing signals</h3>
        </div>
        {mode === null && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setMode("action"); setError(null); }}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
            >
              <Plus className="w-3 h-3" /> Log action
            </button>
            <button
              type="button"
              onClick={() => { setMode("document"); setError(null); }}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-violet-500/40 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20"
            >
              <FileUp className="w-3 h-3" /> Add document
            </button>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400">
        Record work you’ve done — on or off platform. Each entry becomes a verified Standing signal that grounds your progress reports against the baseline you ingested.
      </p>

      {mode !== null && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 space-y-2">
          <label className="block text-xs font-medium text-slate-300">
            {mode === "document" ? "What does this document evidence?" : "What did you do?"}
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            placeholder={mode === "document"
              ? "e.g. Partnership collaboration proposal shared with a strategic partner"
              : "e.g. Met with a strategic partner and shared a collaboration proposal"}
            className="w-full text-sm rounded-lg p-2 border bg-slate-900/60 border-slate-700 text-slate-100 focus:border-violet-500/60 focus:outline-none"
          />
          <input
            value={ventureRef}
            onChange={(e) => setVentureRef(e.target.value)}
            placeholder="Venture / project this advances (optional)"
            className="w-full text-xs rounded-lg p-2 border bg-slate-900/60 border-slate-700 text-slate-100 focus:border-violet-500/60 focus:outline-none"
          />
          {mode === "document" && (
            <div>
              <input
                ref={fileRef}
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-slate-600 bg-slate-800 text-slate-200 hover:border-slate-500"
              >
                <FileUp className="w-3.5 h-3.5" /> {file ? file.name : "Choose file…"}
              </button>
            </div>
          )}
          {error && <p className="text-xs text-amber-400">{error}</p>}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-emerald-600/30 border border-emerald-500/50 text-emerald-100 hover:bg-emerald-600/50 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {busy ? "Saving…" : "Save signal"}
            </button>
            <button type="button" onClick={reset} disabled={busy} className="text-sm px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* From your calendar — past events to log, upcoming to prepare for */}
      {calPast && calPast.length > 0 && (
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-emerald-300" />
            <span className="text-[11px] uppercase tracking-wider text-slate-400">Recent meetings — log what you did</span>
          </div>
          {calPast.slice(0, 6).map((ev) => {
            const logged = loggedEventIds.has(ev.id);
            return (
              <div key={ev.id} className="flex items-center gap-2">
                <span className="text-xs text-slate-200 truncate flex-1">{ev.summary}</span>
                <span className="text-[10px] text-slate-500 shrink-0">
                  {ev.startIso ? new Date(ev.startIso).toLocaleDateString() : ""}
                </span>
                <button
                  type="button"
                  onClick={() => { if (!logged) void logEvent(ev); }}
                  disabled={logged}
                  className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
                    logged
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                      : "border-slate-600 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-200"
                  }`}
                >
                  {logged ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  {logged ? "Logged" : "Log"}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {calUpcoming && calUpcoming.length > 0 && (
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-2.5 space-y-1">
          <div className="flex items-center gap-1.5">
            <CalendarClock className="w-3.5 h-3.5 text-violet-300" />
            <span className="text-[11px] uppercase tracking-wider text-slate-400">Coming up — prepare</span>
          </div>
          {calUpcoming.slice(0, 4).map((ev) => (
            <div key={ev.id} className="flex items-center gap-2">
              <span className="text-xs text-slate-300 truncate flex-1">{ev.summary}</span>
              <span className="text-[10px] text-slate-500 shrink-0">
                {ev.startIso ? new Date(ev.startIso).toLocaleDateString() : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Recent signals */}
      {loading ? (
        <div className="flex items-center gap-2 py-4 justify-center text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : signals.length === 0 ? (
        <p className="text-[11px] text-slate-500 py-2">No signals logged yet. Log your first action or add a standing document above.</p>
      ) : (
        <div className="space-y-1.5">
          {signals.map((s) => (
            <div key={s.id} className="flex items-start gap-2 rounded-lg border border-slate-700/60 bg-slate-900/40 px-2.5 py-1.5">
              {s.kind === "standing_document_added"
                ? <FileText className="w-3.5 h-3.5 text-violet-300 shrink-0 mt-0.5" />
                : <ClipboardList className="w-3.5 h-3.5 text-emerald-300 shrink-0 mt-0.5" />}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-200 leading-snug">{s.summary}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-500">{new Date(s.createdAt).toLocaleDateString()}</span>
                  {s.ventureRef && <span className="text-[10px] text-cyan-300/80 truncate">{s.ventureRef}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default StandingSignalsPanel;
