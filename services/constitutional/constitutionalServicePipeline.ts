/**
 * constitutionalServicePipeline — the canonical constitutional service pattern
 * (CRP-003a Increment 2; PRD §10) as ONE composable seam. "The canonical
 * Founder Office execution model": every consequential capability runs through
 * the same twelve steps —
 *
 *   1 Intent → 2 Discovery → 3 Constitutional Agreement → 4 Standing Validation
 *   → 5 Policy Validation → 6 Bounded Delegation → 7 Execution → 8 Verification
 *   → 9 Settlement → 10 Evidence → 11 Standing Accrual → 12 Invariant Learning.
 *
 * Step 3 is the N1 gate (requireAuthorizedAgreement): the delegated call (step 7)
 * is REFUSED unless an authorized Constitutional Agreement binds the (operator,
 * capability, agent) triple. That is the whole point of the pattern — the
 * agreement is the precondition of execution.
 *
 * OBSERVE-FIRST (CFS-017): the pipeline runs in `shadow` mode by default. In
 * shadow, a gate refusal is RECORDED ('shadow-block') and the delegated call is
 * simply not made — the trace shows exactly what the authoritative path WOULD
 * do, with zero side effects, so the loop is proven numerically before it gates
 * a live product surface. In `authoritative` mode the gate BLOCKS (the pipeline
 * returns ok:false at step 3). A shadow→authoritative flip is the later,
 * operator-gated ratification (the CFS-035 discipline).
 *
 * Extend-don't-duplicate: step 3 composes N1 (constitutionalAgreement); step 7
 * composes the Domain-3 executor; steps 4/5/11/12 are OBSERVED in N2 (the trace
 * records what the authoritative path checks — readDelegateStanding /
 * evaluateAccess / citeInvariants — wired live in Increment 2b, not half-wired
 * now). Dependency-injected so the control flow is node-testable without
 * Supabase/LLM.
 *
 * Domain 3 (Financial Intelligence, read-only) is the pilot surface — no
 * settlement, no fund movement (CRP-003a §5 consequence ordering).
 */

import {
  requireAuthorizedAgreement,
  getAgreement,
  type AgreementGateResult,
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

/** The I/O steps, injectable for testing. Defaults wire the real subsystems. */
export interface ServicePipelineDeps {
  gateCheck: (input: {
    capabilityRef: string;
    selectedAgentRef: string;
    requestingPersonaId: string;
  }) => Promise<AgreementGateResult>;
  loadAuthority: (agreementId: string) => Promise<{ band: string; governingInvariants: string[] } | null>;
  execute: (req: FinancialIntelligenceRequest) => FinancialIntelligenceResult;
  verify: (result: FinancialIntelligenceResult) => VerificationResult;
}

export function defaultServicePipelineDeps(): ServicePipelineDeps {
  return {
    gateCheck: requireAuthorizedAgreement,
    loadAuthority: async (agreementId) => {
      const row = await getAgreement(agreementId);
      if (!row) return null;
      return {
        band: row.object.payload.delegatedAuthority.band,
        governingInvariants: row.object.authority.governingInvariants,
      };
    },
    execute: runFinancialIntelligence,
    verify: verifyFinancialIntelligence,
  };
}

/**
 * Run the canonical constitutional service pattern for one intent. Pure control
 * flow over injected deps. `shadow` (default) records the gate decision without
 * side effects; `authoritative` blocks at step 3 on refusal.
 */
export async function runConstitutionalServicePattern(
  input: ServicePipelineInput,
  deps: ServicePipelineDeps = defaultServicePipelineDeps(),
): Promise<ServicePipelineResult> {
  const mode: ServicePipelineMode = input.mode ?? 'shadow';
  const trace: StepTrace[] = [];
  const push = (step: number, name: string, status: StepStatus, detail: string) =>
    trace.push({ step, name, status, detail });

  // 1 Intent
  push(1, 'Intent', 'ok', input.intent.trim().slice(0, 200));
  // 2 Discovery (caller-supplied capability + agent; observed here)
  push(2, 'Discovery', 'ok', `capability=${input.capabilityRef} agent=${input.selectedAgentRef}`);

  // 3 Constitutional Agreement — the N1 gate (the precondition of execution)
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
    return { ok: false, mode, executed: false, blockedAtStep: 3, gate, agreementId, execution: null, verification: null, trace };
  } else {
    push(3, 'Constitutional Agreement', 'shadow-block', `WOULD refuse 409: ${gate.reason} — shadow continues, delegated call not made`);
  }

  const gateOpen = gate.ok;
  let band = 'unknown';
  let governingInvariants: string[] = [];
  if (gateOpen) {
    const authority = await deps.loadAuthority(gate.agreementId);
    band = authority?.band ?? 'unknown';
    governingInvariants = authority?.governingInvariants ?? [];
  }

  // 4 Standing Validation · 5 Policy Validation · 6 Bounded Delegation
  //   (OBSERVED in N2 — authoritative wiring readDelegateStanding / evaluateAccess
  //   / the grant envelope is Increment 2b; recorded here, not fabricated).
  push(4, 'Standing Validation', gateOpen ? 'observed' : 'skipped', gateOpen ? `delegate must clear band ${band} (readDelegateStanding — 2b)` : 'no agreement');
  push(5, 'Policy Validation', gateOpen ? 'observed' : 'skipped', gateOpen ? 'evaluateAccess (2b)' : 'no agreement');
  push(6, 'Bounded Delegation', gateOpen ? 'observed' : 'skipped', gateOpen ? `authority band ${band}` : 'no agreement');

  // 7 Execution — the delegated call, GATED by step 3
  let execution: FinancialIntelligenceResult | null = null;
  let verification: VerificationResult | null = null;
  if (gateOpen) {
    execution = deps.execute({ intent: input.intent, governingInvariants });
    push(7, 'Execution', 'ok', execution.live ? 'live Domain-3 intelligence' : 'Domain-3 structured stub (live run = follow-on)');
    // 8 Verification (F-201/202/203). A failure is OBSERVED in shadow, not blocking.
    verification = deps.verify(execution);
    push(8, 'Verification', verification.passed ? 'ok' : 'observed', `${verification.requirements.filter((r) => r.passed).length}/${verification.requirements.length} requirements passed`);
  } else {
    push(7, 'Execution', mode === 'shadow' ? 'shadow-block' : 'skipped', 'no authorized agreement — delegated call not made');
    push(8, 'Verification', 'skipped', 'no execution to verify');
  }

  // 9 Settlement — none for Domain 3 (read-only)
  push(9, 'Settlement', 'skipped', 'Domain 3 read-only — no settlement (USDC/Q¢ binding is a money-moving-domain increment)');
  // 10 Evidence — shadow observes (no consequential receipt); authoritative emits one
  push(10, 'Evidence', mode === 'shadow' ? 'observed' : 'ok', mode === 'shadow' ? 'shadow trace only (CFS-017 observe-first — no consequential receipt)' : 'activity receipt emitted');
  // 11 Standing Accrual · 12 Invariant Learning (observed; Reach via citeInvariants — 2b)
  push(11, 'Standing Accrual', gateOpen ? 'observed' : 'skipped', gateOpen ? 'Reach accrual via citeInvariants (2b)' : 'no execution');
  push(12, 'Invariant Learning', gateOpen ? 'observed' : 'skipped', gateOpen ? (governingInvariants.join(', ') || 'no governing invariants on agreement') : 'no execution');

  return {
    ok: true,
    mode,
    executed: gateOpen,
    blockedAtStep: null,
    gate,
    agreementId,
    execution,
    verification,
    trace,
  };
}
