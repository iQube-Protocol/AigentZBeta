'use client';

/**
 * PassportBeingTab — Human Mobility Services (PRD §15).
 *
 * "Being" is the citizen-facing mobility vector: where can I be / stay /
 * live / work / be safe? It spans the full mobility spectrum — from
 * executive and global-talent relocation at one end to refugee, asylum,
 * and protection support at the other. The same identity spine (World ID →
 * Passport → Delegation → Agent → selective disclosure) serves both; only
 * the framing and the counterpart differ.
 *
 * Per PRD: "Being-related services should be in a separate tab in the
 * Passport Bureau Cartridge and may even be moved to a new separate
 * cartridge." This is the Phase 1 vision surface — it describes the two
 * mobility tracks and their demonstration scenarios without yet routing to
 * live service providers. Phase 2 connects to approved Being cartridges and
 * approved participant agents.
 */

import React, { useState } from 'react';
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
  Briefcase,
  Plane,
  Building2,
  FileCheck,
  Landmark,
} from 'lucide-react';

function cls(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

interface FlowStep {
  icon: React.ReactNode;
  label: string;
  description: string;
}

type TrackId = 'executive' | 'protection';

interface UseCase {
  icon: React.ReactNode;
  label: string;
  color: string;
}

const EXECUTIVE_USE_CASES: UseCase[] = [
  { icon: <Globe className="h-4 w-4" />, label: 'Visa & work-permit orientation', color: 'violet' },
  { icon: <Building2 className="h-4 w-4" />, label: 'Relocation & housing setup', color: 'emerald' },
  { icon: <Landmark className="h-4 w-4" />, label: 'Cross-border tax & residency orientation', color: 'sky' },
  { icon: <FileCheck className="h-4 w-4" />, label: 'Fast-track identity & credential verification', color: 'amber' },
  { icon: <Plane className="h-4 w-4" />, label: 'Global-talent & investor mobility navigation', color: 'cyan' },
  { icon: <Shield className="h-4 w-4" />, label: 'Travel-risk & security briefings', color: 'rose' },
];

const PROTECTION_USE_CASES: UseCase[] = [
  { icon: <Globe className="h-4 w-4" />, label: 'Immigration law orientation', color: 'violet' },
  { icon: <Home className="h-4 w-4" />, label: 'Housing law orientation', color: 'emerald' },
  { icon: <Shield className="h-4 w-4" />, label: 'Shelter and support discovery', color: 'sky' },
  { icon: <Scale className="h-4 w-4" />, label: 'Statelessness documentation guidance', color: 'amber' },
  { icon: <Users className="h-4 w-4" />, label: 'Refugee/asylum support navigation', color: 'rose' },
  { icon: <Lock className="h-4 w-4" />, label: 'Anonymous identity continuity', color: 'cyan' },
];

const EXECUTIVE_FLOW: FlowStep[] = [
  { icon: <Fingerprint className="h-4 w-4 text-sky-400" />, label: 'World ID', description: 'Proof of human existence and uniqueness' },
  { icon: <Shield className="h-4 w-4 text-emerald-400" />, label: 'Citizen Passport', description: 'Polity membership recognition' },
  { icon: <Users className="h-4 w-4 text-violet-400" />, label: 'Delegation Grant', description: 'Authority delegated to a mobility concierge agent' },
  { icon: <Bot className="h-4 w-4 text-amber-400" />, label: 'Mobility Concierge Agent', description: 'Relocation, visa, and residency coordination' },
  { icon: <Lock className="h-4 w-4 text-rose-400" />, label: 'Walrus Document Vault', description: 'Encrypted passports, contracts, and filings' },
  { icon: <Eye className="h-4 w-4 text-cyan-400" />, label: 'ProveKit ZK Proof', description: 'Prove eligibility without exposing full dossier' },
  { icon: <Landmark className="h-4 w-4 text-green-400" />, label: 'Immigration / Tax Counsel', description: 'Verification without surfacing private financials' },
];

const PROTECTION_FLOW: FlowStep[] = [
  { icon: <Fingerprint className="h-4 w-4 text-sky-400" />, label: 'World ID', description: 'Proof of human existence and uniqueness' },
  { icon: <Shield className="h-4 w-4 text-emerald-400" />, label: 'Citizen Passport', description: 'Polity membership recognition' },
  { icon: <Users className="h-4 w-4 text-violet-400" />, label: 'Delegation Grant', description: 'Authority delegated to a mobility agent' },
  { icon: <Bot className="h-4 w-4 text-amber-400" />, label: 'Mobility Agent', description: 'Immigration/housing assistance intermediary' },
  { icon: <Lock className="h-4 w-4 text-rose-400" />, label: 'Walrus Evidence Vault', description: 'Encrypted case files and documents' },
  { icon: <Eye className="h-4 w-4 text-cyan-400" />, label: 'ProveKit ZK Proof', description: 'Selective disclosure — verify without exposing' },
  { icon: <Scale className="h-4 w-4 text-green-400" />, label: 'Immigration Counsel', description: 'Verification without raw data exposure' },
];

const TRACKS: Record<TrackId, {
  label: string;
  tagline: string;
  icon: React.ReactNode;
  /** Static classes (Tailwind JIT-safe — no runtime interpolation). */
  toggleActiveClass: string;
  iconActiveClass: string;
  useCases: UseCase[];
  scenarioTitle: string;
  flow: FlowStep[];
}> = {
  executive: {
    label: 'Executive & Global Mobility',
    tagline: 'Relocation, work authorisation, and cross-border living for executives, global talent, and investors.',
    icon: <Briefcase className="h-4 w-4" />,
    toggleActiveClass: 'bg-sky-500/20 text-sky-200 border border-sky-500/30',
    iconActiveClass: 'text-sky-300',
    useCases: EXECUTIVE_USE_CASES,
    scenarioTitle: 'Demonstration Scenario: Executive Relocation',
    flow: EXECUTIVE_FLOW,
  },
  protection: {
    label: 'Vulnerable Persons & Protection',
    tagline: 'Safe passage, shelter, and legal orientation for refugees, stateless people, and those in fragile contexts.',
    icon: <Shield className="h-4 w-4" />,
    toggleActiveClass: 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30',
    iconActiveClass: 'text-emerald-300',
    useCases: PROTECTION_USE_CASES,
    scenarioTitle: 'Demonstration Scenario: Refugee / Stateless Citizen',
    flow: PROTECTION_FLOW,
  },
};

export function PassportBeingTab() {
  const [track, setTrack] = useState<TrackId>('executive');
  const active = TRACKS[track];

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div className="flex items-center gap-3">
        <Home className="h-7 w-7 text-emerald-400" />
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Being</h2>
          <p className="text-sm text-slate-400">
            Human Mobility Services — where can I be, stay, live, work, and be safe?
          </p>
        </div>
      </div>

      {/* Phase marker */}
      <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
          Phase 1 Stub
        </span>
        <p className="text-xs text-amber-200/80">
          This tab describes the Human Mobility Services vision across both mobility tracks.
          Phase 2 connects to approved Being cartridges and approved participant agents.
        </p>
      </div>

      {/* Vision statement */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
        <blockquote className="border-l-2 border-emerald-500/50 pl-3 text-emerald-200/90 italic text-sm">
          The Passport Bureau does not itself provide formal legal advice. It routes citizens to
          approved Being cartridges and approved participant agents for immigration, housing,
          relocation, legal assistance, and support navigation.
        </blockquote>
        <p className="text-sm text-slate-300">
          Human mobility spans a spectrum. At one end, executives, global talent, and investors
          move across borders for work and life and need fast, private coordination of visas,
          residency, tax, and housing. At the other, refugees, stateless people, and those in
          fragile legal or political contexts need identity continuity and access to protection
          workflows without surrendering unnecessary PII at the entry point. The same identity
          spine serves both — the disclosure stays minimal either way.
        </p>
      </div>

      {/* Track toggle — balances the two mobility audiences */}
      <div className="flex gap-1 rounded-lg border border-slate-700/40 bg-slate-900/30 p-1">
        {(Object.keys(TRACKS) as TrackId[]).map((id) => {
          const t = TRACKS[id];
          const selected = track === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTrack(id)}
              className={cls(
                'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                selected ? t.toggleActiveClass : 'text-slate-400 hover:text-slate-200',
              )}
            >
              <span className={selected ? t.iconActiveClass : 'text-slate-500'}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-slate-400 -mt-2">{active.tagline}</p>

      {/* Use cases for the active track */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-200">Initial use cases</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {active.useCases.map((uc) => (
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

      {/* Scenario flow for the active track */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">{active.scenarioTitle}</h3>
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <div className="space-y-2">
            {active.flow.map((step, i) => (
              <React.Fragment key={step.label}>
                <div className="flex items-center gap-3">
                  <span className="shrink-0">{step.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-100">{step.label}</p>
                    <p className="text-xs text-slate-500">{step.description}</p>
                  </div>
                </div>
                {i < active.flow.length - 1 && (
                  <div className="flex justify-center">
                    <ArrowRight className="h-3 w-3 text-slate-600 rotate-90" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Privacy guarantees — identical spine for both tracks */}
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
            <li>Private case notes, financials, or health info</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
