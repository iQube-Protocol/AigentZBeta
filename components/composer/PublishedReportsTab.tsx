"use client";

/**
 * PublishedReportsTab — Publications → Reports (public surface).
 *
 * Renders the PUBLISHED research reports: canonical, DVN-receipted report
 * versions an admin explicitly published (stage 3 of the report lifecycle:
 * live draft → canonical → published). Reads the persona-free
 * /api/public/irl/reports route, so the tab works identically on the open
 * IRL OS cartridge and the internal cartridge — no auth required.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Copy, FileText, Loader2, ShieldCheck } from "lucide-react";

interface PublishedReport {
  scope: string;
  version: number;
  title: string;
  content: string;
  contentHash: string;
  receiptId: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export default function PublishedReportsTab() {
  const [reports, setReports] = useState<PublishedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/public/irl/reports", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setError(json.error || "Failed to load published reports");
          return;
        }
        const rows: PublishedReport[] = json.reports ?? [];
        setReports(rows);
        if (rows.length) setSelectedKey(`${rows[0].scope}:${rows[0].version}`);
      } catch {
        setError("Failed to load published reports");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selected = useMemo(
    () => reports.find((r) => `${r.scope}:${r.version}` === selectedKey) ?? null,
    [reports, selectedKey],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading published reports…
      </div>
    );
  }
  if (error) {
    return <p className="p-6 text-sm text-slate-400">{error}</p>;
  }
  if (reports.length === 0) {
    return (
      <div className="p-6">
        <h2 className="text-base font-semibold text-slate-100 mb-1">Reports</h2>
        <p className="text-sm text-slate-400 max-w-2xl">
          No reports have been published yet. Reports appear here once a canonical
          (DVN-receipted) findings report is published by the laboratory.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Published report list */}
      <div className="w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900/40 overflow-y-auto p-2.5">
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Published Reports ({reports.length})
        </h3>
        <div className="space-y-1">
          {reports.map((r) => {
            const key = `${r.scope}:${r.version}`;
            return (
              <button
                key={key}
                onClick={() => setSelectedKey(key)}
                className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                  selectedKey === key ? "bg-blue-500/20 text-blue-200" : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
                title={r.title}
              >
                <FileText className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                <span className="min-w-0">
                  <span className="block truncate">{r.title}</span>
                  <span className="block text-[10px] text-slate-500">
                    v{r.version} · {r.publishedAt ? new Date(r.publishedAt).toLocaleDateString() : ""}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected report */}
      <div className="flex-1 overflow-y-auto p-4">
        {selected && (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-100">{selected.title}</h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                <ShieldCheck className="h-3 w-3" />
                canonical v{selected.version} · sha256 {selected.contentHash.slice(0, 12)}…
                {selected.receiptId ? ` · receipt ${selected.receiptId.slice(0, 10)}…` : ""}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selected.content);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy markdown"}
              </button>
            </div>
            <pre className="whitespace-pre-wrap break-words rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-[12px] leading-relaxed text-slate-300 font-mono">
              {selected.content}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}
