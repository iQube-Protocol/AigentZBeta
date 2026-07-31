"use client";

import React, { useState } from "react";
import { Shield, ChevronDown, ChevronRight, ArrowUpRight } from "lucide-react";

type RoleId = "metame_guardian" | "aigentMe" | "aigentC" | "aigentZ";

interface RoleData {
  id: RoleId;
  brand: string;
  constitutionalRole: string;
  purpose: string;
  primaryQuestion: string;
  responsibilities: string[];
  authorityDomains: { domain: string; scope: string; requiresGuardian: boolean }[];
  escalatesTo: string | null;
  canVeto: boolean;
  color: string;
  borderColor: string;
}

const ROLES: RoleData[] = [
  {
    id: "metame_guardian",
    brand: "myGuard",
    constitutionalRole: "Sovereignty Layer",
    purpose: "Protect sovereignty and enforce constitutional constraints.",
    primaryQuestion: "Is this action compatible with sovereignty?",
    responsibilities: [
      "Constitutional review of all agent actions",
      "Policy enforcement across all surfaces",
      "Consent verification and enforcement",
      "Bounded delegation boundary enforcement",
      "Veto authority over any unconstitutional action",
    ],
    authorityDomains: [
      { domain: "Policy enforcement", scope: "Absolute", requiresGuardian: false },
      { domain: "Consent enforcement", scope: "Absolute", requiresGuardian: false },
      { domain: "Bounded delegation enforcement", scope: "Absolute", requiresGuardian: false },
      { domain: "Constitutional review", scope: "Absolute", requiresGuardian: false },
      { domain: "Veto authority", scope: "Absolute", requiresGuardian: false },
    ],
    escalatesTo: null,
    canVeto: true,
    color: "text-amber-400",
    borderColor: "border-amber-500/30",
  },
  {
    id: "aigentMe",
    brand: "aigentMe",
    constitutionalRole: "Individual Agency",
    purpose: "Represent the interests of the individual.",
    primaryQuestion: "What is best for this individual?",
    responsibilities: [
      "Experience management and personal sovereignty",
      "Venture coordination and goal tracking",
      "Time sovereignty protection",
      "Personal agency preservation",
    ],
    authorityDomains: [
      { domain: "Experience management", scope: "Bounded", requiresGuardian: false },
      { domain: "Venture coordination", scope: "Bounded", requiresGuardian: false },
      { domain: "Goal management", scope: "Bounded", requiresGuardian: false },
      { domain: "Time sovereignty", scope: "Bounded", requiresGuardian: false },
      { domain: "Personal agency", scope: "Bounded", requiresGuardian: false },
    ],
    escalatesTo: "myGuard",
    canVeto: false,
    color: "text-purple-400",
    borderColor: "border-purple-500/30",
  },
  {
    id: "aigentC",
    brand: "aigentC",
    constitutionalRole: "Collective Agency",
    purpose: "Represent collective interests.",
    primaryQuestion: "What is best for the collective?",
    responsibilities: [
      "Customer advocacy and experience quality",
      "Community advocacy and participation health",
      "Builder advocacy and contributor support",
      "Ecosystem participant representation",
      "Collective outcome optimization",
    ],
    authorityDomains: [
      { domain: "Customer advocacy", scope: "Bounded", requiresGuardian: false },
      { domain: "Community advocacy", scope: "Bounded", requiresGuardian: false },
      { domain: "Builder advocacy", scope: "Bounded", requiresGuardian: false },
      { domain: "Participant advocacy", scope: "Bounded", requiresGuardian: false },
      { domain: "Collective outcomes", scope: "Bounded", requiresGuardian: false },
    ],
    escalatesTo: "myGuard",
    canVeto: false,
    color: "text-blue-400",
    borderColor: "border-blue-500/30",
  },
  {
    id: "aigentZ",
    brand: "aigentZ",
    constitutionalRole: "Platform Agency",
    purpose: "Represent platform interests and sovereign fulfillment.",
    primaryQuestion: "What is best for the ecosystem?",
    responsibilities: [
      "Platform operations and infrastructure continuity",
      "Fulfillment orchestration across all surfaces",
      "Registry stewardship and provenance integrity",
      "Runtime stewardship and execution governance",
      "Development coordination and pattern capture",
      "Agent orchestration and lifecycle management",
    ],
    authorityDomains: [
      { domain: "Platform operations", scope: "Bounded", requiresGuardian: false },
      { domain: "Fulfillment orchestration", scope: "Bounded", requiresGuardian: false },
      { domain: "Registry stewardship", scope: "Bounded", requiresGuardian: false },
      { domain: "Runtime stewardship", scope: "Bounded", requiresGuardian: false },
      { domain: "Development coordination", scope: "Bounded", requiresGuardian: false },
      { domain: "Infrastructure continuity", scope: "Bounded", requiresGuardian: true },
      { domain: "Agent orchestration", scope: "Bounded", requiresGuardian: false },
    ],
    escalatesTo: "myGuard",
    canVeto: false,
    color: "text-green-400",
    borderColor: "border-green-500/30",
  },
];

const ESCALATION_PATHS = [
  { from: "aigentZ", to: "myGuard", trigger: "Action may violate sovereignty, consent, or bounded delegation constraints", resolution: "Veto" },
  { from: "aigentC", to: "myGuard", trigger: "Collective action may compromise individual sovereignty", resolution: "Veto" },
  { from: "aigentMe", to: "myGuard", trigger: "Individual action may violate policy boundaries", resolution: "Veto" },
  { from: "aigentZ", to: "aigentC", trigger: "Platform action affects collective interests", resolution: "Modify" },
  { from: "aigentC", to: "aigentZ", trigger: "Collective request requires platform fulfillment", resolution: "Approve" },
  { from: "aigentMe", to: "aigentZ", trigger: "Individual intent requires platform orchestration", resolution: "Approve" },
  { from: "aigentMe", to: "aigentC", trigger: "Individual action has collective implications", resolution: "Modify" },
];

function RoleCard({ role }: { role: RoleData }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`rounded-lg border ${role.borderColor} bg-slate-800/30 overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <Shield className={`w-5 h-5 ${role.color}`} />
          <div>
            <span className={`font-semibold ${role.color}`}>{role.brand}</span>
            <span className="text-xs text-slate-400 ml-2">{role.constitutionalRole}</span>
          </div>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-700/30 pt-3">
          <div>
            <p className="text-sm text-slate-300">{role.purpose}</p>
            <p className="text-xs text-slate-400 italic mt-1">&ldquo;{role.primaryQuestion}&rdquo;</p>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Responsibilities</div>
            <ul className="space-y-1">
              {role.responsibilities.map((r) => (
                <li key={r} className="text-xs text-slate-300">· {r}</li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Authority Domains</div>
            <div className="space-y-1">
              {role.authorityDomains.map((a) => (
                <div key={a.domain} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">{a.domain}</span>
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded ${a.scope === "Absolute" ? "bg-amber-500/20 text-amber-300" : "bg-slate-700 text-slate-300"}`}>
                      {a.scope}
                    </span>
                    {a.requiresGuardian && (
                      <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">Guardian approval</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            {role.canVeto && <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">Veto authority</span>}
            {role.escalatesTo && (
              <span className="flex items-center gap-1 text-slate-400">
                Escalates to <span className="text-slate-300">{role.escalatesTo}</span> <ArrowUpRight className="w-3 h-3" />
              </span>
            )}
            {!role.escalatesTo && <span className="text-slate-500">Top of hierarchy</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export function GovernanceRolesTab() {
  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white">Sovereign Agent Roles</h2>
        <p className="text-sm text-slate-400">Authority domains, responsibilities, and escalation paths for each constitutional role</p>
      </div>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Roles</h3>
        <div className="space-y-2">
          {ROLES.map((role) => (
            <RoleCard key={role.id} role={role} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Escalation Matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="pb-2 pr-4">From</th>
                <th className="pb-2 pr-4">To</th>
                <th className="pb-2 pr-4">Trigger</th>
                <th className="pb-2">Resolution</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {ESCALATION_PATHS.map((path, i) => (
                <tr key={i} className="border-t border-slate-700/30">
                  <td className="py-2 pr-4 font-mono">{path.from}</td>
                  <td className="py-2 pr-4 font-mono">{path.to}</td>
                  <td className="py-2 pr-4">{path.trigger}</td>
                  <td className="py-2">
                    <span className={`px-1.5 py-0.5 rounded ${
                      path.resolution === "Veto" ? "bg-red-500/20 text-red-300" :
                      path.resolution === "Modify" ? "bg-yellow-500/20 text-yellow-300" :
                      "bg-green-500/20 text-green-300"
                    }`}>
                      {path.resolution}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
