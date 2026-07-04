'use client';

/**
 * PassportDoctrineTab — Polity Passport doctrine and framework library (PRD §4.1).
 *
 * Public-facing, machine-readable reference surface for the Bureau's
 * constitutional foundations: passport types, identity model, rights,
 * obligations, review criteria, and schema downloads.
 */

import React, { useState } from 'react';
import {
  BookOpen,
  ShieldCheck,
  Bot,
  User,
  Scale,
  FileJson,
  Download,
  ChevronDown,
  ChevronRight,
  Globe,
  Lock,
  Fingerprint,
  Eye,
  ScrollText,
} from 'lucide-react';

function cls(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

interface DocSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

function Accordion({ section }: { section: DocSection }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/40 transition-colors"
      >
        <span className="shrink-0">{section.icon}</span>
        <span className="flex-1 text-sm font-semibold text-slate-100">{section.title}</span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-500" />
        )}
      </button>
      {open && (
        <div className="border-t border-slate-700/60 px-4 py-3 text-sm text-slate-300 space-y-3">
          {section.content}
        </div>
      )}
    </div>
  );
}

const PASSPORT_TYPES: Array<{
  name: string;
  forWhom: string;
  icon: React.ReactNode;
  color: string;
  requirements: string[];
  revocable: boolean;
}> = [
  {
    name: 'Citizen Passport',
    forWhom: 'Humans',
    icon: <User className="h-5 w-5 text-emerald-400" />,
    color: 'emerald',
    requirements: [
      'Persona creation (username + password)',
      'KybeDID creation or binding (continuity anchor)',
      'Proof of human presence (CAPTCHA or equivalent)',
      'Consent to Citizen Passport terms',
    ],
    revocable: false,
  },
  {
    name: 'Verified Citizen Passport',
    forWhom: 'Humans with strong proof',
    icon: <Fingerprint className="h-5 w-5 text-sky-400" />,
    color: 'sky',
    requirements: [
      'All Citizen Passport requirements',
      'Strong proof of unique humanity (World ID or approved provider)',
    ],
    revocable: false,
  },
  {
    name: 'Participant Passport',
    forWhom: 'Agents and non-human entities',
    icon: <Bot className="h-5 w-5 text-violet-400" />,
    color: 'violet',
    requirements: [
      'Agent Card or equivalent declaration',
      'Declared capabilities and constraints',
      'Operator or creator declaration (where available)',
      'Policy acceptance and obligation consent',
      'Steward review for high-risk agents',
    ],
    revocable: true,
  },
];

const CITIZEN_STATUSES = [
  'draft', 'submitted', 'pending_approval', 'active', 'renewal_due',
  'expired_non_renewal', 'dormant', 'inactive_presumed',
  'ceased_death_confirmed', 'superseded_by_reissue',
];

const PARTICIPANT_STATUSES = [
  'draft', 'submitted', 'pending_approval', 'provisionally_issued',
  'approved', 'restricted', 'needs_more_information', 'suspended',
  'revoked', 'expired', 'renewed', 'delisted',
];

export function PassportDoctrineTab() {
  const sections: DocSection[] = [
    {
      id: 'constitutional-principle',
      title: 'Constitutional Principle',
      icon: <Scale className="h-5 w-5 text-amber-400" />,
      content: (
        <>
          <blockquote className="border-l-2 border-amber-500/50 pl-3 text-amber-200/90 italic">
            A Citizen Polity Passport is proof of personhood and recognition of human standing
            within the Polity. Because personhood is not a privilege granted by the system, the
            Citizen Passport itself must not be revocable for misconduct, reputation damage,
            criminality, political status, economic status, social standing, or loss of access to
            particular services.
          </blockquote>
          <p>
            The Polity may restrict privileges, services, cartridge access, or application-specific
            rights, but it must not revoke recognition of a human being as a person.
          </p>
          <div className="mt-2 space-y-1">
            <p className="text-xs font-semibold text-slate-400">Three-surface model:</p>
            <ul className="text-xs text-slate-400 space-y-0.5 list-disc list-inside">
              <li><strong className="text-slate-200">DiDQubes (RootDID layer)</strong> — manage reputation</li>
              <li><strong className="text-slate-200">KybeDID</strong> — proves unique personhood</li>
              <li><strong className="text-slate-200">Citizen Passport</strong> — anonymous KybeDID proxy for proof of Polity citizenship</li>
            </ul>
          </div>
        </>
      ),
    },
    {
      id: 'passport-types',
      title: 'Passport Types',
      icon: <ShieldCheck className="h-5 w-5 text-violet-400" />,
      content: (
        <div className="space-y-3">
          {PASSPORT_TYPES.map((pt) => (
            <div
              key={pt.name}
              className={`rounded-lg border border-${pt.color}-500/20 bg-${pt.color}-500/5 p-3 space-y-2`}
            >
              <div className="flex items-center gap-2">
                {pt.icon}
                <span className="font-semibold text-slate-100">{pt.name}</span>
                <span className="text-xs text-slate-500">— {pt.forWhom}</span>
              </div>
              <ul className="text-xs text-slate-400 space-y-0.5 list-disc list-inside">
                {pt.requirements.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p className={`text-xs ${pt.revocable ? 'text-rose-400' : 'text-emerald-400'}`}>
                {pt.revocable
                  ? 'Revocable — agent participation is conditional on standing and compliance'
                  : 'Irrevocable — personhood recognition cannot be revoked'}
              </p>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'identity-model',
      title: 'Identity Model',
      icon: <Fingerprint className="h-5 w-5 text-cyan-400" />,
      content: (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate-200 mb-1">Citizen Identity Structure</p>
            <ul className="text-xs text-slate-400 space-y-0.5 list-disc list-inside">
              <li><strong className="text-slate-300">Persona</strong> — day-to-day interface and login identity</li>
              <li><strong className="text-slate-300">KybeDID</strong> — unique personhood and continuity anchor</li>
              <li><strong className="text-slate-300">RootDID</strong> — reputation and high-verifiability identity layer</li>
              <li><strong className="text-slate-300">RootDID Proxy</strong> — revocable real-world identity proof when needed</li>
              <li><strong className="text-slate-300">blakQube</strong> — private self-custody storage for sensitive data</li>
              <li><strong className="text-slate-300">metaQube</strong> — public/passport-safe metadata</li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-200 mb-1">Agent Identity Structure</p>
            <ul className="text-xs text-slate-400 space-y-0.5 list-disc list-inside">
              <li><strong className="text-slate-300">Agent Card</strong> — public identity, endpoints, capabilities</li>
              <li><strong className="text-slate-300">Agent iQube</strong> — registry object representing the agent</li>
              <li><strong className="text-slate-300">Policy Profile</strong> — rights, constraints, obligations</li>
              <li><strong className="text-slate-300">Safety Profile</strong> — risk, scopes, audit requirements</li>
              <li><strong className="text-slate-300">Operator Declaration</strong> — human/org authority, where available</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'self-custody',
      title: 'Self-Custody blakQube Vault',
      icon: <Lock className="h-5 w-5 text-amber-400" />,
      content: (
        <>
          <blockquote className="border-l-2 border-amber-500/50 pl-3 text-amber-200/90 italic">
            The Passport Bureau may know that a Citizen Passport blakQube exists, but must not
            know what it contains.
          </blockquote>
          <ul className="text-xs text-slate-400 space-y-0.5 list-disc list-inside mt-2">
            <li>No blakQube passport payloads stored in Supabase</li>
            <li>No PII in Supabase, even encrypted under RLS</li>
            <li>No server-side encryption where the Bureau sees plaintext or key</li>
            <li>Encrypted files stored only on Walrus/AutoDrive</li>
            <li>Holder owns the decryption key — unrecoverable if lost</li>
          </ul>
          <p className="text-xs text-slate-500 mt-2">
            Email recovery restores account access only — it cannot recover the private vault.
          </p>
        </>
      ),
    },
    {
      id: 'privacy-tiers',
      title: 'Identifier Exposure Tiers',
      icon: <Eye className="h-5 w-5 text-green-400" />,
      content: (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="py-1.5 pr-3">Tier</th>
                <th className="py-1.5 pr-3">Where</th>
                <th className="py-1.5 pr-3">Examples</th>
                <th className="py-1.5">Can do</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              <tr className="border-b border-slate-800">
                <td className="py-1.5 pr-3 font-mono text-rose-400">T0</td>
                <td className="py-1.5 pr-3">Server only</td>
                <td className="py-1.5 pr-3 font-mono text-[10px]">personaId, authProfileId, rootDid</td>
                <td className="py-1.5">DB key, internal services. NEVER in browser JSON.</td>
              </tr>
              <tr className="border-b border-slate-800">
                <td className="py-1.5 pr-3 font-mono text-amber-400">T1</td>
                <td className="py-1.5 pr-3">Browser-safe</td>
                <td className="py-1.5 pr-3 font-mono text-[10px]">personaSessionToken, displayLabel</td>
                <td className="py-1.5">Render in UI, log for debugging.</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3 font-mono text-emerald-400">T2</td>
                <td className="py-1.5 pr-3">Public network</td>
                <td className="py-1.5 pr-3 font-mono text-[10px]">cohortAliasCommitment, cohortId</td>
                <td className="py-1.5">Only identifier in receipts.</td>
              </tr>
            </tbody>
          </table>
        </div>
      ),
    },
    {
      id: 'status-model',
      title: 'Registry Status Model',
      icon: <ScrollText className="h-5 w-5 text-violet-400" />,
      content: (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-emerald-300 mb-1">Citizen Passport Statuses</p>
            <div className="flex flex-wrap gap-1">
              {CITIZEN_STATUSES.map((s) => (
                <span key={s} className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300 font-mono">
                  {s}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              No &ldquo;revoked&rdquo; state — citizen passports are irrevocable.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-violet-300 mb-1">Agent Participant Passport Statuses</p>
            <div className="flex flex-wrap gap-1">
              {PARTICIPANT_STATUSES.map((s) => (
                <span key={s} className={cls(
                  'rounded-full px-2 py-0.5 text-[10px] font-mono',
                  s === 'revoked' || s === 'delisted'
                    ? 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                    : 'bg-violet-500/10 border border-violet-500/20 text-violet-300',
                )}>
                  {s}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Participant standing is conditional — may be restricted, suspended, or revoked.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'review-policy',
      title: 'Review Policy',
      icon: <Scale className="h-5 w-5 text-emerald-400" />,
      content: (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-emerald-300 mb-1">Approve if:</p>
            <ul className="text-xs text-slate-400 space-y-0.5 list-disc list-inside">
              <li>Application is valid and complete</li>
              <li>Identity/persona/agent references are sufficiently bound</li>
              <li>Risk profile is declared and acceptable</li>
              <li>Obligations are accepted</li>
              <li>No disqualifying safety issue found</li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-300 mb-1">Restrict if:</p>
            <ul className="text-xs text-slate-400 space-y-0.5 list-disc list-inside">
              <li>Agent has useful capabilities but limited auditability</li>
              <li>Operator identity is unknown</li>
              <li>Risk is high but manageable</li>
              <li>Capabilities require sandboxing</li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-rose-300 mb-1">Deny if:</p>
            <ul className="text-xs text-slate-400 space-y-0.5 list-disc list-inside">
              <li>Application is fraudulent</li>
              <li>Agent refuses obligations</li>
              <li>Agent hides critical capabilities</li>
              <li>Agent presents unacceptable risk</li>
              <li>Applicant attempts impersonation</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'machine-readable',
      title: 'Machine-Readable Surfaces',
      icon: <Globe className="h-5 w-5 text-sky-400" />,
      content: (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate-200 mb-1">Discovery endpoints</p>
            <div className="space-y-0.5">
              {[
                '/.well-known/agent-card.json',
                '/api/agents/<slug>/agent-card.json',
                '/api/polity-passport/attest/<type>',
                '/api/polity-passport/verify/<type>',
                '/api/polity-passport/registry',
                '/api/polity-passport/locker',
              ].map((ep) => (
                <code key={ep} className="block text-[10px] text-sky-300 font-mono bg-slate-800/60 px-2 py-0.5 rounded">
                  {ep}
                </code>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-200 mb-1">Attestation types (ProveKit)</p>
            <div className="flex flex-wrap gap-1">
              {['proof_of_personhood', 'proof_of_delegation_authority', 'proof_of_passport_standing', 'proof_of_document_possession', 'proof_of_mobility_authorization'].map((t) => (
                <span key={t} className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 font-mono">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center gap-3">
        <BookOpen className="h-7 w-7 text-violet-400" />
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Polity Passport Doctrine</h2>
          <p className="text-sm text-slate-400">
            Constitutional framework, passport types, identity model, rights, and obligations.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <a
          href="/api/polity-passport/registry"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
        >
          <FileJson className="h-3.5 w-3.5" />
          Registry API
        </a>
        <button
          onClick={() => {
            const blob = new Blob(
              [JSON.stringify({
                schema: 'polity.passport.doctrine.bundle.v0.1',
                passportTypes: PASSPORT_TYPES.map((pt) => ({
                  name: pt.name,
                  forWhom: pt.forWhom,
                  revocable: pt.revocable,
                  requirements: pt.requirements,
                })),
                citizenStatuses: CITIZEN_STATUSES,
                participantStatuses: PARTICIPANT_STATUSES,
                constitutionalPrinciple:
                  'Citizen Passports are irrevocable recognitions of human personhood. Agent Participant Passports carry conditional standing.',
              }, null, 2)],
              { type: 'application/json' },
            );
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'polity-passport-doctrine-bundle.json';
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 px-3 py-1.5 text-xs text-violet-300 hover:bg-violet-600/30 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Download doctrine bundle
        </button>
      </div>

      <div className="space-y-2">
        {sections.map((s) => (
          <Accordion key={s.id} section={s} />
        ))}
      </div>
    </div>
  );
}
