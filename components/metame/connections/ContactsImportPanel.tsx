"use client";

/**
 * ContactsImportPanel — aigentMe contacts ingestion surface.
 *
 * Two import paths:
 *   1. Google Contacts — one-click import via People API (requires
 *      contacts OAuth source to be connected in GoogleConnectionsPanel).
 *   2. iPhone / vCard — drag-and-drop or file-picker for .vcf files.
 *
 * Shows live contact count after a successful import.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Users, Upload, CheckCircle2, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface ImportResult {
  ok: boolean;
  imported: number;
  skipped: number;
  total: number;
  error?: string;
}

interface ContactSummary {
  total: number;
  google: number;
  vcard: number;
}

interface Props {
  theme?: "light" | "dark";
}

export function ContactsImportPanel({ theme = "dark" }: Props) {
  const isDark = theme === "dark";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-500";
  const cardClass = isDark
    ? "bg-slate-800/40 border border-slate-700 rounded-lg p-4"
    : "bg-slate-50 border border-slate-200 rounded-lg p-4";
  const labelClass = isDark ? "text-slate-200" : "text-slate-800";

  const [summary, setSummary] = useState<ContactSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleResult, setGoogleResult] = useState<ImportResult | null>(null);

  const [vcardBusy, setVcardBusy] = useState(false);
  const [vcardResult, setVcardResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const [allRes, gRes, vRes] = await Promise.all([
        personaFetch("/api/contacts?limit=1"),
        personaFetch("/api/contacts?limit=1&source=google_contacts"),
        personaFetch("/api/contacts?limit=1&source=vcard"),
      ]);
      const [all, g, v] = await Promise.all([allRes.json(), gRes.json(), vRes.json()]);
      setSummary({
        total: all.total ?? 0,
        google: g.total ?? 0,
        vcard: v.total ?? 0,
      });
    } catch {
      // non-fatal
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  const handleGoogleImport = useCallback(async () => {
    setGoogleBusy(true);
    setGoogleResult(null);
    try {
      const res = await personaFetch("/api/contacts/google-import", { method: "POST" });
      const json = (await res.json()) as ImportResult;
      setGoogleResult(json);
      if (json.ok) void fetchSummary();
    } catch (e) {
      setGoogleResult({ ok: false, imported: 0, skipped: 0, total: 0, error: String(e) });
    } finally {
      setGoogleBusy(false);
    }
  }, [fetchSummary]);

  const handleVcardFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(vcf|vcard)$/i)) {
      setVcardResult({ ok: false, imported: 0, skipped: 0, total: 0, error: "Please select a .vcf vCard file" });
      return;
    }
    setVcardBusy(true);
    setVcardResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await personaFetch("/api/contacts/vcard-import", { method: "POST", body: form });
      const json = (await res.json()) as ImportResult;
      setVcardResult(json);
      if (json.ok) void fetchSummary();
    } catch (e) {
      setVcardResult({ ok: false, imported: 0, skipped: 0, total: 0, error: String(e) });
    } finally {
      setVcardBusy(false);
    }
  }, [fetchSummary]);

  const onFilePick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleVcardFile(file);
      e.target.value = "";
    },
    [handleVcardFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleVcardFile(file);
    },
    [handleVcardFile]
  );

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className={`flex items-center gap-3 ${cardClass}`}>
        <Users className="w-5 h-5 text-violet-400 shrink-0" />
        <div className="min-w-0">
          {summaryLoading ? (
            <span className={`text-sm ${mutedClass}`}>Loading contacts…</span>
          ) : summary ? (
            <span className={`text-sm font-medium ${labelClass}`}>
              {summary.total.toLocaleString()} contacts
              {summary.total > 0 && (
                <span className={`ml-2 font-normal ${mutedClass}`}>
                  {summary.google > 0 && `${summary.google.toLocaleString()} from Google`}
                  {summary.google > 0 && summary.vcard > 0 && " · "}
                  {summary.vcard > 0 && `${summary.vcard.toLocaleString()} from vCard`}
                </span>
              )}
            </span>
          ) : null}
        </div>
        <button
          onClick={() => void fetchSummary()}
          disabled={summaryLoading}
          className={`ml-auto shrink-0 p-1 rounded hover:bg-slate-700/40 ${mutedClass}`}
          title="Refresh count"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${summaryLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Google Contacts import */}
      <div className={cardClass}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`text-sm font-medium ${labelClass}`}>Google Contacts</p>
            <p className={`text-xs mt-0.5 ${mutedClass}`}>
              Import from your Google Workspace address book. Requires the Contacts source to be connected above.
            </p>
          </div>
          <button
            onClick={handleGoogleImport}
            disabled={googleBusy}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white transition-colors"
          >
            {googleBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {googleBusy ? "Importing…" : "Import"}
          </button>
        </div>
        {googleResult && (
          <div className={`mt-3 flex items-center gap-2 text-xs ${googleResult.ok ? "text-emerald-400" : "text-rose-400"}`}>
            {googleResult.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
            {googleResult.ok
              ? `${googleResult.imported} imported, ${googleResult.skipped} skipped (${googleResult.total} total)`
              : (googleResult.error ?? "Import failed")}
          </div>
        )}
      </div>

      {/* vCard / iPhone import */}
      <div className={cardClass}>
        <p className={`text-sm font-medium ${labelClass} mb-1`}>iPhone / vCard (.vcf)</p>
        <p className={`text-xs ${mutedClass} mb-3`}>
          Export from iPhone: Settings → Contacts → Export. On macOS: Contacts app → select all → File → Export vCard.
        </p>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={[
            "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors",
            dragOver
              ? "border-violet-400 bg-violet-500/10"
              : isDark
              ? "border-slate-600 hover:border-slate-500"
              : "border-slate-300 hover:border-slate-400",
          ].join(" ")}
        >
          {vcardBusy ? (
            <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
          ) : (
            <Upload className={`w-6 h-6 ${dragOver ? "text-violet-400" : mutedClass}`} />
          )}
          <p className={`text-xs text-center ${mutedClass}`}>
            {vcardBusy ? "Importing contacts…" : "Drop a .vcf file here or click to browse"}
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".vcf,.vcard"
          className="hidden"
          onChange={onFilePick}
        />
        {vcardResult && (
          <div className={`mt-3 flex items-center gap-2 text-xs ${vcardResult.ok ? "text-emerald-400" : "text-rose-400"}`}>
            {vcardResult.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
            {vcardResult.ok
              ? `${vcardResult.imported} imported, ${vcardResult.skipped} skipped (${vcardResult.total} total)`
              : (vcardResult.error ?? "Import failed")}
          </div>
        )}
      </div>
    </div>
  );
}
