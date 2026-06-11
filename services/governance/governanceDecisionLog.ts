/**
 * Governance Decision Log — Operation Chrysalis Phase 0
 *
 * Tracks constitutional and governance decisions as machine-readable records.
 * Each decision is immutable once recorded — amendments create new entries
 * that reference the original via `amends` field.
 */

// ─── Decision types ─────────────────────────────────────────────────────────

export type DecisionStatus =
  | 'proposed'
  | 'ratified'
  | 'amended'
  | 'superseded'
  | 'withdrawn';

export type DecisionDomain =
  | 'constitutional'
  | 'governance'
  | 'authority'
  | 'passport'
  | 'identity'
  | 'fulfillment'
  | 'registry'
  | 'operations';

export interface GovernanceDecision {
  id: string;
  title: string;
  domain: DecisionDomain;
  status: DecisionStatus;
  date: string;
  initiative: string;
  summary: string;
  rationale: string;
  amends: string | null;
  superseded_by: string | null;
}

// ─── Ratified decisions from Operation Chrysalis ────────────────────────────

export const GOVERNANCE_DECISIONS: GovernanceDecision[] = [
  {
    id: 'GD-001',
    title: 'Agency is a constitutional principle, not a runtime principal',
    domain: 'constitutional',
    status: 'ratified',
    date: '2026-06-11',
    initiative: 'Operation Chrysalis',
    summary: 'Agency represents the preservation and balancing of individual, collective, and platform agency. It shall not be implemented as a root runtime agent.',
    rationale: 'Avoids introducing unnecessary authority layers while preserving balanced representation across the three agency domains.',
    amends: null,
    superseded_by: null,
  },
  {
    id: 'GD-002',
    title: 'Four constitutional roles: myGuard, aigentMe, aigentC, aigentZ',
    domain: 'constitutional',
    status: 'ratified',
    date: '2026-06-11',
    initiative: 'Operation Chrysalis',
    summary: 'The constitutional hierarchy consists of metaMe Guardian (sovereignty layer), aigentMe (individual agency), aigentC (collective agency), and aigentZ (platform agency).',
    rationale: 'Each domain of interest (sovereignty, individual, collective, platform) has explicit representation. No single agent may represent all interests.',
    amends: null,
    superseded_by: null,
  },
  {
    id: 'GD-003',
    title: 'Aigent ≠ generic AI agent — aigents are passported participants',
    domain: 'passport',
    status: 'ratified',
    date: '2026-06-11',
    initiative: 'Operation Chrysalis',
    summary: 'An aigent is a polity-compliant AI agent holding a valid Participant Passport, operating under bounded delegation and constitutional governance. Generic AI agents have no polity standing.',
    rationale: 'Distinguishes governed, accountable agents from arbitrary AI systems. Passport requirement ensures provenance, bounded delegation, and constitutional compliance.',
    amends: null,
    superseded_by: null,
  },
  {
    id: 'GD-004',
    title: '@aigent handles as human-readable identity for passported participants',
    domain: 'identity',
    status: 'ratified',
    date: '2026-06-11',
    initiative: 'Operation Chrysalis',
    summary: 'Passported aigents are identified by @<name>.aigent handles. The handle sits atop the identity stack: Passport → RootDID → PersonaID → @aigent Handle.',
    rationale: 'Provides a human-readable, discoverable identity layer while maintaining cryptographic identity (RootDID) and governance credential (Passport) beneath.',
    amends: null,
    superseded_by: null,
  },
  {
    id: 'GD-005',
    title: 'Participant Passports are W3C Verifiable Credentials',
    domain: 'passport',
    status: 'ratified',
    date: '2026-06-11',
    initiative: 'Operation Chrysalis',
    summary: 'Polity Participant Passports are W3C VCs. Phase A uses HMAC stub signing; Phase C will upgrade to asymmetric, publicly verifiable proofs.',
    rationale: 'W3C VC format provides interoperability, standard verification flows, and a clear upgrade path from stub to production signing.',
    amends: null,
    superseded_by: null,
  },
  {
    id: 'GD-006',
    title: 'AgentiQ Constitution of Aigents governs the platform; distinct from Polity Constitution',
    domain: 'constitutional',
    status: 'ratified',
    date: '2026-06-11',
    initiative: 'Operation Chrysalis',
    summary: 'The AgentiQ Constitution of Aigents governs the AgentiQ ecosystem, its agents, authority boundaries, and fulfillment model. The broader Polity Constitution (future) governs humans, agents, institutions, and participation across the entire polity.',
    rationale: 'Clean separation of platform governance from societal governance. The platform constitution can evolve independently while remaining subordinate to the eventual Polity Constitution.',
    amends: null,
    superseded_by: null,
  },
  {
    id: 'GD-007',
    title: 'Operation Chrysalis: evolution not replacement',
    domain: 'fulfillment',
    status: 'ratified',
    date: '2026-06-11',
    initiative: 'Operation Chrysalis',
    summary: 'The existing AgentiQ ecosystem already contains most required architecture. Operation Chrysalis focuses on clarification, consolidation, elevation, governance, and autonomy — not greenfield construction.',
    rationale: 'Repository audits show aigentZ is already highly mature. Governance, receipt, registry, and memory infrastructure already exists. The gap is organizational and constitutional, not foundational.',
    amends: null,
    superseded_by: null,
  },
];

// ─── Decision log helpers ───────────────────────────────────────────────────

export function getDecision(id: string): GovernanceDecision | undefined {
  return GOVERNANCE_DECISIONS.find(d => d.id === id);
}

export function getDecisionsByDomain(domain: DecisionDomain): GovernanceDecision[] {
  return GOVERNANCE_DECISIONS.filter(d => d.domain === domain);
}

export function getDecisionsByInitiative(initiative: string): GovernanceDecision[] {
  return GOVERNANCE_DECISIONS.filter(d => d.initiative === initiative);
}

export function getActiveDecisions(): GovernanceDecision[] {
  return GOVERNANCE_DECISIONS.filter(d => d.status === 'ratified');
}
