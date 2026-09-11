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
 *     resolved (services/horizen/agentRegistrationBinding.ts). CORRECTED
 *     2026-09-06 (Use Case Zero reconciliation, operator-confirmed live
 *     fact): Factor's OWN agent is itself Horizen-registered (ERC-8004
 *     token 9176, Base Sepolia). The capability itself stays "partial"
 *     because it facilitates OTHER agents' journeys, whose registration may
 *     still be provisioned-and-pending, not because Factor's own
 *     registration is incomplete -> partial (general-case status; not a
 *     claim about Factor's own agent).
 *   - standing_proposal: services/factor/standingProposal.ts is a real,
 *     evidence-gated service (refuses with no evidence, PRD §10), but there
 *     is no REST route and no FactorPanel control that reaches it -> partial
 *     (a real capability with no surfaced path to invoke it yet).
 *   - agent_service_discovery, identity_wallet_settlement, pulse_pnl:
 *     Factor has no owned handler for these — the real work (registry
 *     discovery, wallet provisioning, Pulse/P&L data) lives in other
 *     services Factor does not itself call -> advisory (Factor can explain
 *     and orient, not act).
 *   - vela_confidential_compute: CORRECTED 2026-09-06 (Use Case Zero
 *     reconciliation) — a real, tested Factor-bound workload exists
 *     (services/factor/factorConfidentialWorkload.ts, driving the actual
 *     ConfidentialProjectionProvider seam end to end) -> partial, not
 *     planned. It runs only against Vela's deterministic test transport —
 *     no live/production Vela deployment is configured anywhere in this
 *     codebase (services/vela/velaConfig.ts defines only a 'local',
 *     no_attestation deployment) — every run is honestly reported as
 *     simulated/test-transport.
 *   - bankr_tokenization: real, tested handlers exist end to end (see its
 *     own entry below) -> partial, simulated (Bankr's deterministic fake
 *     transport — no live BANKR_*_API_KEY configured), never "planned".
 *   - financial_service_composition, runtime_activation: no implementation
 *     exists anywhere in this codebase as a Factor-bound capability ->
 *     planned. Do not wire fake handlers for these.
 *   - constitutional_financial_agent_establishment ("Use Case Zero", added
 *     2026-09-06): a first-class capability composing EXISTING canonical
 *     services (case, authority-chain, wallet, Horizen, Aegis, MoneyPenny
 *     admission, Bankr, Vela) into one read-only readiness projection and a
 *     set of orchestration handlers -> partial. Never a second Journey
 *     state machine, service catalog, wallet model, approval system or
 *     receipt system — see services/factor/useCaseZeroReadinessProjection.ts.
 *   - general_orientation: this manifest + the classification/response path
 *     itself -> operational.
 */

import { isRegisteredFactorActionHandlerId } from "@/services/factor/factorActionHandlerRegistry";

export type FactorCapabilityStatus = "operational" | "partial" | "advisory" | "planned";

export type FactorInteractionMode = "explain" | "assess-readiness" | "prepare" | "act";

/**
 * How a capability is actually invoked, independent of its declared
 * `status` (capability-runtime contract closure, 2026-09-05 — a status of
 * "operational" was previously enough, on its own, to render as
 * ACTION_AVAILABLE; that let a capability with no real handler be
 * advertised as actionable). Never derive actionability from `status`
 * alone — always cross-check `handlerKind`:
 *   - "api": a real, externally-reachable REST route performs the action.
 *   - "service": a real internal service function performs it, but it is
 *     reachable only from server-side code today (no REST route, no UI
 *     control) — a real capability with no external invocation path yet.
 *   - "navigation": the "handler" is a host-local UI action (e.g. a panel
 *     navigating to another panel) — real and working inside MoneyPenny,
 *     but never externally invocable and never advertised as such.
 *   - "none": no backing implementation exists at all.
 */
export type FactorHandlerKind = "api" | "service" | "navigation" | "none";

/** Bounded workflow scope that may ground (never select) a capability
 *  consultation — see resolveFactorCapability's own contract. */
export interface FactorScope {
  caseId?: string;
  agentRef?: string;
  serviceRef?: string;
}

export type FactorAffordance = "ADVISORY" | "PREPARABLE" | "ACTION_AVAILABLE" | "BLOCKED" | "PLANNED";

/**
 * Typed action shape (Factor runtime-contract closure, Phase 1 continuation,
 * 2026-09-05) — replaces `availableActions: string[]` (a label with nothing
 * a client could act on beyond re-submitting it as text). A capability may
 * offer several actions at different consequence levels; approval is a
 * property of the ACTION, not the capability — explaining Bankr needs no
 * approval, but preparing a launch proposal or submitting one does.
 */
export type FactorActionMode = "explain" | "prepare" | "execute" | "navigate";

/** Where this action's handler actually runs — never asserted from the label alone. */
export type FactorActionExposure = "internal" | "moneypenny" | "external";

export interface FactorActionDescriptor {
  /** Stable id, `${capabilityId}:${verb}` — unique across the whole manifest. */
  id: string;
  label: string;
  mode: FactorActionMode;
  /** MUST resolve in services/factor/factorActionHandlerRegistry.ts — a
   *  manifest entry may never reference an unregistered handler
   *  (tests/factor-action-handler-registry.test.ts enforces this). */
  handlerId: string;
  exposure: FactorActionExposure;
  /** Action-level approval policy — never inherited from the capability. */
  requiresApproval: boolean;
  requiredScope?: Array<keyof FactorScope>;
  requiredAuthority?: string[];
  /**
   * A real, documented HTTP invocation contract for this action — present
   * ONLY when a caller genuinely outside this codebase's process (a
   * delegating agent, not a browser session) can invoke it. Absent means
   * "reachable at `handler`, but no invocation contract is documented for
   * an external caller" — never invented for an action that doesn't have
   * one (capability-runtime contract closure, 2026-09-06).
   */
  invocation?: {
    httpMethod: 'GET' | 'POST';
    path: string;
    authRequirement: string[];
  };
}

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
  | "runtime_activation"
  | "constitutional_financial_agent_establishment";

export interface FactorCapability {
  id: FactorCapabilityId;
  title: string;
  description: string;
  status: FactorCapabilityStatus;
  interactionModes: FactorInteractionMode[];
  /** File path of the real handler backing this capability, when one exists. */
  handler?: string;
  /** What KIND of handler `handler` is — see FactorHandlerKind. Drives
   *  affordance derivation and Agent Card actionability, never `status` alone. */
  handlerKind: FactorHandlerKind;
  /** Whether invoking this capability's real action is consequential enough
   *  to require human/MoneyPenny approval — a static policy fact, never
   *  something a live LLM response may override (see
   *  deriveFactorResponseEnvelope). */
  requiresApproval: boolean;
  /** Scope fields that MUST be bound before this capability's real action
   *  can run (e.g. an existing case). Server-checked in
   *  deriveFactorResponseEnvelope; absent/empty means no scope is required. */
  requiredScope?: Array<keyof FactorScope>;
  requiredAuthority?: string[];
  /** Example questions/prompts this capability answers — used to seed the classifier and workstream copy. */
  examples: string[];
  /** Immutable constraints Factor must state truthfully when this capability comes up. */
  boundaries: string[];
  /**
   * Typed, allowlisted actions this capability actually offers — every
   * capability carries at least an `explain` action (never gated, never
   * needs approval). Capabilities with a real handler add `prepare`/
   * `execute`/`navigate` actions; PLANNED/ADVISORY capabilities carry only
   * `explain` — adding a non-explain action here is itself a status change
   * and must be accompanied by real `status`/`handlerKind` truthfulness
   * (never a way to sneak a capability live without updating both).
   */
  actions: FactorActionDescriptor[];
}

/** Every capability's baseline — explaining never needs a handler, approval,
 *  or bound scope. Composed into each capability's `actions` array rather
 *  than hand-repeated per entry. */
function explainAction(capabilityId: FactorCapabilityId, label: string): FactorActionDescriptor {
  return {
    id: `${capabilityId}:explain`,
    label,
    mode: "explain",
    handlerId: "factor:explain",
    exposure: "internal",
    requiresApproval: false,
  };
}

export const FACTOR_CAPABILITIES: FactorCapability[] = [
  {
    id: "general_orientation",
    title: "General orientation & capability discovery",
    description:
      "Explains what Aigent Factor is, what it can and cannot do today, and routes the operator to the right capability.",
    status: "operational",
    interactionModes: ["explain"],
    handlerKind: "service",
    requiresApproval: false,
    examples: ["What are your capabilities?", "Explain Aigent Factor's role in MoneyPenny", "What can you help me with?"],
    boundaries: [
      "Factor is MoneyPenny's constitutional economic activation and ecosystem-catalysis specialist — candidate intake is one capability among many, not its governing identity.",
      "Never claims a planned capability is live.",
    ],
    actions: [explainAction("general_orientation", "Explain Factor's capabilities")],
  },
  {
    id: "agent_service_discovery",
    title: "Agent and service discovery",
    description:
      "Helps the operator understand what agents and MoneyPenny Financial Services exist and how they relate — advisory orientation only; the actual registry/service lookups live in the iQube Registry and MoneyPenny's own service catalog, not in a Factor-owned handler.",
    status: "advisory",
    interactionModes: ["explain"],
    handlerKind: "none",
    requiresApproval: false,
    examples: ["What agents are already admitted?", "What financial services does MoneyPenny offer?"],
    boundaries: ["Factor does not itself query the registry or service catalog — it can only orient the operator toward those surfaces."],
    actions: [explainAction("agent_service_discovery", "Explain agent/service discovery")],
  },
  {
    id: "candidate_intake",
    title: "Candidate intake and evidence preparation",
    description:
      "Opens or resumes ONE case per candidate, walks the evidence checklist (capability declarations, endpoints, code provenance), and tracks the authority chain the case is worked under.",
    status: "operational",
    interactionModes: ["explain", "assess-readiness", "prepare", "act"],
    handler: "services/factor/factorCaseService.ts",
    handlerKind: "api",
    requiresApproval: true,
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
    actions: [
      explainAction("candidate_intake", "Explain candidate intake"),
      {
        id: "candidate_intake:prepare",
        label: "Open or resume a candidate case",
        mode: "prepare",
        handlerId: "factor:case-service",
        exposure: "moneypenny",
        requiresApproval: false,
      },
      {
        id: "candidate_intake:execute",
        label: "Transition a candidate case",
        mode: "execute",
        handlerId: "factor:case-service",
        exposure: "moneypenny",
        requiresApproval: true,
        requiredScope: ["caseId"],
        requiredAuthority: ["factor-case-authority"],
      },
    ],
  },
  {
    id: "horizen_journey_spine",
    title: "Registry and Horizen Journey Spine facilitation",
    description:
      "Explains how a candidate or admitted agent traverses the Horizen Journey Spine toward registration. Horizen registration binding resolution is real. Aigent Factor's OWN agent is itself Horizen-registered (ERC-8004 token 9176, Base Sepolia, operator-confirmed) — but this capability facilitates OTHER agents' journeys, and for a given candidate, registration may still be provisioned-and-pending rather than broadcast; status here always reflects the CANDIDATE being asked about, never Factor's own registration by default.",
    status: "partial",
    interactionModes: ["explain", "assess-readiness"],
    handler: "services/horizen/agentRegistrationBinding.ts",
    handlerKind: "service",
    requiresApproval: false,
    examples: ["Help this agent traverse the Horizen Journey Spine", "What is this agent's Horizen registration status?"],
    boundaries: ["Factor cannot broadcast or confirm an on-chain registration itself — it can only report and explain the current binding state for the candidate actually being discussed."],
    actions: [
      explainAction("horizen_journey_spine", "Explain the Horizen Journey Spine"),
      {
        id: "horizen_journey_spine:prepare",
        label: "Check Horizen registration binding status",
        mode: "prepare",
        handlerId: "factor:horizen-registration-binding",
        exposure: "internal",
        requiresApproval: false,
      },
    ],
  },
  {
    id: "identity_wallet_settlement",
    title: "Identity, wallet and settlement readiness",
    description:
      "Explains what identity and wallet readiness (FIO handle, owner wallet, X402 settlement wallet) an agent needs before it can transact — advisory only; Factor has no handler to provision a candidate's wallet or settlement identity.",
    status: "advisory",
    interactionModes: ["explain", "assess-readiness"],
    handlerKind: "none",
    requiresApproval: false,
    examples: ["Prepare an X402 settlement wallet for this agent", "What identity does this candidate need before admission?"],
    boundaries: ["Factor cannot provision or move funds in any wallet — identity/wallet provisioning is a separate, human/operator-driven step."],
    actions: [explainAction("identity_wallet_settlement", "Explain identity/wallet/settlement readiness")],
  },
  {
    id: "authority_chain",
    title: "Authority-chain and delegation preparation",
    description:
      "Establishes or revokes a direct or MoneyPenny-mediated authority chain for a case. Establish and revoke are real and reachable; the validation gate that would enforce a chain on every subsequent action exists but is not yet wired into the transition/admission routes.",
    status: "partial",
    interactionModes: ["explain", "assess-readiness", "prepare"],
    handler: "services/factor/authorityChain.ts",
    handlerKind: "api",
    requiresApproval: true,
    requiredAuthority: ["authority-chain-establish"],
    examples: ["Establish an authority chain for this case", "Is this candidate's authority chain still valid?"],
    boundaries: ["Factor never manufactures authority a real delegation_grants row does not already grant."],
    actions: [
      explainAction("authority_chain", "Explain authority chains"),
      {
        id: "authority_chain:prepare",
        label: "Establish an authority chain",
        mode: "prepare",
        handlerId: "factor:authority-chain",
        exposure: "moneypenny",
        requiresApproval: true,
        requiredScope: ["caseId"],
        requiredAuthority: ["authority-chain-establish"],
      },
    ],
  },
  {
    id: "financial_service_composition",
    title: "Financial-service discovery and composition",
    description:
      "Composing multiple MoneyPenny Financial Services into a single request for an agent — no implementation exists yet.",
    status: "planned",
    interactionModes: ["explain"],
    handlerKind: "none",
    requiresApproval: false,
    examples: ["Compose a financial-service bundle for this agent", "Can you set up recurring settlement for this agent?"],
    boundaries: ["No service-composition handler exists yet — Factor can only describe what this would look like when built."],
    actions: [explainAction("financial_service_composition", "Explain financial-service composition")],
  },
  {
    id: "pulse_pnl",
    title: "Pulse/P&L registration and performance evidence",
    description:
      "Standing proposals can cite Pulse/P&L evidence references, but there is no registration flow or live Pulse/P&L data source Factor itself reaches — advisory only.",
    status: "advisory",
    interactionModes: ["explain", "assess-readiness"],
    handlerKind: "none",
    requiresApproval: false,
    examples: ["Facilitate Pulse and P&L registration for this agent", "How does Pulse/P&L evidence factor into standing?"],
    boundaries: ["Factor cannot register an agent for Pulse/P&L reporting today — it can only explain how such evidence would be used in a standing proposal."],
    actions: [explainAction("pulse_pnl", "Explain Pulse/P&L evidence")],
  },
  {
    id: "standing_proposal",
    title: "Standing proposal and progression",
    description:
      "A real, evidence-gated service can create a standing proposal for an admitted agent (refuses outright with no veracity/contribution/risk-of-repair evidence), but no API route or panel control surfaces it yet.",
    status: "partial",
    interactionModes: ["explain", "assess-readiness", "prepare"],
    handler: "services/factor/standingProposal.ts",
    handlerKind: "service",
    requiresApproval: true,
    requiredAuthority: ["standing-proposal-evidence"],
    examples: ["How can this agent gain standing?", "Propose a standing event for this agent"],
    boundaries: [
      "Factor only ever PROPOSES a standing event — it never writes standing directly.",
      "A proposal with no veracity, contribution, or risk-of-repair evidence is refused outright.",
    ],
    actions: [
      explainAction("standing_proposal", "Explain standing proposals"),
      {
        id: "standing_proposal:prepare",
        label: "Propose a standing event",
        mode: "prepare",
        handlerId: "factor:standing-proposal",
        exposure: "internal",
        requiresApproval: true,
        requiredScope: ["agentRef"],
        requiredAuthority: ["standing-proposal-evidence"],
      },
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
    // A real, working action — but it is host-local UI navigation inside
    // MoneyPenny, never an externally-invocable API/service. The Agent Card
    // must never advertise this as remotely actionable (capability-runtime
    // contract closure, 2026-09-05, design point 3).
    handlerKind: "navigation",
    requiresApproval: false,
    requiredScope: ["caseId"],
    examples: ["Request an independent Aegis assessment", "Refer this candidate to Aegis"],
    boundaries: ["Factor cannot assess its own candidate — this referral is the only path to an assessment."],
    actions: [
      explainAction("aegis_referral", "Explain Aegis referral"),
      {
        id: "aegis_referral:navigate",
        label: "Refer this case to Aegis",
        mode: "navigate",
        handlerId: "factor:aegis-referral-navigation",
        exposure: "internal",
        requiresApproval: false,
        requiredScope: ["caseId"],
      },
    ],
  },
  {
    id: "vela_confidential_compute",
    title: "Vela confidential-compute preparation",
    description:
      "A real, tested Factor-bound workload exists (services/factor/factorConfidentialWorkload.ts: admission-packet policy evaluation, driving the actual ConfidentialProjectionProvider seam end to end — prepare -> submit -> observe -> evidence -> verify) and can be invoked today. It runs against Vela's deterministic test transport (services/vela/velaTestTransport.ts); this codebase configures no live/production Vela deployment (services/vela/velaConfig.ts only defines a 'local', no_attestation deployment), so every run is honestly reported as simulated/test-transport (attestationMode: NO_ATTESTATION_LOCAL) until an actual Vela SDK/TEE deployment exists to connect to.",
    status: "partial",
    interactionModes: ["explain", "assess-readiness", "prepare"],
    handler: "services/factor/factorConfidentialWorkload.ts",
    handlerKind: "service",
    requiresApproval: false,
    requiredAuthority: ["confidential-projection-request"],
    examples: ["Can Vela protect this workload?", "Prepare this agent for confidential compute", "Run the admission-packet confidential evaluation"],
    boundaries: [
      "Only the admission-packet policy evaluation workload is wired — this is not a general-purpose confidential-compute facility.",
      "Every run today is simulated/test-transport (Vela's deterministic test TEE) — no live Vela SDK/production TEE deployment is configured in this codebase; a run's attestationMode is always reported honestly, never asserted as live.",
      "Confidential inputs (readinessScore, policyThreshold) never leave the confidential environment in the clear — only commitments and the coarse verdict are persisted.",
    ],
    actions: [
      explainAction("vela_confidential_compute", "Explain Vela confidential compute"),
      {
        id: "vela_confidential_compute:prepare",
        label: "Run the admission-packet confidential policy evaluation",
        mode: "prepare",
        handlerId: "factor:vela-admission-projection",
        exposure: "internal",
        requiresApproval: false,
        requiredScope: ["caseId"],
        requiredAuthority: ["confidential-projection-request"],
      },
    ],
  },
  {
    id: "bankr_tokenization",
    title: "Bankr/tokenization readiness and governed execution",
    description:
      "Real, tested handlers now exist for issuer-readiness assessment, provider-wallet binding, launch preparation, deterministic preflight, Aegis referral, approval routing, deployment-status inspection and (honestly-limited) fee-claim inspection — see services/factor/bankrCapabilityHandlers.ts, reachable over real HTTP at app/api/moneypenny/factor/bankr/* (a separate, MoneyPenny-owned .../approve route is the sole path to 'approved' — Factor's own action dispatch never accepts an approve action). Submission itself now re-quotes and refuses on Bankr-terms drift (forcing reapproval) rather than trusting the approved snapshot, and enforces an optional authority-chain gate when one is bound to the launch. Submission still requires an explicit human/MoneyPenny approval (the launch-spec's exact hash) and, in this deployment, runs against Bankr's deterministic fake transport — no live BANKR_*_API_KEY is configured (Phase 0 finding, unchanged).",
    status: "partial",
    interactionModes: ["explain", "assess-readiness", "prepare", "act"],
    handler: "services/factor/bankrCapabilityHandlers.ts",
    handlerKind: "service",
    requiresApproval: true,
    requiredAuthority: ["bankr-token-launch-submit"],
    examples: ["Could this agent issue a fair-launch token through Bankr?", "Help this agent tokenize its service"],
    boundaries: [
      "Factor never invents token name, ticker, supply, utility, access rights, fee promises, valuation, launch date, metadata or vesting choices — every one of those is an explicit operator decision, never authored by Factor.",
      "Factor never calls Bankr's write API directly outside the governed token-launch domain service, never assesses its own proposal, never approves its own token, and never submits a launch without an approved exact-spec hash.",
      "For Factor's OWN token, the conflict is surfaced explicitly (see the 'Prepare a token for Aigent Factor' journey) — Aegis still independently assesses it and MoneyPenny/the human principal still approves it.",
      "No live Bankr credentials are configured for this deployment — every action runs against the deterministic fake transport until real BANKR_*_API_KEY values are set.",
    ],
    actions: [
      explainAction("bankr_tokenization", "Explain Bankr tokenization"),
      {
        id: "bankr_tokenization:assess_readiness",
        label: "Assess issuer readiness for tokenization",
        mode: "prepare",
        handlerId: "factor:bankr-readiness",
        exposure: "moneypenny",
        requiresApproval: false,
        requiredScope: ["agentRef"],
      },
      {
        id: "bankr_tokenization:inspect_binding",
        label: "Inspect provider-wallet binding readiness",
        mode: "prepare",
        handlerId: "factor:bankr-binding",
        exposure: "moneypenny",
        requiresApproval: false,
        requiredScope: ["agentRef"],
      },
      {
        id: "bankr_tokenization:prepare_launch",
        label: "Prepare a launch proposal",
        mode: "prepare",
        handlerId: "factor:bankr-prepare-launch",
        exposure: "moneypenny",
        requiresApproval: false,
        requiredScope: ["agentRef"],
      },
      {
        id: "bankr_tokenization:preflight",
        label: "Run deterministic preflight/simulation",
        mode: "prepare",
        handlerId: "factor:bankr-preflight",
        exposure: "moneypenny",
        requiresApproval: false,
      },
      {
        id: "bankr_tokenization:request_aegis",
        label: "Request an independent Aegis assessment",
        mode: "prepare",
        handlerId: "factor:bankr-request-aegis",
        exposure: "moneypenny",
        requiresApproval: false,
      },
      {
        id: "bankr_tokenization:request_approval",
        label: "Request MoneyPenny/human approval",
        mode: "prepare",
        handlerId: "factor:bankr-request-approval",
        exposure: "moneypenny",
        requiresApproval: false,
      },
      {
        id: "bankr_tokenization:submit",
        label: "Submit an approved launch to Bankr",
        mode: "execute",
        handlerId: "factor:bankr-submit",
        exposure: "external",
        requiresApproval: true,
        requiredAuthority: ["bankr-token-launch-submit"],
      },
      {
        id: "bankr_tokenization:inspect_status",
        label: "Inspect deployment status",
        mode: "prepare",
        handlerId: "factor:bankr-inspect-status",
        exposure: "moneypenny",
        requiresApproval: false,
      },
      {
        id: "bankr_tokenization:fee_claims",
        label: "Inspect fee claims",
        mode: "prepare",
        handlerId: "factor:bankr-fee-claims",
        exposure: "moneypenny",
        requiresApproval: false,
      },
    ],
  },
  {
    id: "runtime_activation",
    title: "Runtime activation and activity catalysis",
    description:
      "A case can be moved through 'activation_pending' -> 'active' as a state-machine bookkeeping transition, but no real runtime deployment or activity-catalysis handler is bound to that transition.",
    status: "planned",
    interactionModes: ["explain"],
    handlerKind: "none",
    requiresApproval: false,
    examples: ["Activate this agent's runtime", "Catalyze this agent's first activity"],
    boundaries: ["Marking a case 'active' is a state label only — Factor does not itself deploy or operate any runtime."],
    actions: [explainAction("runtime_activation", "Explain runtime activation")],
  },
  {
    id: "constitutional_financial_agent_establishment",
    title: "Constitutional financial-agent establishment (Use Case Zero)",
    description:
      "Guides an operator through establishing a constitutional financial-services agent. Both entry paths converge on ONE canonical readiness projection (services/factor/useCaseZeroReadinessProjection.ts) composed from EXISTING services — identity, wallet, Passport, delegation/authority chain, Horizen/ERC-8004 registration, Aegis assessment, MoneyPenny admission, Bankr/provider binding, Vela confidential-compute readiness, and runtime activation. Never a second Journey state machine, service catalog, wallet model, approval system or receipt system. UPDATE (2026-09-06): 'create_and_establish' now mints a real RootDID for a brand-new agent slug by reusing the EXISTING sponsorPolityAgent primitive (did:agent:root:<slug>, no cost, no blockchain broadcast) — the SAME primitive /api/agents/genesis already used; never a second, disagreeing minting scheme. This requires the operator's OWN citizen Passport to already be issued (the sponsoring act). REGISTRABLE_AGENTS remains a separate, fixed, code-level allowlist (moneypenny/nakamoto/kn0w1/factor) for Horizen-registrable RUNTIME agents (agent_keys custody wallet, health route) — a freshly-sponsored agent has a real constitutional identity (RootDID) but is not automatically Horizen-registrable; legs needing a runtime agent id (wallets, Horizen registration, Bankr binding) report that honestly rather than papering over it. Migrating agent registration (REGISTRABLE_AGENTS runtime elevation, including real on-chain FIO handle registration) onto sponsored agents is BACKLOGGED as a fast-follow, not yet implemented.",
    status: "partial",
    interactionModes: ["explain", "assess-readiness", "prepare", "act"],
    handler: "app/api/moneypenny/factor/use-case-zero/{readiness,advance}/route.ts",
    handlerKind: "api",
    requiresApproval: false,
    requiredAuthority: ["constitutional-agent-establishment-readiness"],
    examples: [
      "I want to set up a financial agent",
      "Help me create an agent with a wallet",
      "Bring my agent to MoneyPenny",
      "Establish a constitutional financial agent",
      "I need confidential financial transactions for my agent",
    ],
    boundaries: [
      "Factor never approves its own agent, assessment, admission or financial transaction — Aegis assesses, MoneyPenny admits, and only an accountable human/operator persona approves a consequential step.",
      "Completion is read from canonical state (case, wallet, registration, assessment, admission, binding, evidence records) — never inferred from conversational prose or from Factor's own case status alone.",
      "Every action reports honestly whether it ran in simulated/test-transport mode or live — never blends the two, never presents a simulated result as live.",
      "No token is issued, no transaction is broadcast, no funds move, and no production credentials are used by this capability.",
      "CORRECTION (2026-09-06, operator review): the two entry actions below are READ-ONLY readiness assessments (services/factor/useCaseZeroCapabilityHandlers.ts) — they choose a path and report canonical readiness; they do not themselves create, provision, or establish anything. The 'Advance one step' action (services/factor/useCaseZeroOrchestrator.ts) is the SEPARATE, real orchestrator that actually acts — one permitted step per call, never auto-chaining across a human/Aegis/MoneyPenny approval boundary. Reachable today via real HTTP routes (app/api/moneypenny/factor/use-case-zero/*) and the shared UseCaseZeroReadinessCapsule component, mounted in FactorPanel's 'use-case-zero' mode.",
      "UPDATE (2026-09-06): 'create_and_establish' DOES now create a wholly new agent identity for a slug outside REGISTRABLE_AGENTS — it mints a RootDID (did:agent:root:<slug>) via the existing sponsorPolityAgent primitive, gated on the operator's own citizen Passport already being issued. It never fabricates Horizen-registrable runtime status (agent_keys custody wallet, health route) for that agent — that remains REGISTRABLE_AGENTS' separate, fixed, code-level allowlist, and legs needing it report accordingly rather than silently.",
    ],
    actions: [
      explainAction("constitutional_financial_agent_establishment", "Explain constitutional financial-agent establishment"),
      {
        id: "constitutional_financial_agent_establishment:bring_own_agent",
        label: "Bring my own agent — assess readiness",
        mode: "prepare",
        handlerId: "factor:ucz-bring-own-agent",
        exposure: "moneypenny",
        requiresApproval: false,
        requiredAuthority: ["constitutional-agent-establishment-readiness"],
      },
      {
        id: "constitutional_financial_agent_establishment:create_and_establish",
        label: "Create and establish an agent — assess readiness (sponsors a new agent's RootDID genesis)",
        mode: "prepare",
        handlerId: "factor:ucz-create-and-establish",
        exposure: "moneypenny",
        requiresApproval: false,
        requiredAuthority: ["constitutional-agent-establishment-readiness"],
      },
      {
        id: "constitutional_financial_agent_establishment:advance",
        label: "Advance one step (resumable orchestrator)",
        mode: "execute",
        handlerId: "factor:ucz-advance",
        exposure: "moneypenny",
        requiresApproval: false,
        requiredAuthority: ["constitutional-agent-establishment-readiness"],
      },
      {
        // Scoped + implemented 2026-09-06: codexes/packs/agentiq/updates/
        // 2026-09-06_factor-agent-callable-execution-scope.md. The
        // delegatable run-to-completion contract — MoneyPenny (in-process,
        // via services/moneypenny/factorExecutionBridge.ts) or a genuinely
        // external caller (platform credential) can have Factor run Use
        // Case Zero end-to-end, rather than driving `advance` step-by-step
        // themselves. Factor remains the executing agent.
        id: "constitutional_financial_agent_establishment:execute",
        label: "Run to completion (delegatable — MoneyPenny or an external caller runs the whole task via Factor)",
        mode: "execute",
        handlerId: "factor:ucz-execute",
        exposure: "external",
        requiresApproval: false,
        requiredAuthority: ["constitutional-agent-establishment-readiness"],
        invocation: {
          httpMethod: "POST",
          path: "/api/moneypenny/factor/use-case-zero/execute",
          authRequirement: [
            "persona-session (getActivePersona)",
            "platform-credential (CRON_TRIGGER_TOKEN, with actorPersonaId in the body)",
          ],
        },
      },
    ],
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
  // Use Case Zero — MUST be checked before standing/pulse_pnl/horizen/
  // authority_chain/vela/bankr/identity_wallet_settlement's own looser
  // patterns below, since phrases like "confidential financial
  // transactions" or "set up a financial agent" would otherwise mismatch
  // into vela_confidential_compute/bankr_tokenization/
  // identity_wallet_settlement instead of the establishment flow itself.
  {
    id: "constitutional_financial_agent_establishment",
    pattern:
      /confidential financial transactions?|private financial operations?|set up a financial agent|create an agent with a wallet|bring my (own )?agent (to|into) moneypenny|establish a constitutional financial agent|constitutional financial[- ]services? agent|constitutional agent establishment/i,
  },
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

/**
 * The single, server-derived response envelope for a resolved Factor
 * capability (capability-runtime contract closure, 2026-09-05). A pure
 * function of (capabilityId, scope) — the SAME result for the deterministic
 * template path and a successful live-LLM response. The model may author
 * title/summary/recommendations; it may NEVER decide `affordance` or
 * `requiresApproval` — those are policy, not prose, and are always
 * recomputed here rather than trusted from an LLM's JSON.
 *
 * Deliberately NOT mechanical on `status` alone (the exact defect this
 * closes: a capability could be declared "operational" with no real
 * handler and still render ACTION_AVAILABLE). `handlerKind === "none"`
 * always caps the affordance at ADVISORY, regardless of what `status`
 * claims — the two are cross-checked, never just multiplied together.
 */
export interface FactorResponseEnvelope {
  resolvedCapabilityId: FactorCapabilityId;
  capabilityStatus: FactorCapabilityStatus;
  affordance: FactorAffordance;
  requiresApproval: boolean;
  /** Concrete next actions the operator could take now, TYPED (Factor
   *  runtime-contract closure, Phase 1 continuation) — never a bare label
   *  string. The `explain` action is always included regardless of
   *  affordance (explaining never needs approval or a bound scope); every
   *  other action is included only when the affordance is ACTION_AVAILABLE
   *  or PREPARABLE AND the action's own `requiredScope`/handler-registration
   *  are satisfied — an ADVISORY/PLANNED/BLOCKED response never offers a
   *  consequential action to click. */
  availableActions: FactorActionDescriptor[];
  /** Unmet prerequisites, when `affordance` is BLOCKED — empty otherwise. */
  blockers: string[];
}

function affordanceForStatusAndHandler(status: FactorCapabilityStatus, handlerKind: FactorHandlerKind): FactorAffordance {
  if (status === "planned") return "PLANNED";
  // No real handler caps the affordance at ADVISORY even if `status` says
  // otherwise — a data-entry error in `status` must never leak through as
  // a false "you can act on this now".
  if (handlerKind === "none") return "ADVISORY";
  if (status === "advisory") return "ADVISORY";
  if (status === "operational") return "ACTION_AVAILABLE";
  return "PREPARABLE"; // status === "partial"
}

/** True when this action's own prerequisites are satisfied against the
 *  supplied scope — never asserted true when a required key is unbound. */
function actionScopeSatisfied(action: FactorActionDescriptor, scope?: FactorScope): boolean {
  return (action.requiredScope ?? []).every((key) => Boolean(scope?.[key]));
}

/**
 * Every capability's `explain` action(s), always offered regardless of
 * affordance — explaining is never gated (Phase 1 requirement: "Explaining
 * Bankr does not need approval"). Non-explain actions are added only when
 * the capability's own affordance permits acting at all AND the action's
 * own handler is registered (an unregistered handlerId is a manifest defect,
 * never silently offered) AND its own requiredScope is bound.
 */
function resolveAvailableActions(cap: FactorCapability, affordance: FactorAffordance, scope?: FactorScope): FactorActionDescriptor[] {
  const explainActions = cap.actions.filter((a) => a.mode === "explain");
  if (affordance !== "ACTION_AVAILABLE" && affordance !== "PREPARABLE") return explainActions;
  const gated = cap.actions.filter(
    (a) => a.mode !== "explain" && isRegisteredFactorActionHandlerId(a.handlerId) && actionScopeSatisfied(a, scope),
  );
  return [...explainActions, ...gated];
}

export function deriveFactorResponseEnvelope(capabilityId: FactorCapabilityId, scope?: FactorScope): FactorResponseEnvelope {
  const cap = getFactorCapability(capabilityId);
  const missingScope = (cap.requiredScope ?? []).filter((key) => !scope?.[key]);

  if (missingScope.length > 0) {
    return {
      resolvedCapabilityId: capabilityId,
      capabilityStatus: cap.status,
      affordance: "BLOCKED",
      requiresApproval: cap.requiresApproval,
      availableActions: cap.actions.filter((a) => a.mode === "explain"),
      blockers: missingScope.map((key) => `Requires ${key} — this consultation has none bound yet.`),
    };
  }

  const affordance = affordanceForStatusAndHandler(cap.status, cap.handlerKind);
  return {
    resolvedCapabilityId: capabilityId,
    capabilityStatus: cap.status,
    affordance,
    requiresApproval: cap.requiresApproval,
    availableActions: resolveAvailableActions(cap, affordance, scope),
    blockers: [],
  };
}
