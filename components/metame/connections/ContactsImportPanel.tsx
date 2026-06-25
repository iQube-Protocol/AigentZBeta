"use client";

/**
 * ContactsImportPanel — aigentMe contacts ingestion surface.
 *
 * Live import paths (Phase 1):
 *   - Google Contacts   — one-click via People API (requires Contacts OAuth source)
 *   - iPhone / vCard    — drag-and-drop .vcf
 *   - iCloud            — same vCard parser, separate source tag
 *   - LinkedIn          — CSV export (Connections.csv)
 *   - Outlook / Exchange — CSV export (contacts.csv)
 *   - Generic CSV       — flexible column-matching CSV
 *
 * Phase 2 stubs (visible but disabled with "Coming soon"):
 *   - WhatsApp, HubSpot, Salesforce, Notion
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Users,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Linkedin,
  Mail,
  FileSpreadsheet,
  Smartphone,
  Cloud,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImportResult {
  ok: boolean;
  imported: number;
  skipped: number;
  total: number;
  error?: string;
  detail?: string;
}

// Renders an error message, turning any https://console.developers.google.com/...
// URL embedded by Google's API error response into a clickable link.
function ErrorWithLink({ message }: { message: string }) {
  const urlMatch = message.match(/(https:\/\/console\.(?:developers|cloud)\.google\.com\/[^\s]+)/);
  if (!urlMatch) return <span>{message}</span>;
  const [before, ...rest] = message.split(urlMatch[1]);
  return (
    <span>
      {before}
      <a
        href={urlMatch[1]}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2 hover:opacity-80"
      >
        Enable People API
      </a>
      {rest.join(urlMatch[1])}
    </span>
  );
}

interface ContactSummary {
  total: number;
  google: number;
  vcard: number;
  icloud: number;
  linkedin: number;
  outlook: number;
  csv: number;
}

interface Props {
  theme?: "light" | "dark";
}

// ─── Source definitions ───────────────────────────────────────────────────────

interface LiveSource {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  kind: "google" | "vcf" | "csv";
  csvSource?: "linkedin" | "outlook" | "csv";
  accept?: string;
}

interface StubSource {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const LIVE_SOURCES: LiveSource[] = [
  {
    id: "google",
    label: "Google Contacts",
    description: "One-click import from your Google Workspace address book. Requires the Contacts source connected above.",
    icon: <Mail className="w-4 h-4" />,
    kind: "google",
  },
  {
    id: "vcard",
    label: "iPhone / vCard",
    description: "iPhone: Settings → Contacts → Export. macOS: Contacts app → select all → File → Export vCard.",
    icon: <Smartphone className="w-4 h-4" />,
    kind: "vcf",
    accept: ".vcf,.vcard",
  },
  {
    id: "icloud",
    label: "iCloud Contacts",
    description: "Export from icloud.com → Contacts → select all → Export vCard.",
    icon: <Cloud className="w-4 h-4" />,
    kind: "vcf",
    accept: ".vcf,.vcard",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    description: "LinkedIn → Settings → Data privacy → Get a copy of your data → Connections.csv.",
    icon: <Linkedin className="w-4 h-4" />,
    kind: "csv",
    csvSource: "linkedin",
    accept: ".csv",
  },
  {
    id: "outlook",
    label: "Outlook / Exchange",
    description: "Outlook → File → Open & Export → Import/Export → Export to CSV → Contacts.",
    icon: <Mail className="w-4 h-4" />,
    kind: "csv",
    csvSource: "outlook",
    accept: ".csv",
  },
  {
    id: "csv",
    label: "Generic CSV",
    description: "Any CSV with columns: first_name, last_name, email, phone, company, title, address, notes.",
    icon: <FileSpreadsheet className="w-4 h-4" />,
    kind: "csv",
    csvSource: "csv",
    accept: ".csv",
  },
];

const STUB_SOURCES: StubSource[] = [
  { id: "whatsapp",  label: "WhatsApp",   description: "Phase 2 — coming soon", icon: <Smartphone className="w-4 h-4" /> },
  { id: "hubspot",   label: "HubSpot",    description: "Phase 2 — coming soon", icon: <Users className="w-4 h-4" /> },
  { id: "salesforce",label: "Salesforce", description: "Phase 2 — coming soon", icon: <Users className="w-4 h-4" /> },
  { id: "notion",    label: "Notion",     description: "Phase 2 — coming soon", icon: <FileSpreadsheet className="w-4 h-4" /> },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function ContactsImportPanel({ theme = "dark" }: Props) {
  const isDark = theme === "dark";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-500";
  const labelClass = isDark ? "text-slate-200" : "text-slate-800";
  const cardClass = isDark
    ? "bg-slate-800/40 border border-slate-700 rounded-lg p-4"
    : "bg-slate-50 border border-slate-200 rounded-lg p-4";

  const [summary, setSummary] = useState<ContactSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Per-source state: busy + result
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ImportResult>>({});
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [showStubs, setShowStubs] = useState(false);

  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const [all, g, v, ic, li, ol, csv] = await Promise.all([
        personaFetch("/api/contacts?limit=1"),
        personaFetch("/api/contacts?limit=1&source=google_contacts"),
        personaFetch("/api/contacts?limit=1&source=vcard"),
        personaFetch("/api/contacts?limit=1&source=icloud"),
        personaFetch("/api/contacts?limit=1&source=linkedin"),
        personaFetch("/api/contacts?limit=1&source=outlook"),
        personaFetch("/api/contacts?limit=1&source=csv"),
      ]);
      const [allJ, gJ, vJ, icJ, liJ, olJ, csvJ] = await Promise.all(
        [all, g, v, ic, li, ol, csv].map(r => r.json())
      );
      setSummary({
        total: allJ.total ?? 0,
        google: gJ.total ?? 0,
        vcard: vJ.total ?? 0,
        icloud: icJ.total ?? 0,
        linkedin: liJ.total ?? 0,
        outlook: olJ.total ?? 0,
        csv: csvJ.total ?? 0,
      });
    } catch {
      // non-fatal
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => { void fetchSummary(); }, [fetchSummary]);

  const setResult = useCallback((id: string, r: ImportResult) => {
    setResults(prev => ({ ...prev, [id]: r }));
  }, []);

  // Google one-click import
  const handleGoogle = useCallback(async () => {
    setBusy("google");
    setResults(prev => { const n = { ...prev }; delete n.google; return n; });
    try {
      const res = await personaFetch("/api/contacts/google-import", { method: "POST" });
      const json = (await res.json()) as ImportResult;
      setResult("google", json);
      if (json.ok) void fetchSummary();
    } catch (e) {
      setResult("google", { ok: false, imported: 0, skipped: 0, total: 0, error: String(e) });
    } finally {
      setBusy(null);
    }
  }, [fetchSummary, setResult]);

  // vCard / iCloud file upload
  const handleVcf = useCallback(async (sourceId: string, file: File) => {
    if (!file.name.match(/\.(vcf|vcard)$/i)) {
      setResult(sourceId, { ok: false, imported: 0, skipped: 0, total: 0, error: "Please select a .vcf vCard file" });
      return;
    }
    setBusy(sourceId);
    setResults(prev => { const n = { ...prev }; delete n[sourceId]; return n; });
    try {
      const form = new FormData();
      form.append("file", file);
      // icloud uses the same parser but tags the source differently
      const endpoint = sourceId === "icloud"
        ? "/api/contacts/vcard-import?source=icloud"
        : "/api/contacts/vcard-import";
      const res = await personaFetch(endpoint, { method: "POST", body: form });
      const json = (await res.json()) as ImportResult;
      setResult(sourceId, json);
      if (json.ok) void fetchSummary();
    } catch (e) {
      setResult(sourceId, { ok: false, imported: 0, skipped: 0, total: 0, error: String(e) });
    } finally {
      setBusy(null);
    }
  }, [fetchSummary, setResult]);

  // CSV import (LinkedIn / Outlook / generic)
  const handleCsv = useCallback(async (src: LiveSource, file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setResult(src.id, { ok: false, imported: 0, skipped: 0, total: 0, error: "Please select a .csv file" });
      return;
    }
    setBusy(src.id);
    setResults(prev => { const n = { ...prev }; delete n[src.id]; return n; });
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("source", src.csvSource!);
      const res = await personaFetch("/api/contacts/csv-import", { method: "POST", body: form });
      const json = (await res.json()) as ImportResult;
      setResult(src.id, json);
      if (json.ok) void fetchSummary();
    } catch (e) {
      setResult(src.id, { ok: false, imported: 0, skipped: 0, total: 0, error: String(e) });
    } finally {
      setBusy(null);
    }
  }, [fetchSummary, setResult]);

  const onFileChange = useCallback(
    (src: LiveSource) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (src.kind === "vcf") void handleVcf(src.id, file);
      else if (src.kind === "csv") void handleCsv(src, file);
      e.target.value = "";
    },
    [handleVcf, handleCsv]
  );

  const onDrop = useCallback(
    (src: LiveSource) => (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(null);
      const file = e.dataTransfer.files[0];
      if (!file) return;
      if (src.kind === "vcf") void handleVcf(src.id, file);
      else if (src.kind === "csv") void handleCsv(src, file);
    },
    [handleVcf, handleCsv]
  );

  // ─── Summary strip ───────────────────────────────────────────────────────

  const summaryParts: string[] = [];
  if (summary) {
    if (summary.google)   summaryParts.push(`${summary.google.toLocaleString()} Google`);
    if (summary.vcard)    summaryParts.push(`${summary.vcard.toLocaleString()} iPhone`);
    if (summary.icloud)   summaryParts.push(`${summary.icloud.toLocaleString()} iCloud`);
    if (summary.linkedin) summaryParts.push(`${summary.linkedin.toLocaleString()} LinkedIn`);
    if (summary.outlook)  summaryParts.push(`${summary.outlook.toLocaleString()} Outlook`);
    if (summary.csv)      summaryParts.push(`${summary.csv.toLocaleString()} CSV`);
  }

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className={`flex items-center gap-3 ${cardClass}`}>
        <Users className="w-5 h-5 text-violet-400 shrink-0" />
        <div className="min-w-0 flex-1">
          {summaryLoading ? (
            <span className={`text-sm ${mutedClass}`}>Loading contacts…</span>
          ) : summary ? (
            <>
              <span className={`text-sm font-medium ${labelClass}`}>
                {summary.total.toLocaleString()} contacts
              </span>
              {summaryParts.length > 0 && (
                <span className={`ml-2 text-xs ${mutedClass}`}>{summaryParts.join(" · ")}</span>
              )}
            </>
          ) : null}
        </div>
        <button
          onClick={() => void fetchSummary()}
          disabled={summaryLoading}
          className={`shrink-0 p-1 rounded hover:bg-slate-700/40 ${mutedClass}`}
          title="Refresh count"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${summaryLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Live sources */}
      {LIVE_SOURCES.map(src => {
        const isBusy = busy === src.id;
        const result = results[src.id];
        const isFileDrop = src.kind === "vcf" || src.kind === "csv";

        return (
          <div key={src.id} className={cardClass}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <span className={`mt-0.5 shrink-0 ${mutedClass}`}>{src.icon}</span>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${labelClass}`}>{src.label}</p>
                  <p className={`text-xs mt-0.5 ${mutedClass}`}>{src.description}</p>
                </div>
              </div>

              {src.kind === "google" ? (
                <button
                  onClick={handleGoogle}
                  disabled={isBusy}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white transition-colors"
                >
                  {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {isBusy ? "Importing…" : "Import"}
                </button>
              ) : (
                <button
                  onClick={() => fileRefs.current[src.id]?.click()}
                  disabled={isBusy}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 transition-colors"
                >
                  {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {isBusy ? "Importing…" : "Upload"}
                </button>
              )}
            </div>

            {/* Drop zone for file-based sources */}
            {isFileDrop && (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(src.id); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={onDrop(src)}
                onClick={() => fileRefs.current[src.id]?.click()}
                className={[
                  "mt-3 flex items-center justify-center gap-2 rounded-md border border-dashed py-2 px-3 cursor-pointer transition-colors text-xs",
                  dragOver === src.id
                    ? "border-violet-400 bg-violet-500/10 text-violet-300"
                    : isDark
                    ? `border-slate-600 hover:border-slate-500 ${mutedClass}`
                    : `border-slate-300 hover:border-slate-400 ${mutedClass}`,
                ].join(" ")}
              >
                <Upload className="w-3.5 h-3.5 shrink-0" />
                <span>Drop {src.accept} here</span>
              </div>
            )}

            <input
              ref={el => { fileRefs.current[src.id] = el; }}
              type="file"
              accept={src.accept}
              className="hidden"
              onChange={onFileChange(src)}
            />

            {result && (
              <div className={`mt-2 flex items-start gap-2 text-xs ${result.ok ? "text-emerald-400" : "text-rose-400"}`}>
                {result.ok
                  ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                {result.ok
                  ? `${result.imported} imported, ${result.skipped} skipped (${result.total} total)`
                  : <ErrorWithLink message={result.detail ?? result.error ?? "Import failed"} />}
              </div>
            )}
          </div>
        );
      })}

      {/* Phase 2 stubs — collapsible */}
      <button
        onClick={() => setShowStubs(v => !v)}
        className={`flex items-center gap-1.5 text-xs ${mutedClass} hover:text-slate-300 transition-colors`}
      >
        {showStubs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {showStubs ? "Hide" : "Show"} upcoming sources
      </button>

      {showStubs && (
        <div className="grid grid-cols-2 gap-3">
          {STUB_SOURCES.map(src => (
            <div
              key={src.id}
              className={[
                isDark
                  ? "bg-slate-800/20 border border-slate-700/60 rounded-lg p-3 opacity-50"
                  : "bg-slate-50 border border-slate-200 rounded-lg p-3 opacity-50",
              ].join(" ")}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={mutedClass}>{src.icon}</span>
                <p className={`text-sm font-medium ${labelClass}`}>{src.label}</p>
              </div>
              <p className={`text-xs ${mutedClass}`}>{src.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
