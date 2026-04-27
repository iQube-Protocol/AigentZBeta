"use client";

import React, { useState } from "react";
import {
  ArrowRight, Globe, Lock, CheckCircle2, Circle,
  ChevronDown, ChevronUp, Rocket, Sparkles, ShieldCheck,
} from "lucide-react";

interface NanOSBridgeTabProps {
  theme?: "light" | "dark";
}

const BRIDGE_STAGES = [
  {
    id: "open_onboarding",
    label: "Open Onboarding",
    color: "green",
    description: "Discover AgentiQ OS, read KB, install SDK.",
    requirement: "Start Here + Docs / KB tabs",
  },
  {
    id: "developer_active",
    label: "Developer Active",
    color: "blue",
    description: "Developer persona created, SmartWallet connected, bounded delegation granted.",
    requirement: "Persona + Delegation tabs",
  },
  {
    id: "contributor_candidate",
    label: "Contributor Candidate",
    color: "blue",
    description: "Beginner and Builder mission tracks complete.",
    requirement: "Missions — Beginner + Builder tracks",
  },
  {
    id: "registry_candidate",
    label: "Registry Candidate",
    color: "violet",
    description: "At least one asset submitted to Registry at L1+, documented interface, no hidden deps.",
    requirement: "Missions — Register an AigentQube",
  },
  {
    id: "studio_candidate",
    label: "Studio Candidate",
    color: "violet",
    description: "Complete cartridge or ExperienceQube built. Asset demonstrates composability under concurrent calls.",
    requirement: "Missions — Advanced track complete",
  },
  {
    id: "partner_candidate",
    label: "Partner Candidate",
    color: "orange",
    description: "Public doc contribution or protocol proposal — demonstrating commitment to the open ecosystem.",
    requirement: "Missions — Ecosystem track complete",
  },
  {
    id: "nanos_onboarded",
    label: "nanOS Onboarded",
    color: "rose",
    description: "metaMe team reviews candidate state. Assets meet production vetting bar. Routed into nanOS.",
    requirement: "Authorized by metaMe via AgentiQ OS Bridge",
  },
];

const COMPARISON_TABLE = [
  { area: "Access", open: "Public — any developer", bridge: "Private — authorized operators and partners" },
  { area: "Purpose", open: "Build, experiment, publish independently", bridge: "Govern, operate, commercialize at scale" },
  { area: "Studio use", open: "Build your own studio or skip it", bridge: "Experience vibing — non-technical composition at production quality" },
  { area: "QC standard", open: "L1_EXPERIMENTAL accepted — experiment freely", bridge: "Production vetting: reliability, composability, no hidden deps" },
  { area: "Client stakes", open: "Your own users, your own SLA", bridge: "Enterprise, creator, community — no debugging in production" },
  { area: "Registry", open: "Open submission — any trust band", bridge: "Curated subset — assets proven production-grade" },
  { area: "Aigents", open: "Aigent C-OS developer copilot", bridge: "Aigent Z, C, Marketa, Kn0w1 production coordination" },
  { area: "Intelligence", open: "Reference patterns and open SDK", bridge: "NBE/NBA, Experience Matrix, CRM, commercial rails" },
];

const COLOR_MAP: Record<string, { badge: string; dot: string }> = {
  green:  { badge: "bg-green-500/20 text-green-200 border-green-500/30",   dot: "bg-green-400" },
  blue:   { badge: "bg-blue-500/20 text-blue-200 border-blue-500/30",     dot: "bg-blue-400" },
  violet: { badge: "bg-violet-500/20 text-violet-200 border-violet-500/30", dot: "bg-violet-400" },
  orange: { badge: "bg-orange-500/20 text-orange-200 border-orange-500/30", dot: "bg-orange-400" },
  rose:   { badge: "bg-rose-500/20 text-rose-200 border-rose-500/30",     dot: "bg-rose-400" },
};

export function NanOSBridgeTab({ theme: _theme }: NanOSBridgeTabProps) {
  const [showTable, setShowTable] = useState(false);
  const [completedStages, setCompletedStages] = useState<Set<string>>(new Set());
  const [activePath, setActivePath] = useState<"independent" | "bridge" | null>(null);

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
          <h2 className="text-lg font-semibold text-slate-100">Your Path Forward</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            AgentiQ OS is complete as a sovereign development platform. nanOS is one destination — not the only one.
          </p>
        </div>
      </div>

      {/* Two paths */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setActivePath(activePath === "independent" ? null : "independent")}
          className={`text-left rounded-xl border p-4 space-y-2 transition-colors ${
            activePath === "independent"
              ? "border-green-500/40 bg-green-500/10"
              : "border-slate-700/40 bg-slate-900/20 hover:border-green-500/30"
          }`}
        >
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-green-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-green-200">Independent Path</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Build and operate entirely within the open ecosystem. Publish to the open registry.
            Run your own runtime and studio. Serve your own users. No metaMe involvement required.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {["Sovereign", "Open registry", "Your users", "Your rules"].map((tag) => (
              <span key={tag} className="rounded-full bg-green-500/10 border border-green-500/20 px-2 py-0.5 text-[10px] text-green-300">
                {tag}
              </span>
            ))}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActivePath(activePath === "bridge" ? null : "bridge")}
          className={`text-left rounded-xl border p-4 space-y-2 transition-colors ${
            activePath === "bridge"
              ? "border-rose-500/40 bg-rose-500/10"
              : "border-slate-700/40 bg-slate-900/20 hover:border-rose-500/30"
          }`}
        >
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-rose-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-rose-200">Bridge Path</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Submit production-grade assets to metaMe&apos;s curated registry. Assets that clear the bar
            become callable from the metaMe Studio by non-technical users — zero customization required.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {["Curated", "Experience vibing", "Enterprise QC", "metaMe Studio"].map((tag) => (
              <span key={tag} className="rounded-full bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[10px] text-rose-300">
                {tag}
              </span>
            ))}
          </div>
        </button>
      </div>

      {/* Independent path detail */}
      {activePath === "independent" && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-green-400" />
            <p className="text-sm font-semibold text-green-200">Building Independently</p>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            AgentiQ OS gives you everything you need to build a complete sovereign agent stack using the same
            iQube protocol primitives that nanOS uses internally. You are not building toward nanOS — you are
            building with AgentiQ OS.
          </p>
          <ul className="text-xs text-slate-300 space-y-1.5 list-none">
            {[
              "Build your own runtime using SmartTriad Shell, PersonaResolver, and DelegationGuard",
              "Build your own studio for composing agentic experiences",
              "Run your own registry and governance model",
              "Create agent harnesses — Aigents, SkillQubes, WorkflowQubes — for your own ecosystem",
              "Publish open-source utilities others can call and compose",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500 italic border-t border-slate-700/40 pt-3">
            Assets built independently are technically interoperable with nanOS by virtue of shared iQube
            protocol primitives — not because of any commercial relationship. The same SkillQube interface
            works in both contexts.
          </p>
        </div>
      )}

      {/* Bridge path detail */}
      {activePath === "bridge" && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-rose-400" />
            <p className="text-sm font-semibold text-rose-200">Experience Vibing — Why the Bar Is High</p>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            metaMe Studio&apos;s core value proposition is <strong className="text-rose-200">experience vibing</strong>:
            non-technical users — creators, community managers, enterprise operators — compose and deliver live,
            personalized, agent-powered experiences without writing any code. They select utilities from the Studio registry,
            configure intent in natural language, and publish. No terminal. No debugging.
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            For this to work, every utility callable from Studio must perform reliably, composably, and without
            customization — at the moment it is called, for any user, under concurrent load, in combination with
            other iQubes it has never been tested against. Studio users do not debug SkillQubes. If it fails, the
            experience breaks.
          </p>
          <div className="rounded-lg bg-rose-950/30 border border-rose-500/20 p-3">
            <p className="text-xs font-semibold text-rose-300 mb-2 flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              Production Vetting Bar
            </p>
            <ul className="text-xs text-slate-400 space-y-1">
              {[
                "Reliability under concurrent calls — no race conditions, predictable outputs",
                "Clean, documented interfaces — input/output schema explicit and correct",
                "Correct iQube permission declarations — forbidden actions declared, no scope creep",
                "Composability — no hidden external dependencies, plays well with other iQubes",
                "Works out of the box — no configuration required for its declared purpose",
                "Trust band integrity — does exactly what it claims at the band it claims",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="h-3 w-3 text-rose-400 flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-slate-500 italic">
            This is why nanOS operates within additional commercial and governance parameters beyond the open stratum.
            The open registry welcomes L1_EXPERIMENTAL. The metaMe production registry is the curated subset
            that has been proven to the standard experience vibing requires.
          </p>
        </div>
      )}

      {/* The key quote */}
      <div className="rounded-lg bg-slate-800/40 border-l-2 border-slate-600 px-4 py-3 text-xs text-slate-300 italic">
        AgentiQ OS lets the world build. nanOS lets metaMe operate, govern, and grow.
        <span className="text-slate-500"> — Both paths start here.</span>
      </div>

      {/* Bridge pathway stages — shown when bridge path selected or by default */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-200">
            {activePath === "independent" ? "Bridge Stages (for reference)" : "Bridge Pathway"}
          </h3>
          {activePath === "independent" && (
            <span className="text-[10px] text-slate-500 italic">Optional — you don&apos;t need this</span>
          )}
        </div>
        <p className="text-xs text-slate-400 mb-4">
          {activePath === "independent"
            ? "If you later decide to pursue the Bridge path, these are the stages metaMe uses to review candidates."
            : "Track your progress. When metaMe reviews your state, they use this to route you into the production ecosystem."}
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

      {/* Comparison table */}
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
                {COMPARISON_TABLE.map((row, i) => (
                  <tr key={row.area} className={i % 2 === 0 ? "bg-slate-900/20" : ""}>
                    <td className="px-4 py-2 text-slate-400 font-medium">{row.area}</td>
                    <td className="px-4 py-2 text-slate-300">{row.open}</td>
                    <td className="px-4 py-2 text-slate-300">{row.bridge}</td>
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
