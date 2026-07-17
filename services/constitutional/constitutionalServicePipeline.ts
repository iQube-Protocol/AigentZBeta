/**
 * constitutionalServicePipeline — the canonical constitutional service pattern
 * (CRP-003a; PRD §10) as ONE composable seam. "The canonical Founder Office
 * execution model": every consequential capability runs through the same twelve
 * steps —
 *
 *   1 Intent → 2 Discovery → 3 Constitutional Agreement → 4 Standing Validation
 *   → 5 Policy Validation → 6 Bounded Delegation → 7 Execution → 8 Verification
 *   → 9 Settlement → 10 Evidence → 11 Standing Accrual → 12 Invariant Learning.
 *
 * Step 3 is the N1 gate (requireAuthorizedAgreement): the delegated call (step 7)
 * is REFUSED unless an authorized Constitutional Agreement binds the (operator,
 * capability, agent) triple.
 *
 * WIRED (N2b): step 4 reads real delegate standing; step 5 checks the agreement's
 * forbidden-action envelope; step 7 runs the invariant-grounded Domain-3
 * executor; step 8 verifies F-201/202/203; step 9 enforces the P3 spend cap when
 * settlement terms are present (money-moving domains); steps 11/12 cite the
 * governing + evidence invariants for real Reach accrual — but ONLY in
 * authoritative mode (shadow observes, never mutates, per CFS-017).
 *
 * OBSERVE-FIRST (CFS-017), two modes. `shadow` (default): gate refusal recorded
 * ('shadow-block'), no side effects, no accrual. `authoritative`: the gate (and
 * the P3 settlement cap) BLOCK. A shadow→authoritative flip is the later
 * operator-gated ratification.
 *
 * Dependency-injected so the control flow is node-testable without Supabase/LLM.
 * Domain 3 (Financial Intelligence, read-only) carries no settlement; money-
 * moving Domains 1/2 attach settlementTerms + a valueCeiling and hit step 9's
 * enforcement.
 */

import {
  requireAuthorizedAgreement,
  getAgreement,
  spendWithinCap,
  type AgreementGateResult,
  type DelegatedAuthority,
  type SettlementTerms,
} from '@/services/constitutional/constitutionalAgreement';
import {
  runFinancialIntelligence,
  verifyFinancialIntelligence,
  type FinancialIntelligenceRequest,
  type FinancialIntelligenceResult,
  type VerificationResult,
} from '@/services/constitutional/financialIntelligenceExecutor';

export type ServicePipelineMode = 'shadow' | 'authoritative';
export type StepStatus = 'ok' | 'skipped' | 'refused' | 'shadow-block' | 'observed';

export interface StepTrace {
  step: number;
  name: string;
  status: StepStatus;
  detail: string;
}

export interface ServicePipelineInput {
  intent: string;
  capabilityRef: string;
  selectedAgentRef: string;
  requestingPersonaId: string;
  mode?: ServicePipelineMode;
}

export interface ServicePipelineResult {
  ok: boolean;
  mode: ServicePipelineMode;
  executed: boolean;
  blockedAtStep: number | null;
  gate: AgreementGateResult;
  agreementId: string | null;
  execution: FinancialIntelligenceResult | null;
  verification: VerificationResult | null;
  trace: StepTrace[];
}

/** The authority summary the pipeline reads off an authorized agreement. */
export interface AuthoritySummary {
  band: string;
  governingInvariants: string[];
  forbiddenActions: string[];
  valueCeiling: number | null;
  settlementTerms: SettlementTerms | null;
}

/** I/O steps, injectable for testing. Defaults wire the real subsystems. */
export interface ServicePipelineDeps {
  gateCheck: (input: {
    capabilityRef: string;
    selectedAgentRef: string;
    requestingPersonaId: string;
  }) => Promise<AgreementGateResult>;
  loadAuthority: (agreementId: string) => Promise<AuthoritySummary | null>;
  execute: (req: FinancialIntelligenceRequest) => Promise<FinancialIntelligenceResult>;
  verify: (result: FinancialIntelligenceResult) => VerificationResult;
  checkStanding: (agentRef: string) => Promise<{ overall: number; trustBandCeiling: string } | null>;
  cite: (invariantIds: string[]) => Promise<void>;
}

/** The action the Domain-3 executor performs — checked against the envelope. */
const EXECUTOR_ACTION = 'knowledge_retrieval';

export function defaultServicePipelineDeps(): ServicePipelineDeps {
  return {
    gateCheck: requireAuthorizedAgreement,
    loadAuthority: async (agreementId) => {
      const row = await getAgreement(agreementId);
      if (!row) return null;
      const da = row.object.payload.delegatedAuthority;
      const st = row.object.payload.settlementTerms as SettlementTerms | null;
      return {
        band: da.band,
        governingInvariants: row.object.authority.governingInvariants,
        forbiddenActions: da.forbiddenActions ?? [],
        valueCeiling: da.valueCeiling ?? null,
        settlementTerms: st ?? null,
      };
    },
    // Grounded Domain-3 executor — wire the engine's Reasoning face as the
    // grounding fn (dynamic import avoids a load-order cycle).
    execute: (req) =>
      runFinancialIntelligence(req, async (namespaces, limit) => {
        const { groundReasoning } = await import('@/services/invariants/engine');
        const snap = await groundReasoning({ namespaces, limit });
        return snap.slice.items.map((i) => ({ id: i.id, statement: i.statement }));
      }),
    verify: verifyFinancialIntelligence,
    checkStanding: async (agentRef) => {
      const { readDelegateStanding } = await import('@/services/homecoming/delegateStanding');
      const s = await readDelegateStanding(agentRef);
      return s ? { overall: s.overall, trustBandCeiling: s.trustBandCeiling } : null;
    },
    cite: async (ids) => {
      const { citeInvariants } = await import('@/services/invariants/grounding');
      await citeInvariants(ids);
    },
  };
}

export async function runConstitutionalServicePattern(
  input: ServicePipelineInput,
  deps: ServicePipelineDeps = defaultServicePipelineDeps(),
): Promise<ServicePipelineResult> {
  const mode: ServicePipelineMode = input.mode ?? 'shadow';
  const trace: StepTrace[] = [];
  const push = (step: number, name: string, status: StepStatus, detail: string) =>
    trace.push({ step, name, status, detail });
  const done = (r: Omit<ServicePipelineResult, 'mode' | 'trace'>): ServicePipelineResult => ({ ...r, mode, trace });

  // 1 Intent · 2 Discovery
  push(1, 'Intent', 'ok', input.intent.trim().slice(0, 200));
  push(2, 'Discovery', 'ok', `capability=${input.capabilityRef} agent=${input.selectedAgentRef}`);

  // 3 Constitutional Agreement — the N1 gate
  const gate = await deps.gateCheck({
    capabilityRef: input.capabilityRef,
    selectedAgentRef: input.selectedAgentRef,
    requestingPersonaId: input.requestingPersonaId,
  });
  const agreementId = gate.ok ? gate.agreementId : null;
  if (gate.ok) {
    push(3, 'Constitutional Agreement', 'ok', `authorized agr=${gate.agreementId} (status ${gate.status})`);
  } else if (mode === 'authoritative') {
    push(3, 'Constitutional Agreement', 'refused', `409: ${gate.reason}`);
    return done({ ok: false, executed: false, blockedAtStep: 3, gate, agreementId, execution: null, verification: null });
  } else {
    push(3, 'Constitutional Agreement', 'shadow-block', `WOULD refuse 409: ${gate.reason} — shadow continues, delegated call not made`);
  }

  const gateOpen = gate.ok;
  let authority: AuthoritySummary | null = null;
  if (gateOpen) authority = await deps.loadAuthority(gate.agreementId);
  const band = authority?.band ?? 'unknown';
  const governingInvariants = authority?.governingInvariants ?? [];

  // 4 Standing Validation — real delegate standing (informational; the agreement is the authority)
  if (gateOpen) {
    const st = await deps.checkStanding(input.selectedAgentRef);
    push(4, 'Standing Validation', st ? 'ok' : 'observed', st ? `delegate standing ${st.overall} · ceiling ${st.trustBandCeiling} · agreement band ${band}` : `no standing record for ${input.selectedAgentRef} — agreement band ${band} governs`);
  } else {
    push(4, 'Standing Validation', 'skipped', 'no agreement');
  }

  // 5 Policy Validation — the requested action must not be in the forbidden envelope
  if (gateOpen) {
    const forbidden = authority?.forbiddenActions ?? [];
    const blocked = forbidden.includes(EXECUTOR_ACTION);
    if (blocked && mode === 'authoritative') {
      push(5, 'Policy Validation', 'refused', `action '${EXECUTOR_ACTION}' is in the agreement's forbidden envelope`);
      return done({ ok: false, executed: false, blockedAtStep: 5, gate, agreementId, execution: null, verification: null });
    }
    push(5, 'Policy Validation', blocked ? 'shadow-block' : 'ok', blocked ? `WOULD refuse: '${EXECUTOR_ACTION}' forbidden` : `'${EXECUTOR_ACTION}' permitted by the envelope`);
  } else {
    push(5, 'Policy Validation', 'skipped', 'no agreement');
  }

  // 6 Bounded Delegation
  push(6, 'Bounded Delegation', gateOpen ? 'ok' : 'skipped', gateOpen ? `authority band ${band}${authority?.valueCeiling != null ? ` · spend ceiling ${authority.valueCeiling}` : ' · no spend ceiling (read-only)'}` : 'no agreement');

  // 7 Execution — the delegated call, GATED by step 3
  let execution: FinancialIntelligenceResult | null = null;
  let verification: VerificationResult | null = null;
  if (gateOpen) {
    execution = await deps.execute({ intent: input.intent, governingInvariants });
    push(7, 'Execution', 'ok', execution.live ? `grounded in ${execution.evidenceRefs.length} invariant(s)` : 'un-grounded (no evidence retrieved)');
    verification = deps.verify(execution);
    push(8, 'Verification', verification.passed ? 'ok' : 'observed', `${verification.requirements.filter((r) => r.passed).length}/${verification.requirements.length} requirements passed`);
  } else {
    push(7, 'Execution', mode === 'shadow' ? 'shadow-block' : 'skipped', 'no authorized agreement — delegated call not made');
    push(8, 'Verification', 'skipped', 'no execution to verify');
  }

  // 9 Settlement — P3 spend-cap enforcement when settlement terms are present.
  //    Domain 3 (read-only) has no settlementTerms → skipped.
  if (gateOpen && authority?.settlementTerms) {
    const terms = authority.settlementTerms;
    const cap = spendWithinCap({ valueCeiling: authority.valueCeiling } as DelegatedAuthority, terms.amount);
    if (!cap.ok) {
      if (mode === 'authoritative') {
        push(9, 'Settlement', 'refused', `P3 spend cap: ${cap.reason}`);
        return done({ ok: false, executed: true, blockedAtStep: 9, gate, agreementId, execution, verification });
      }
      push(9, 'Settlement', 'shadow-block', `WOULD refuse (P3): ${cap.reason}`);
    } else {
      push(9, 'Settlement', 'observed', `within cap: ${terms.amount} ${terms.currency} via ${terms.rail} (≤ ${authority.valueCeiling}); rail execution is a follow-on`);
    }
  } else {
    push(9, 'Settlement', 'skipped', 'no settlement terms (Domain 3 read-only)');
  }

  // 10 Evidence — shadow observes (no consequential receipt); authoritative would emit one
  push(10, 'Evidence', mode === 'shadow' ? 'observed' : 'ok', mode === 'shadow' ? 'shadow trace only (CFS-017 observe-first — no consequential receipt)' : 'execution trace recorded');

  // 11 Standing Accrual · 12 Invariant Learning — REAL Reach accrual, authoritative only
  if (gateOpen && mode === 'authoritative') {
    const ids = [...new Set([...governingInvariants, ...(execution?.evidenceRefs ?? [])])];
    try {
      await deps.cite(ids);
      push(11, 'Standing Accrual', 'ok', `Reach accrued to ${ids.length} invariant(s) (Law XII — Reach only)`);
    } catch {
      push(11, 'Standing Accrual', 'observed', 'citation accrual failed (best-effort)');
    }
    push(12, 'Invariant Learning', 'ok', ids.join(', ') || 'no invariants to cite');
  } else if (gateOpen) {
    const ids = [...new Set([...governingInvariants, ...(execution?.evidenceRefs ?? [])])];
    push(11, 'Standing Accrual', 'observed', `WOULD accrue Reach to ${ids.length} invariant(s) (shadow does not mutate)`);
    push(12, 'Invariant Learning', 'observed', ids.join(', ') || 'no invariants');
  } else {
    push(11, 'Standing Accrual', 'skipped', 'no execution');
    push(12, 'Invariant Learning', 'skipped', 'no execution');
  }

  return done({ ok: true, executed: gateOpen, blockedAtStep: null, gate, agreementId, execution, verification });
}
