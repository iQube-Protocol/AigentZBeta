"use client";

import React from "react";
import { Grid3X3, Shield, Heart, Users, Cpu, Check, X, AlertTriangle } from "lucide-react";

type RoleKey = "metame_guardian" | "aigentMe" | "aigentC" | "aigentZ";

const ROLES: { id: RoleKey; brand: string; color: string; icon: typeof Shield }[] = [
  { id: "metame_guardian", brand: "myGuard", color: "text-amber-400", icon: Shield },
  { id: "aigentMe", brand: "aigentMe", color: "text-purple-400", icon: Heart },
  { id: "aigentC", brand: "aigentC", color: "text-blue-400", icon: Users },
  { id: "aigentZ", brand: "aigentZ", color: "text-green-400", icon: Cpu },
];

interface DomainGrant {
  domain: string;
  label: string;
  grants: Record<RoleKey, { scope: "absolute" | "bounded" | "none"; requiresGuardian: boolean }>;
}

const AUTHORITY_MATRIX: DomainGrant[] = [
  { domain: "policy_enforcement", label: "Policy Enforcement", grants: { metame_guardian: { scope: "absolute", requiresGuardian: false }, aigentMe: { scope: "none", requiresGuardian: false }, aigentC: { scope: "none", requiresGuardian: false }, aigentZ: { scope: "none", requiresGuardian: false } } },
  { domain: "consent_enforcement", label: "Consent Enforcement", grants: { metame_guardian: { scope: "absolute", requiresGuardian: false }, aigentMe: { scope: "none", requiresGuardian: false }, aigentC: { scope: "none", requiresGuardian: false }, aigentZ: { scope: "none", requiresGuardian: false } } },
  { domain: "bounded_delegation_enforcement", label: "Bounded Delegation", grants: { metame_guardian: { scope: "absolute", requiresGuardian: false }, aigentMe: { scope: "none", requiresGuardian: false }, aigentC: { scope: "none", requiresGuardian: false }, aigentZ: { scope: "none", requiresGuardian: false } } },
  { domain: "constitutional_review", label: "Constitutional Review", grants: { metame_guardian: { scope: "absolute", requiresGuardian: false }, aigentMe: { scope: "none", requiresGuardian: false }, aigentC: { scope: "none", requiresGuardian: false }, aigentZ: { scope: "none", requiresGuardian: false } } },
  { domain: "veto_authority", label: "Veto Authority", grants: { metame_guardian: { scope: "absolute", requiresGuardian: false }, aigentMe: { scope: "none", requiresGuardian: false }, aigentC: { scope: "none", requiresGuardian: false }, aigentZ: { scope: "none", requiresGuardian: false } } },
  { domain: "experience_management", label: "Experience Management", grants: { metame_guardian: { scope: "none", requiresGuardian: false }, aigentMe: { scope: "bounded", requiresGuardian: false }, aigentC: { scope: "none", requiresGuardian: false }, aigentZ: { scope: "none", requiresGuardian: false } } },
  { domain: "venture_coordination", label: "Venture Coordination", grants: { metame_guardian: { scope: "none", requiresGuardian: false }, aigentMe: { scope: "bounded", requiresGuardian: false }, aigentC: { scope: "none", requiresGuardian: false }, aigentZ: { scope: "none", requiresGuardian: false } } },
  { domain: "goal_management", label: "Goal Management", grants: { metame_guardian: { scope: "none", requiresGuardian: false }, aigentMe: { scope: "bounded", requiresGuardian: false }, aigentC: { scope: "none", requiresGuardian: false }, aigentZ: { scope: "none", requiresGuardian: false } } },
  { domain: "time_sovereignty", label: "Time Sovereignty", grants: { metame_guardian: { scope: "none", requiresGuardian: false }, aigentMe: { scope: "bounded", requiresGuardian: false }, aigentC: { scope: "none", requiresGuardian: false }, aigentZ: { scope: "none", requiresGuardian: false } } },
  { domain: "personal_agency", label: "Personal Agency", grants: { metame_guardian: { scope: "none", requiresGuardian: false }, aigentMe: { scope: "bounded", requiresGuardian: false }, aigentC: { scope: "none", requiresGuardian: false }, aigentZ: { scope: "none", requiresGuardian: false } } },
  { domain: "customer_advocacy", label: "Customer Advocacy", grants: { metame_guardian: { scope: "none", requiresGuardian: false }, aigentMe: { scope: "none", requiresGuardian: false }, aigentC: { scope: "bounded", requiresGuardian: false }, aigentZ: { scope: "none", requiresGuardian: false } } },
  { domain: "community_advocacy", label: "Community Advocacy", grants: { metame_guardian: { scope: "none", requiresGuardian: false }, aigentMe: { scope: "none", requiresGuardian: false }, aigentC: { scope: "bounded", requiresGuardian: false }, aigentZ: { scope: "none", requiresGuardian: false } } },
  { domain: "builder_advocacy", label: "Builder Advocacy", grants: { metame_guardian: { scope: "none", requiresGuardian: false }, aigentMe: { scope: "none", requiresGuardian: false }, aigentC: { scope: "bounded", requiresGuardian: false }, aigentZ: { scope: "none", requiresGuardian: false } } },
  { domain: "participant_advocacy", label: "Participant Advocacy", grants: { metame_guardian: { scope: "none", requiresGuardian: false }, aigentMe: { scope: "none", requiresGuardian: false }, aigentC: { scope: "bounded", requiresGuardian: false }, aigentZ: { scope: "none", requiresGuardian: false } } },
  { domain: "collective_outcomes", label: "Collective Outcomes", grants: { metame_guardian: { scope: "none", requiresGuardian: false }, aigentMe: { scope: "none", requiresGuardian: false }, aigentC: { scope: "bounded", requiresGuardian: false }, aigentZ: { scope: "none", requiresGuardian: false } } },
  { domain: "platform_operations", label: "Platform Operations", grants: { metame_guardian: { scope: "none", requiresGuardian: false }, aigentMe: { scope: "none", requiresGuardian: false }, aigentC: { scope: "none", requiresGuardian: false }, aigentZ: { scope: "bounded", requiresGuardian: false } } },
  { domain: "fulfillment_orchestration", label: "Fulfillment Orchestration", grants: { metame_guardian: { scope: "none", requiresGuardian: false }, aigentMe: { scope: "none", requiresGuardian: false }, aigentC: { scope: "none", requiresGuardian: false }, aigentZ: { scope: "bounded", requiresGuardian: false } } },
  { domain: "registry_stewardship", label: "Registry Stewardship", grants: { metame_guardian: { scope: "none", requiresGuardian: false }, aigentMe: { scope: "none", requiresGuardian: false }, aigentC: { scope: "none", requiresGuardian: false }, aigentZ: { scope: "bounded", requiresGuardian: false } } },
  { domain: "runtime_stewardship", label: "Runtime Stewardship", grants: { metame_guardian: { scope: "none", requiresGuardian: false }, aigentMe: { scope: "none", requiresGuardian: false }, aigentC: { scope: "none", requiresGuardian: false }, aigentZ: { scope: "bounded", requiresGuardian: false } } },
  { domain: "development_coordination", label: "Development Coordination", grants: { metame_guardian: { scope: "none", requiresGuardian: false }, aigentMe: { scope: "none", requiresGuardian: false }, aigentC: { scope: "none", requiresGuardian: false }, aigentZ: { scope: "bounded", requiresGuardian: false } } },
  { domain: "infrastructure_continuity", label: "Infrastructure Continuity", grants: { metame_guardian: { scope: "none", requiresGuardian: false }, aigentMe: { scope: "none", requiresGuardian: false }, aigentC: { scope: "none", requiresGuardian: false }, aigentZ: { scope: "bounded", requiresGuardian: true } } },
  { domain: "agent_orchestration", label: "Agent Orchestration", grants: { metame_guardian: { scope: "none", requiresGuardian: false }, aigentMe: { scope: "none", requiresGuardian: false }, aigentC: { scope: "none", requiresGuardian: false }, aigentZ: { scope: "bounded", requiresGuardian: false } } },
];

function CellBadge({ scope, requiresGuardian }: { scope: string; requiresGuardian: boolean }) {
  if (scope === "none") return <X className="w-3.5 h-3.5 text-slate-600 mx-auto" />;
  if (scope === "absolute") return (
    <div className="flex items-center justify-center gap-1">
      <Check className="w-3.5 h-3.5 text-amber-400" />
      <span className="text-[10px] text-amber-400 font-semibold">ABS</span>
    </div>
  );
  return (
    <div className="flex items-center justify-center gap-1">
      <Check className="w-3.5 h-3.5 text-emerald-400" />
      {requiresGuardian && <AlertTriangle className="w-3 h-3 text-amber-400" />}
    </div>
  );
}

export function GovernanceAuthorityMatrixTab() {
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <Grid3X3 className="w-6 h-6 text-amber-400" />
          <h2 className="text-xl font-bold text-white">Authority Matrix</h2>
        </div>
        <p className="text-sm text-slate-400">
          Cross-reference: which constitutional role holds authority over which domain
        </p>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
        <span className="flex items-center gap-1"><Check className="w-3 h-3 text-amber-400" /><span className="text-amber-300 font-semibold">ABS</span> Absolute</span>
        <span className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-400" /> Bounded</span>
        <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-400" /> Guardian approval required</span>
        <span className="flex items-center gap-1"><X className="w-3 h-3 text-slate-600" /> No authority</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left p-2 text-slate-400 font-semibold border-b border-slate-700/50 min-w-[180px]">
                Domain
              </th>
              {ROLES.map((r) => {
                const Icon = r.icon;
                return (
                  <th key={r.id} className="p-2 text-center border-b border-slate-700/50 min-w-[90px]">
                    <div className="flex flex-col items-center gap-1">
                      <Icon className={`w-4 h-4 ${r.color}`} />
                      <span className={`${r.color} font-semibold`}>{r.brand}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {AUTHORITY_MATRIX.map((row) => (
              <tr key={row.domain} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                <td className="p-2 text-slate-300">{row.label}</td>
                {ROLES.map((r) => (
                  <td key={r.id} className="p-2 text-center">
                    <CellBadge
                      scope={row.grants[r.id].scope}
                      requiresGuardian={row.grants[r.id].requiresGuardian}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700/30 space-y-2">
        <h4 className="text-sm font-semibold text-white">Reading the Matrix</h4>
        <ul className="text-xs text-slate-400 space-y-1">
          <li>myGuard holds absolute authority over sovereignty domains. No other role can override.</li>
          <li>aigentMe, aigentC, and aigentZ hold bounded authority within their respective agency domains.</li>
          <li>Infrastructure Continuity requires Guardian approval — aigentZ cannot act unilaterally on infrastructure.</li>
          <li>No role holds authority outside its constitutional mandate. Cross-domain actions trigger escalation.</li>
        </ul>
      </div>
    </div>
  );
}
