"use client";

import React from "react";
import type { ContactGraphPeopleStats } from "@/components/metame/contactgraph/useContactGraphPeople";

interface Props {
  stats: ContactGraphPeopleStats | null;
  theme?: "light" | "dark";
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    google_contacts: "Google",
    icloud: "iCloud",
    vcard: "vCard",
    outlook: "Outlook",
    linkedin: "LinkedIn",
    csv: "CSV",
    manual: "Manual",
    gmail_correspondence: "Gmail candidates",
  };
  return labels[source] ?? source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * One shared rendering of ContactGraph state for aigentMe and metaMe Runtime.
 * Import rows deliberately remain distinct from canonical graph people:
 * imports can overlap across sources, while graphPeople is the reconciled
 * person projection.
 */
export function ContactGraphStatsStrip({ stats, theme = "dark" }: Props) {
  if (!stats) return null;
  const isDark = theme === "dark";
  const card = isDark
    ? "border-slate-800 bg-slate-950/55 text-slate-200"
    : "border-slate-200 bg-slate-50 text-slate-800";
  const muted = isDark ? "text-slate-500" : "text-slate-500";
  const chip = isDark
    ? "border-slate-700 bg-slate-900 text-slate-300"
    : "border-slate-200 bg-white text-slate-700";

  return (
    <div className={`rounded-md border px-2.5 py-2 ${card}`}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <div>
          <span className="text-sm font-semibold tabular-nums">{stats.graphPeople.toLocaleString()}</span>
          <span className={`ml-1 text-[10px] ${muted}`}>graph people</span>
        </div>
        <div>
          <span className="text-sm font-semibold tabular-nums">{stats.importedRecords.toLocaleString()}</span>
          <span className={`ml-1 text-[10px] ${muted}`}>import records</span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {stats.importedBySource.map((item) => (
          <span key={item.source} className={`rounded border px-1.5 py-0.5 text-[10px] ${chip}`}>
            {sourceLabel(item.source)} <strong className="tabular-nums">{item.importedRecords.toLocaleString()}</strong>
          </span>
        ))}
      </div>
      <p className={`mt-1.5 text-[9px] leading-relaxed ${muted}`}>
        Import records preserve source provenance and may overlap. Graph people are reconciled identities.
      </p>
    </div>
  );
}

export default ContactGraphStatsStrip;
