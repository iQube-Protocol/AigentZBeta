"use client";

import React, { useState } from "react";
import { ArrowRight, Globe, Lock, CheckCircle2, Circle, ChevronDown, ChevronUp } from "lucide-react";

interface NanOSBridgeTabProps {
  theme?: "light" | "dark";
}

const BRIDGE_STAGES = [
  {
    id: "open_onboarding",
    label: "Open Onboarding",
    color: "green",
    description: "Developer discovers AgentiQ OS, reads KB, installs SDK.",
    requirement: "Start Here + Docs / KB tabs complete",
  },
  {
    id: "developer_active",
    label: "Developer Active",
    color: "blue",
    description: "Developer persona created, SmartWallet connected.",
    requirement: "Persona tab — create developer persona",
  },
  {
    id: "contributor_candidate",
    label: "Contributor Candidate",
    color: "blue",
    description: "Developer has completed Beginner and Builder missions.",
    requirement: "Missions tab — Beginner + Builder tracks complete",
  },
  {
    id: "registry_candidate",
    label: "Registry Candidate",
    color: "violet",
    description: "Developer has submitted at least one asset to the Registry at L1+.",
    requirement: "Missions tab — Register an AigentQube complete",
  },
  {
    id: "studio_candidate",
    label: "Studio Candidate",
    color: "violet",
    description: "Developer has built a complete cartridge or ExperienceQube.",
    requirement: "Missions tab — Advanced track complete",
  },
  {
    id: "partner_candidate",
    label: "Partner Candidate",
    color: "orange",
    description: "Developer has contributed to public docs or proposed a protocol improvement.",
    requirement: "Missions tab — Ecosystem track complete",
  },
  {
    id: "nanos_onboarded",
    label: "nanOS Onboarded",
    color: "rose",
    description: "metaMe team or Aigent reviews candidate state and routes into nanOS.",
    requirement: "Authorized by metaMe via nanOS AgentiQ OS Bridge",
  },
];

const OPEN_PROPRIETARY_TABLE = [
  { area: "Access", open: "Public / developer-facing", proprietary: "Private / authorized / operator-facing" },
  { area: "Purpose", open: "Learn, build, submit, onboard", proprietary: "Govern, activate, route, commercialize" },
  { area: "Audience", open: "Developers, builders, contributors", proprietary: "Operators, Aigents, authorized partners" },
  { area: "Aigent", open: "Aigent C-OS (developer copilot)", proprietary: "Aigent Z, Aigent C, Marketa, Kn0w1" },
  { area: "Registry", open: "Submission standards and SDK", proprietary: "Approval, ranking, monetization, governance" },
  { area: "Missions", open: "Developer onboarding missions", proprietary: "Population, campaign, partner, operator missions" },
  { area: "Persona", open: "Developer persona creation", proprietary: "Full population identity management" },
  { area: "Intelligence", open: "Reference patterns and docs", proprietary: "NBE/NBA, Experience Matrix, CRM intelligence" },
];

const COLOR_MAP: Record<string, { badge: string }> = {
  green:  { badge: "bg-green-500/20 text-green-200 border-green-500/30" },
  blue:   { badge: "bg-blue-500/20 text-blue-200 border-blue-500/30" },
  violet: { badge: "bg-violet-500/20 text-violet-200 border-violet-500/30" },
  orange: { badge: "bg-orange-500/20 text-orange-200 border-orange-500/30" },
  rose:   { badge: "bg-rose-500/20 text-rose-200 border-rose-500/30" },
};

export function NanOSBridgeTab({ theme: _theme }: NanOSBridgeTabProps) {
  const [showTable, setShowTable] = useState(false);
  const [completedStages, setCompletedStages] = useState<Set<string>>(new Set());

  function toggleStage(id: string) {
    setCompletedStages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-rose-500/20 border border-rose-500/30">
          <ArrowRight className="h-6 w-6 text-rose-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">nanOS Bridge</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Your path from open-source developer to metaMe production ecosystem participant.
          </p>
        </div>
      </div>

      {/* Positioning statement */}
      <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-green-400" />
          <span className="text-sm font-semibold text-slate-200">AgentiQ OS</span>
          <span className="text-xs text-slate-500">open-source</span>
        </div>
        <p className="text-sm text-slate-300">
          AgentiQ OS is the open developer and agent onboarding layer. This is where you build, experiment, and publish.
        </p>
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-rose-400" />
          <span className="text-sm font-semibold text-slate-200">nanOS</span>
          <span className="text-xs text-slate-500">proprietary · metaMe</span>
        </div>
        <p className="text-sm text-slate-300">
          nanOS is metaMe&apos;s proprietary production distribution of AgentiQ OS. It adds population intelligence,
          production Aigent coordination, Experience Matrix, CRM, commercial rails, Registry governance, and bounded
          delegation management for the live ecosystem.
        </p>
        <div className="rounded-lg bg-slate-800/60 px-3 py-2 text-xs text-slate-300 italic border-l-2 border-rose-500/40">
          AgentiQ OS lets the world build. nanOS lets metaMe operate, govern, and grow.
        </div>
      </div>

      {/* Bridge pathway */}
      <div>
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Your Bridge Path</h3>
        <p className="text-xs text-slate-400 mb-4">
          Track your progress toward becoming a nanOS candidate. When the metaMe team reviews your state, they use this
          bridge to route you into the production ecosystem.
        </p>
        <div className="space-y-0">
          {BRIDGE_STAGES.map((stage, idx) => {
            const done = completedStages.has(stage.id);
            const colors = COLOR_MAP[stage.color];
            const isLast = idx === BRIDGE_STAGES.length - 1;
            return (
              <div key={stage.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <button type="button" onClick={() => toggleStage(stage.id)} className="flex-shrink-0 mt-0.5">
                    {done
                      ? <CheckCircle2 className="h-5 w-5 text-green-400" />
                      : <Circle className="h-5 w-5 text-slate-600" />}
                  </button>
                  {!isLast && <div className="w-px flex-1 mt-1 mb-1 border-l border-dashed border-slate-700/60" />}
                </div>
                <div className={`flex-1 rounded-lg border p-3 mb-2 ${done ? "border-green-500/20 bg-green-500/5" : "border-slate-700/40 bg-slate-900/20"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm font-medium ${done ? "text-green-300" : "text-slate-200"}`}>
                      {stage.label}
                    </span>
                    <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${colors.badge}`}>
                      {isLast ? "nanOS" : `Stage ${idx + 1}`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{stage.description}</p>
                  <p className="text-[11px] text-slate-500 mt-1">Requirement: {stage.requirement}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Open vs Proprietary table */}
      <div className="rounded-xl border border-slate-700/40 bg-slate-900/20">
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm text-slate-300"
        >
          <span className="font-medium">AgentiQ OS vs nanOS — What Each Does</span>
          {showTable ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showTable && (
          <div className="overflow-x-auto border-t border-slate-700/40">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/40">
                  <th className="px-4 py-2 text-left text-slate-500 font-medium">Area</th>
                  <th className="px-4 py-2 text-left text-green-400 font-medium">AgentiQ OS (open)</th>
                  <th className="px-4 py-2 text-left text-rose-400 font-medium">nanOS (proprietary)</th>
                </tr>
              </thead>
              <tbody>
                {OPEN_PROPRIETARY_TABLE.map((row, i) => (
                  <tr key={row.area} className={i % 2 === 0 ? "bg-slate-900/20" : ""}>
                    <td className="px-4 py-2 text-slate-400 font-medium">{row.area}</td>
                    <td className="px-4 py-2 text-slate-300">{row.open}</td>
                    <td className="px-4 py-2 text-slate-300">{row.proprietary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-xs text-slate-500 border-t border-slate-800 pt-3 space-y-1">
        <p>
          nanOS is private. Its Population Console, Aigent Z copilot, Runtime Ops, Studio Ops, CRM, Experience Matrix,
          and commercial rails are proprietary to metaMe.
        </p>
        <p>For authorized access, contact the metaMe team.</p>
      </div>
    </div>
  );
}
