/**
 * Aigent Factor — canonical capability manifest (Factor cognitive-runtime
 * fix, 2026-09-05, following the specialist-surfaces separation pass).
 *
 * Factor was given a first-class SCREEN (FactorPanel.tsx) but no first-class
 * CAPABILITY MODEL — every consultation, including "what are your
 * capabilities?", fell through to a single hardcoded candidate-intake
 * template (services/agents/specialistRouter.ts's old `factor` branch).
 * This file is the single source of truth every other Factor-facing surface
 * DERIVES from — the Factor system prompt, the deterministic template
 * fallback, FactorPanel's workstream cards, the Agent Card
 * (app/api/agents/factor/agent-card.json/route.ts), and the health route
 * (app/api/agents/factor/health/route.ts) — never a second, hand-copied
 * capability list (CLAUDE.md "Extend, Don't Duplicate" / source-of-truth
 * parity).
 *
 * STATUS TRUTHFULNESS — every `status` below was verified against the real
 * implementation, not asserted:
 *   - candidate_intake: FULL case lifecycle is wired (services/factor/
 *     factorCaseService.ts + the /api/moneypenny/factor/cases/* routes +
 *     FactorPanel's case-mode UI) -> operational.
 *   - aegis_referral: FactorPanel's handoffToAegis() carries a bounded
 *     caseId to Aegis's own panel; Aegis's assessment service is real ->
 *     operational.
 *   - authority_chain: establishDirectChain/establishMediatedChain/
 *     revokeChain are real and reachable via /api/moneypenny/factor/
 *     authority-chains/*, but validateChainForAction (the actual
 *     enforcement gate) is defined and never called from any transition or
 *     admission route -> partial.
 *   - horizen_journey_spine: a real Horizen registration binding is
 *     resolved (services/horizen/agentRegistrationBinding.ts) and reported
 *     by Factor's own Agent Card, but its own status there is literally
 *     "pending_registration" — no on-chain registration has completed ->
 *     partial.
 *   - standing_proposal: services/factor/standingProposal.ts is a real,
 *     evidence-gated service (refuses with no evidence, PRD §10), but there
 *     is no REST route and no FactorPanel control that reaches it -> partial
 *     (a real capability with no surfaced path to invoke it yet).
 *   - agent_service_discovery, identity_wallet_settlement, pulse_pnl:
 *     Factor has no owned handler for these — the real work (registry
 *     discovery, wallet provisioning, Pulse/P&L data) lives in other
 *     services Factor does not itself call -> advisory (Factor can explain
 *     and orient, not act).
 *   - financial_service_composition, vela_confidential_compute,
 *     bankr_tokenization, runtime_activation: no implementation exists
 *     anywhere in this codebase as a Factor-bound capability -> planned.
 *     Do not wire fake handlers for these.
 *   - general_orientation: this manifest + the classification/response path
 *     itself -> operational.
 */

export type FactorCapabilityStatus = "operational" | "partial" | "advisory" | "planned";

export type FactorInteractionMode = "explain" | "assess-readiness" | "prepare" | "act";

export type FactorCapabilityId =
  | "general_orientation"
  | "agent_service_discovery"
  | "candidate_intake"
  | "horizen_journey_spine"
  | "identity_wallet_settlement"
  | "authority_chain"
  | "financial_service_composition"
  | "pulse_pnl"
  | "standing_proposal"
  | "aegis_referral"
  | "vela_confidential_compute"
  | "bankr_tokenization"
  | "runtime_activation";

export interface FactorCapability {
  id: FactorCapabilityId;
  title: string;
  description: string;
  status: FactorCapabilityStatus;
  interactionModes: FactorInteractionMode[];
  /** File path of the real handler backing this capability, when one exists. */
  handler?: string;
  requiredAuthority?: string[];
  /** Example questions/prompts this capability answers — used to seed the classifier and workstream copy. */
  examples: string[];
  /** Immutable constraints Factor must state truthfully when this capability comes up. */
  boundaries: string[];
}

export const FACTOR_CAPABILITIES: FactorCapability[] = [
  {
    id: "general_orientation",
    title: "General orientation & capability discovery",
    description:
      "Explains what Aigent Factor is, what it can and cannot do today, and routes the operator to the right capability.",
    status: "operational",
    interactionModes: ["explain"],
    examples: ["What are your capabilities?", "Explain Aigent Factor's role in MoneyPenny", "What can you help me with?"],
    boundaries: [
      "Factor is MoneyPenny's constitutional economic activation and ecosystem-catalysis specialist — candidate intake is one capability among many, not its governing identity.",
      "Never claims a planned capability is live.",
    ],
  },
  {
    id: "agent_service_discovery",
    title: "Agent and service discovery",
    description:
      "Helps the operator understand what agents and MoneyPenny Financial Services exist and how they relate — advisory orientation only; the actual registry/service lookups live in the iQube Registry and MoneyPenny's own service catalog, not in a Factor-owned handler.",
    status: "advisory",
    interactionModes: ["explain"],
    examples: ["What agents are already admitted?", "What financial services does MoneyPenny offer?"],
    boundaries: ["Factor does not itself query the registry or service catalog — it can only orient the operator toward those surfaces."],
  },
  {
    id: "candidate_intake",
    title: "Candidate intake and evidence preparation",
    description:
      "Opens or resumes ONE case per candidate, walks the evidence checklist (capability declarations, endpoints, code provenance), and tracks the authority chain the case is worked under.",
    status: "operational",
    interactionModes: ["explain", "assess-readiness", "prepare", "act"],
    handler: "services/factor/factorCaseService.ts",
    requiredAuthority: ["factor-case-authority"],
    examples: [
      "Help Atlas prepare for iQube Registry admission",
      "Open a candidate case for this agent",
      "What evidence is missing for this candidate?",
    ],
    boundaries: [
      "Factor never assesses its own candidate — an independent Aegis assessment is required.",
      "Factor never decides admission — that authority belongs to MoneyPenny alone.",
    ],
  },
  {
    id: "horizen_journey_spine",
    title: "Registry and Horizen Journey Spine facilitation",
    description:
      "Explains how a candidate or admitted agent traverses the Horizen Journey Spine toward registration. Horizen registration binding resolution is real, but the registration itself is provisioned and pending — not yet broadcast on-chain.",
    status: "partial",
    interactionModes: ["explain", "assess-readiness"],
    handler: "services/horizen/agentRegistrationBinding.ts",
    examples: ["Help this agent traverse the Horizen Journey Spine", "What is this agent's Horizen registration status?"],
    boundaries: ["Factor cannot broadcast or confirm an on-chain registration itself — it can only report and explain the current binding state."],
  },
  {
    id: "identity_wallet_settlement",
    title: "Identity, wallet and settlement readiness",
    description:
      "Explains what identity and wallet readiness (FIO handle, owner wallet, X402 settlement wallet) an agent needs before it can transact — advisory only; Factor has no handler to provision a candidate's wallet or settlement identity.",
    status: "advisory",
    interactionModes: ["explain", "assess-readiness"],
    examples: ["Prepare an X402 settlement wallet for this agent", "What identity does this candidate need before admission?"],
    boundaries: ["Factor cannot provision or move funds in any wallet — identity/wallet provisioning is a separate, human/operator-driven step."],
  },
  {
    id: "authority_chain",
    title: "Authority-chain and delegation preparation",
    description:
      "Establishes or revokes a direct or MoneyPenny-mediated authority chain for a case. Establish and revoke are real and reachable; the validation gate that would enforce a chain on every subsequent action exists but is not yet wired into the transition/admission routes.",
    status: "partial",
    interactionModes: ["explain", "assess-readiness", "prepare"],
    handler: "services/factor/authorityChain.ts",
    requiredAuthority: ["authority-chain-establish"],
    examples: ["Establish an authority chain for this case", "Is this candidate's authority chain still valid?"],
    boundaries: ["Factor never manufactures authority a real delegation_grants row does not already grant."],
  },
  {
    id: "financial_service_composition",
    title: "Financial-service discovery and composition",
    description:
      "Composing multiple MoneyPenny Financial Services into a single request for an agent — no implementation exists yet.",
    status: "planned",
    interactionModes: ["explain"],
    examples: ["Compose a financial-service bundle for this agent", "Can you set up recurring settlement for this agent?"],
    boundaries: ["No service-composition handler exists yet — Factor can only describe what this would look like when built."],
  },
  {
    id: "pulse_pnl",
    title: "Pulse/P&L registration and performance evidence",
    description:
      "Standing proposals can cite Pulse/P&L evidence references, but there is no registration flow or live Pulse/P&L data source Factor itself reaches — advisory only.",
    status: "advisory",
    interactionModes: ["explain", "assess-readiness"],
    examples: ["Facilitate Pulse and P&L registration for this agent", "How does Pulse/P&L evidence factor into standing?"],
    boundaries: ["Factor cannot register an agent for Pulse/P&L reporting today — it can only explain how such evidence would be used in a standing proposal."],
  },
  {
    id: "standing_proposal",
    title: "Standing proposal and progression",
    description:
      "A real, evidence-gated service can create a standing proposal for an admitted agent (refuses outright with no veracity/contribution/risk-of-repair evidence), but no API route or panel control surfaces it yet.",
    status: "partial",
    interactionModes: ["explain", "assess-readiness", "prepare"],
    handler: "services/factor/standingProposal.ts",
    requiredAuthority: ["standing-proposal-evidence"],
    examples: ["How can this agent gain standing?", "Propose a standing event for this agent"],
    boundaries: [
      "Factor only ever PROPOSES a standing event — it never writes standing directly.",
      "A proposal with no veracity, contribution, or risk-of-repair evidence is refused outright.",
    ],
  },
  {
    id: "aegis_referral",
    title: "Aegis assessment referral",
    description:
      "Hands off a case to Aegis for an independent assessment, carrying only the bounded caseId — never a copied private thread.",
    status: "operational",
    interactionModes: ["explain", "act"],
    handler: "app/(shell)/moneypenny/components/FactorPanel.tsx#handoffToAegis",
    examples: ["Request an independent Aegis assessment", "Refer this candidate to Aegis"],
    boundaries: ["Factor cannot assess its own candidate — this referral is the only path to an assessment."],
  },
  {
    id: "vela_confidential_compute",
    title: "Vela confidential-compute preparation",
    description: "Preparing a workload for Vela confidential compute on an agent's behalf — no Factor-bound implementation exists.",
    status: "planned",
    interactionModes: ["explain"],
    examples: ["Can Vela protect this workload?", "Prepare this agent for confidential compute"],
    boundaries: ["No Vela integration exists for Factor — this is a described capability, not a live one."],
  },
  {
    id: "bankr_tokenization",
    title: "Bankr/tokenization readiness and governed execution",
    description: "Issuing a fair-launch token through Bankr on an agent's behalf — no implementation exists.",
    status: "planned",
    interactionModes: ["explain"],
    examples: ["Could this agent issue a fair-launch token through Bankr?", "Help this agent tokenize its service"],
    boundaries: ["No Bankr integration exists for Factor — Factor cannot initiate or govern a token issuance today."],
  },
  {
    id: "runtime_activation",
    title: "Runtime activation and activity catalysis",
    description:
      "A case can be moved through 'activation_pending' -> 'active' as a state-machine bookkeeping transition, but no real runtime deployment or activity-catalysis handler is bound to that transition.",
    status: "planned",
    interactionModes: ["explain"],
    examples: ["Activate this agent's runtime", "Catalyze this agent's first activity"],
    boundaries: ["Marking a case 'active' is a state label only — Factor does not itself deploy or operate any runtime."],
  },
];

export function getFactorCapability(id: FactorCapabilityId): FactorCapability {
  const found = FACTOR_CAPABILITIES.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown Factor capability id: ${id}`);
  return found;
}

export function isFactorCapabilityId(value: unknown): value is FactorCapabilityId {
  return typeof value === "string" && FACTOR_CAPABILITIES.some((c) => c.id === value);
}

/**
 * Deterministic, ordered keyword classification of free text into a
 * FactorCapabilityId. Most-specific patterns are checked first so, e.g.,
 * "what are your capabilities" never falls into candidate-intake framing.
 * Returns `null` when nothing matches (caller falls back to
 * 'general_orientation' rather than guessing).
 *
 * This is the ONE classification step every Factor-facing surface (live LLM
 * prompt framing, the deterministic template fallback, and
 * specialistDelegation.ts's grounding) must call — never a second,
 * divergent classifier.
 */
const CAPABILITY_PATTERNS: Array<{ id: FactorCapabilityId; pattern: RegExp }> = [
  { id: "general_orientation", pattern: /\b(your |factor'?s? )?capabilit(y|ies)\b|what (can|do) you (do|help)|explain (aigent )?factor'?s? role|who are you\b/i },
  { id: "standing_proposal", pattern: /\bstanding\b/i },
  { id: "pulse_pnl", pattern: /\bpulse\b.*\bp&?\s?l\b|\bp&?\s?l\b.*\bpulse\b|pulse\/p&l|pulse and p&l/i },
  { id: "horizen_journey_spine", pattern: /\bhorizen\b|\bjourney spine\b/i },
  { id: "authority_chain", pattern: /\bauthority chain\b|\bdelegation\b/i },
  { id: "vela_confidential_compute", pattern: /\bvela\b|confidential compute/i },
  { id: "bankr_tokenization", pattern: /\bbankr\b|\btokeni[sz]e?\b|fair-launch token/i },
  {
    id: "identity_wallet_settlement",
    pattern: /\bx402\b|settlement wallet|\bwallet\b.*\bready|identity.{0,20}wallet/i,
  },
  { id: "aegis_referral", pattern: /\baegis\b|independent assessment/i },
  { id: "financial_service_composition", pattern: /\bcompose\b.*financial service|service composition|financial-service bundle/i },
  { id: "runtime_activation", pattern: /\bactivate\b.{0,20}runtime|runtime activation|catalyz/i },
  {
    id: "candidate_intake",
    pattern: /\bcandidate\b|\badmission\b|evidence checklist|registry application|iqube registry/i,
  },
  { id: "agent_service_discovery", pattern: /\bdiscover\b.*agent|what (agents|services)|find (an )?agent/i },
];

export function classifyFactorCapability(text: string | null | undefined): FactorCapabilityId {
  const t = (text ?? "").trim();
  if (!t) return "general_orientation";
  for (const { id, pattern } of CAPABILITY_PATTERNS) {
    if (pattern.test(t)) return id;
  }
  return "general_orientation";
}

/** Human-readable, truthful one-line status statement — used by both the
 *  live system prompt and the deterministic template so neither ever
 *  overstates a capability. */
export function factorStatusSentence(status: FactorCapabilityStatus): string {
  switch (status) {
    case "operational":
      return "This capability is live today.";
    case "partial":
      return "This capability is partially built — some of it is live, the rest is not yet wired end-to-end.";
    case "advisory":
      return "Aigent Factor can advise on this today, but has no automated handler for it yet.";
    case "planned":
      return "This capability is planned but not yet implemented — Aigent Factor cannot act on it today.";
  }
}
