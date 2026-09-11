"use client";

/**
 * DownloadsMenu — drawer surfaced from the aigentMe quick-action strip
 * (download icon). Lists static downloadable assets the operator can
 * share with their off-platform agent (ChatGPT, Claude, etc.) so the
 * agent can prepare content that re-uploads cleanly via aigentMe.
 *
 * v1 items:
 *   - VentureQube JSON Schema (auto-populates ExperienceModel +
 *     ExperienceGuide + myCartridge wizard on re-upload)
 *   - Agent Runbook (Experience Sovereignty series) — placeholder
 *     until operator drops the asset under public/downloads/
 *   - Experience Operator Manual — same pattern
 *
 * All assets live under public/downloads/ so they are served by Next.js
 * as static files, downloadable from any browser without server cost.
 */

import React, { useEffect, useState } from "react";
import { Download, X, FileJson, FileText, ExternalLink, Lock } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface DownloadItem {
  /** Stable id — also used as React key. */
  id: string;
  /** Filename in /public/downloads (also the suggested filename on save). */
  filename: string;
  /** Display title. */
  title: string;
  /** One-line description rendered under the title. */
  description: string;
  /** Longer purpose / "how to use this" copy rendered when expanded. */
  purpose: string;
  /** Icon component (lucide). */
  Icon: React.ComponentType<{ className?: string }>;
  /** When true, item is listed but disabled with a "coming soon" badge. */
  comingSoon?: boolean;
  /** Premium gate — requires the matching wizardAccess flag to download. */
  lockedBy?: "pro" | "portfolio";
}

const DOWNLOADS: DownloadItem[] = [
  {
    id: "venture-iqube-schema",
    filename: "ventureQube-schema.json",
    title: "Venture Light iQube — JSON Schema (v0.5)",
    description: "Free tier. Auto-populates your ExperienceModel, ExperienceGuide, Standing, KPIs, and one Light venture when you upload it back.",
    purpose: "Share this with your off-platform agent (ChatGPT, Claude, etc.). v0.5 mirrors the full free-tier setup: strategy + one venture (essentials) + goals + KPIs + priority partners (ExperienceModel), your 7-sphere lived-state self-assessment (ExperienceGuide), and your Standing Core declarations (who you are / what you know / what you intend → your Standing Asset Graph). Your agent produces one JSON file; you upload it via the upload icon → aigentMe lights up. The premium schemas (Pro, Portfolio) are CUMULATIVE supersets of this one — if you upgrade, you maintain only the higher-tier file.",
    Icon: FileJson,
  },
  {
    id: "venture-pro-schema",
    filename: "ventureQube-pro-schema.json",
    title: "Venture Pro iQube — JSON Schema (v1.0)",
    description: "The Founder Office schema. The full 13-layer VentureQube + operating model — and a superset of Venture Light, so it's the only file you maintain at every Operator tier.",
    purpose: "Unlocked the moment you enter the Founder Office (Operator tier and above). A strict SUPERSET of the Venture Light schema: everything Light has PLUS each venture's full 13-layer blueprint — thesis, intent, customer archetypes, revenue architecture, commercial model, capability, resource, execution phases, delegation, outcome, governance, and institutional layers — AND the operating model. Standing + metaCommons signals calibrate the confidence layers server-side. Download and maintain ONLY this file in the Founder Office — it includes the Light base.",
    Icon: FileJson,
    lockedBy: "pro",
  },
  {
    id: "venture-portfolio-schema",
    filename: "ventureQube-portfolio-schema.json",
    title: "Venture Portfolio iQube — JSON Schema (v1.0)",
    description: "Operator Pro / Elite. Multiple full ventures + a portfolio thesis — a superset of the Pro schema.",
    purpose: "Unlocked with Operator Pro (3 ventures) or Operator Elite (unlimited). A strict SUPERSET of the Pro schema: every venture carries the full 13-layer blueprint, PLUS a portfolio block — a thesis that spans all ventures, an explicit prioritisation order, and notes. Cross-venture intelligence (shared capabilities, stage spread) is derived server-side. This is the single file a portfolio operator maintains.",
    Icon: FileJson,
    lockedBy: "portfolio",
  },
  {
    id: "venture-portfolio-example",
    filename: "ventureQube-portfolio-example.json",
    title: "Venture Portfolio iQube — worked example",
    description: "A complete, validator-passing GENERIC portfolio file you can diff against and adapt. Two example ventures + portfolio thesis + operating model — fictional content, not a real portfolio.",
    purpose: "A non-proprietary reference you (or your off-platform agent) can copy and replace with your own content. It conforms to the Venture Portfolio schema and imports cleanly: schemaVersion + operator + strategy + ExperienceGuide + Standing + plan (all five horizons) + KPIs + the operating model (mission, success metrics, active objectives with status, priority partners, priority actions, review cadence, primary metric) + two full 13-layer ventures + the portfolio block. To import: upload it via the upload icon with use-kind \"Ingest as Venture iQube\", then click the ✨ ingest action — from an Operator Pro/Elite (or admin) persona so the portfolio block lands. Do NOT paste it into the SQL editor; it is an app import, not a database query.",
    Icon: FileJson,
  },
  {
    id: "operating-model-schema",
    filename: "ventureQube-operating-model-schema.json",
    title: "Operating Model iQube — JSON Schema (v1.0)",
    description: "ATOMIC update of just your operating brief. Carries only the operatingModel — never touches your venture or portfolio Qubes.",
    purpose: "Use this when you want to iterate on your Chief-of-Staff operating brief (mission, success metrics, active objectives, priority partners, priority actions, review cadence, primary metric) WITHOUT re-ingesting your whole portfolio. Importing a 'venture-operating-model/v1.0' file updates only the operating brief on your portfolio row and leaves every venture Qube and the portfolio thesis/priorities exactly as they were. Requires a Founder Office tier (Operator and above). Import via the upload icon with use-kind \"Ingest as Venture iQube\".",
    Icon: FileJson,
  },
  {
    id: "operating-model-example",
    filename: "ventureQube-operating-model-example.json",
    title: "Operating Model iQube — worked example",
    description: "A generic, non-proprietary operating brief you can copy and adapt for an atomic operating-model update.",
    purpose: "A fictional reference conforming to the Operating Model schema. Replace the content with your own, then import it to update only your operating brief — your ventures and portfolio thesis stay untouched.",
    Icon: FileJson,
  },
  {
    id: "agent-runbook",
    filename: "aigentme-agent-runbook.md",
    title: "aigentMe Agent Runbook",
    description: "The Experience Sovereignty series guide for your off-platform agent. Explains the metaMe stack, handoff map, decision tree, and includes 9 machine-readable brief templates.",
    purpose: "A deeper companion for your off-platform agent. Share this alongside the VentureQube schema. The runbook covers the corrected operating stack (Registry → nanOS → Studio → Catalogue → Runtime), how to recommend Cartridge vs Tab vs Capsule vs Pill, when to hand off to aigentMe vs a Cartridge CoPilot vs Studio Composer, and JSON templates the agent can fill (Experience Intent Brief, Cartridge Creation Brief, iQube Preparation Brief, Mini-RFP Brief, and six more). The agent recommends. You authorize. The metaMe stack validates and activates.",
    Icon: FileText,
  },
  {
    id: "experience-operator-manual",
    filename: "experience-operator-manual.md",
    title: "Experience Operator Manual",
    description: "Two-paper companion: the metaMe Operator's Manual + the Experience Vibing Operator's Manual. For you AND your off-platform agent.",
    purpose: "Operator-facing reference. Paper 1 covers the operating stack (AgentiQ OS → iQube Registry → nanOS → Studio → Runtime → Catalogue), Cartridges, Codexes, Tabs, Capsules/Pills/Chips, the Experience Model (Strategy/Ladder/Matrix/Journey/State), SmartTriad operations, Liquid UI, and the Cartridge creation playbook. Paper 2 covers Experience Vibing — outcome-led experience composition for non-technical operators: the 15-step loop, surface selection guide (when to use a Cartridge vs Tab vs Capsule vs Pill), publishing routes, four worked examples, and the time-sovereignty thesis. Pair with the Agent Runbook above.",
    Icon: FileText,
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  theme?: "light" | "dark";
}

export function DownloadsMenu({ open, onClose, theme = "dark" }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  // Premium gating for the Pro / Portfolio schema downloads.
  const [wizardAccess, setWizardAccess] = useState<{ pro: boolean; portfolio: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const res = await personaFetch("/api/billing/plan", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.ok && data.wizardAccess) {
          setWizardAccess({ pro: !!data.wizardAccess.pro, portfolio: !!data.wizardAccess.portfolio });
        }
      } catch { /* non-fatal — locked items stay locked */ }
    })();
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const isDark = theme === "dark";
  const surfaceClass = isDark
    ? "bg-slate-900 border-slate-700 text-slate-100"
    : "bg-white border-slate-200 text-slate-900";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const cardClass = isDark
    ? "border-slate-700/60 bg-slate-900/60 hover:border-emerald-500/50"
    : "border-slate-200 bg-slate-50 hover:border-emerald-400";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`w-full max-w-2xl rounded-xl border shadow-2xl ${surfaceClass}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Downloads for off-platform agents"
      >
        <header className="flex items-start justify-between p-5 border-b border-slate-700/60">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Download className={`w-4 h-4 ${isDark ? "text-emerald-300" : "text-emerald-700"}`} />
              <span className={`text-xs uppercase tracking-wider ${mutedClass}`}>
                Downloads
              </span>
            </div>
            <h2 className="text-lg font-semibold">Share with your off-platform agent</h2>
            <p className={`text-sm mt-1 ${mutedClass}`}>
              These files let your off-platform AI (ChatGPT, Claude, etc.) prepare content that uploads cleanly into your aigentMe. Re-upload daily or as often as you like — each is a snapshot.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`p-1 rounded-md transition ${isDark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-600"}`}
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {DOWNLOADS.map((item) => {
            const isExpanded = expanded === item.id;
            const locked = !!item.lockedBy && !(wizardAccess?.[item.lockedBy] ?? false);
            const isAvailable = !item.comingSoon && !locked;
            const unlockLabel = item.lockedBy === "portfolio" ? "Operator Pro / Elite" : "Founder Office (Operator+)";
            return (
              <article key={item.id} className={`rounded-lg border ${cardClass} overflow-hidden transition-colors`}>
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 p-2 rounded-md ${isDark ? "bg-slate-800" : "bg-white"}`}>
                      <item.Icon className={`w-4 h-4 ${isDark ? "text-emerald-300" : "text-emerald-700"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold leading-tight">{item.title}</h3>
                        {item.comingSoon && (
                          <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${isDark ? "border-slate-600 text-slate-400" : "border-slate-300 text-slate-600"}`}>
                            coming soon
                          </span>
                        )}
                        {locked && (
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300 inline-flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> premium
                          </span>
                        )}
                      </div>
                      <p className={`text-xs mt-1 ${mutedClass}`}>{item.description}</p>
                      <button
                        type="button"
                        onClick={() => setExpanded(isExpanded ? null : item.id)}
                        className={`text-[11px] mt-2 underline ${isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"}`}
                      >
                        {isExpanded ? "Hide details" : "What is this?"}
                      </button>
                      {isExpanded && (
                        <p className={`text-xs mt-2 leading-relaxed ${mutedClass}`}>
                          {item.purpose}
                        </p>
                      )}
                    </div>
                    {isAvailable ? (
                      <a
                        href={`/downloads/${item.filename}`}
                        download={item.filename}
                        className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition ${
                          isDark
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                            : "border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </a>
                    ) : locked ? (
                      <span
                        title={`Unlock with ${unlockLabel}`}
                        className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs ${isDark ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-amber-300 bg-amber-50 text-amber-700"}`}
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Upgrade
                      </span>
                    ) : (
                      <span className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs ${isDark ? "border-slate-700 text-slate-500" : "border-slate-300 text-slate-500"}`}>
                        soon
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <footer className={`px-5 py-3 border-t ${isDark ? "border-slate-700/60 bg-slate-900/60" : "border-slate-200 bg-slate-50"}`}>
          <p className={`text-[11px] ${mutedClass} flex items-start gap-1.5`}>
            <ExternalLink className="w-3 h-3 mt-0.5 shrink-0" />
            <span>
              These files are designed for off-platform context. Re-upload via the upload icon (next to this one) to feed your aigentMe — your data stays sovereign, and every upload produces a DVN-anchored receipt.
            </span>
          </p>
        </footer>
      </div>
    </div>
  );
}

export default DownloadsMenu;
