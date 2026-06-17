'use client';

/**
 * PassportBeingTab — Human Mobility Services stub (PRD §15).
 *
 * "Being" is the first citizen-facing activation vector: where can I be /
 * stay / live / be safe / access shelter / access immigration support?
 *
 * Per PRD: "Being-related services should be in a separate tab in the
 * Passport Bureau Cartridge and may even be moved to a new separate
 * cartridge — stub for that."
 *
 * This is a Phase 1 stub — it describes the vision and demonstration
 * scenarios without implementing the actual service routing. Phase 2
 * will connect to approved Being cartridges and approved participant
 * agents.
 */

import React from 'react';
import {
  Home,
  Shield,
  Scale,
  Globe,
  Users,
  ArrowRight,
  Lock,
  Fingerprint,
  Eye,
  Bot,
} from 'lucide-react';

function cls(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

interface FlowStep {
  icon: React.ReactNode;
  label: string;
  description: string;
}

const REFUGEE_FLOW: FlowStep[] = [
  { icon: <Fingerprint className="h-4 w-4 text-sky-400" />, label: 'World ID', description: 'Proof of human existence and uniqueness' },
  { icon: <Shield className="h-4 w-4 text-emerald-400" />, label: 'Citizen Passport', description: 'Polity membership recognition' },
  { icon: <Users className="h-4 w-4 text-violet-400" />, label: 'Delegation Grant', description: 'Authority delegated to a mobility agent' },
  { icon: <Bot className="h-4 w-4 text-amber-400" />, label: 'Mobility Agent', description: 'Immigration/housing assistance intermediary' },
  { icon: <Lock className="h-4 w-4 text-rose-400" />, label: 'Walrus Evidence Vault', description: 'Encrypted case files and documents' },
  { icon: <Eye className="h-4 w-4 text-cyan-400" />, label: 'ProveKit ZK Proof', description: 'Selective disclosure — verify without exposing' },
  { icon: <Scale className="h-4 w-4 text-green-400" />, label: 'Immigration Counsel', description: 'Verification without raw data exposure' },
];

const USE_CASES = [
  { icon: <Globe className="h-4 w-4" />, label: 'Immigration law orientation', color: 'violet' },
  { icon: <Home className="h-4 w-4" />, label: 'Housing law orientation', color: 'emerald' },
  { icon: <Shield className="h-4 w-4" />, label: 'Shelter and support discovery', color: 'sky' },
  { icon: <Scale className="h-4 w-4" />, label: 'Statelessness documentation guidance', color: 'amber' },
  { icon: <Users className="h-4 w-4" />, label: 'Refugee/asylum support navigation', color: 'rose' },
  { icon: <Lock className="h-4 w-4" />, label: 'Anonymous identity continuity', color: 'cyan' },
];

export function PassportBeingTab() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div className="flex items-center gap-3">
        <Home className="h-7 w-7 text-emerald-400" />
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Being</h2>
          <p className="text-sm text-slate-400">
            Human Mobility Services — where can I be, stay, live, and be safe?
          </p>
        </div>
      </div>

      {/* Phase marker → HMS Cartridge live */}
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-2">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
          Phase 2 Live
        </span>
        <p className="text-xs text-emerald-200/80">
          Human Mobility Services is now available as a dedicated cartridge.
          Case activation, MAF intake, and workstream management are live.
        </p>
      </div>

      {/* Vision statement */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
        <blockquote className="border-l-2 border-emerald-500/50 pl-3 text-emerald-200/90 italic text-sm">
          The Passport Bureau does not itself provide formal legal advice. It routes citizens to
          approved Being cartridges and approved participant agents for immigration, housing,
          legal assistance, and support navigation.
        </blockquote>
        <p className="text-sm text-slate-300">
          Especially important for: stateless citizens, refugees, people in fragile legal or
          political contexts, people who need identity continuity without forced exposure, and
          people who need access to immigration, housing, legal, and assistance workflows
          without surrendering unnecessary PII at the entry point.
        </p>
      </div>

      {/* Use cases */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-200">Initial use cases</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {USE_CASES.map((uc) => (
            <div
              key={uc.label}
              className={cls(
                'flex items-center gap-2.5 rounded-lg border px-3 py-2.5',
                `border-${uc.color}-500/20 bg-${uc.color}-500/5`,
              )}
            >
              <span className={`text-${uc.color}-400`}>{uc.icon}</span>
              <span className="text-sm text-slate-200">{uc.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Refugee scenario flow */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">
          Demonstration Scenario: Refugee / Stateless Citizen
        </h3>
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <div className="space-y-2">
            {REFUGEE_FLOW.map((step, i) => (
              <React.Fragment key={step.label}>
                <div className="flex items-center gap-3">
                  <span className="shrink-0">{step.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-100">{step.label}</p>
                    <p className="text-xs text-slate-500">{step.description}</p>
                  </div>
                </div>
                {i < REFUGEE_FLOW.length - 1 && (
                  <div className="flex justify-center">
                    <ArrowRight className="h-3 w-3 text-slate-600 rotate-90" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Privacy guarantees */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-emerald-300">Counsel CAN verify:</p>
          <ul className="text-xs text-slate-400 space-y-0.5 list-disc list-inside">
            <li>Human existence and uniqueness</li>
            <li>Delegated authority from the citizen</li>
            <li>Passport standing and eligibility</li>
            <li>Possession of supporting evidence</li>
          </ul>
        </div>
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-rose-300">Counsel CANNOT learn:</p>
          <ul className="text-xs text-slate-400 space-y-0.5 list-disc list-inside">
            <li>Exact location or movement history</li>
            <li>Legal name or identity</li>
            <li>Unnecessary personal information</li>
            <li>Private case notes or health info</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
