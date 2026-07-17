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
 * Step 3 is the N1 gate: the delegated call (step 7) is REFUSED without an
 * authorized agreement. Step 7 runs the domain executor (intelligence /
 * investment / market), grounded + optionally LLM-analysed. Step 9 enforces the
 * P3 spend cap and, when it passes, binds a settlement INTENT (money-moving
 * Domains 1/2) — never an autonomous transfer. Steps 11/12 cite for real Reach
 * accrual (authoritative only; shadow observes, never mutates — CFS-017).
 *
 * Two modes: `shadow` (default) records decisions with no side effects;
 * `authoritative` enforces the gate + policy + spend cap (blocks) and performs
 * accrual + settlement-intent binding. Dependency-injected — node-testable
 * without Supabase/LLM.
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
  runFinancialCapability,
  verifyFinancialCapability,
  type FinancialDomain,
  type FinancialIntelligenceRequest,
  type FinancialIntelligenceResult,
  type IntelligenceConfidence,
  type VerificationResult,
} from '@/services/constitutional/financialIntelligenceExecutor';
import { buildSettlementIntent, type SettlementResult } from '@/services/constitutional/settlementExecutor';

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
  domain?: FinancialDomain;
  mode?: ServicePipelineMode;
}

export interface ServicePipelineResult {
  ok: boolean;
  mode: ServicePipelineMode;
  domain: FinancialDomain;
  executed: boolean;
  blockedAtStep: number | null;
  gate: AgreementGateResult;
  agreementId: string | null;
  execution: FinancialIntelligenceResult | null;
  verification: VerificationResult | null;
  settlement: SettlementResult | null;
  trace: StepTrace[];
}

export interface AuthoritySummary {
  band: string;
  governingInvariants: string[];
  forbiddenActions: string[];
  valueCeiling: number | null;
  settlementTerms: SettlementTerms | null;
}

export interface ServicePipelineDeps {
  gateCheck: (input: { capabilityRef: string; selectedAgentRef: string; requestingPersonaId: string }) => Promise<AgreementGateResult>;
  loadAuthority: (agreementId: string) => Promise<AuthoritySummary | null>;
  execute: (domain: FinancialDomain, req: FinancialIntelligenceRequest) => Promise<FinancialIntelligenceResult>;
  verify: (domain: FinancialDomain, result: FinancialIntelligenceResult) => VerificationResult;
  checkStanding: (agentRef: string) => Promise<{ overall: number; trustBandCeiling: string } | null>;
  cite: (invariantIds: string[]) => Promise<void>;
  settle: (terms: SettlementTerms, agreementRef: string) => Promise<SettlementResult>;
}

const EXECUTOR_ACTION = 'knowledge_retrieval';

export function defaultServicePipelineDeps(): ServicePipelineDeps {
  const groundFn = async (namespaces: string[], limit: number) => {
    const { groundReasoning } = await import('@/services/invariants/engine');
    const snap = await groundReasoning({ namespaces, limit });
    return snap.slice.items.map((i) => ({ id: i.id, statement: i.statement }));
  };
  // LLM analysis over the grounded evidence (callSovereign — invariant-governed,
  // sovereign-fallback ladder). Reasons ONLY from the supplied evidence.
  const analyzeFn = async (intent: string, evidence: { id: string; statement: string }[], domain: FinancialDomain) => {
    const { callSovereign } = await import('@/services/constitutional/modelRouter');
    const system =
      `You are a constitutional ${domain} analyst. Reason ONLY from the invariant evidence provided; ` +
      `do not invent facts. Be concise (≤6 sentences). End with a line "confidence: low|medium|high".`;
    const user =
      `Intent: ${intent}\n\nInvariant evidence:\n` +
      evidence.map((e) => `- [${e.id}] ${e.statement}`).join('\n') +
      `\n\nProvide a short, evidence-grounded ${domain} brief.`;
    const r = await callSovereign('analysis', system, user, 500, 0);
    const text = (r.text ?? '').trim();
    if (!text) return null;
    const m = /confidence:\s*(high|medium|low)/i.exec(text);
    const confidence = (m?.[1]?.toLowerCase() as IntelligenceConfidence | undefined) ?? 'medium';
    return { summary: text, confidence };
  };
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
    execute: (domain, req) => runFinancialCapability(domain, req, groundFn, analyzeFn),
    verify: (domain, result) => verifyFinancialCapability(domain, result),
    checkStanding: async (agentRef) => {
      const { readDelegateStanding } = await import('@/services/homecoming/delegateStanding');
      const s = await readDelegateStanding(agentRef);
      return s ? { overall: s.overall, trustBandCeiling: s.trustBandCeiling } : null;
    },
    cite: async (ids) => {
      const { citeInvariants } = await import('@/services/invariants/grounding');
      await citeInvariants(ids);
    },
    settle: async (terms, agreementRef) => buildSettlementIntent(terms, agreementRef),
  };
}

export async function runConstitutionalServicePattern(
  input: ServicePipelineInput,
  deps: ServicePipelineDeps = defaultServicePipelineDeps(),
): Promise<ServicePipelineResult> {
  const mode: ServicePipelineMode = input.mode ?? 'shadow';
  const domain: FinancialDomain = input.domain ?? 'intelligence';
  const trace: StepTrace[] = [];
  const push = (step: number, name: string, status: StepStatus, detail: string) => trace.push({ step, name, status, detail });
  const done = (r: Omit<ServicePipelineResult, 'mode' | 'domain' | 'trace'>): ServicePipelineResult => ({ ...r, mode, domain, trace });

  push(1, 'Intent', 'ok', `[${domain}] ${input.intent.trim().slice(0, 180)}`);
  push(2, 'Discovery', 'ok', `capability=${input.capabilityRef} agent=${input.selectedAgentRef}`);

  const gate = await deps.gateCheck({ capabilityRef: input.capabilityRef, selectedAgentRef: input.selectedAgentRef, requestingPersonaId: input.requestingPersonaId });
  const agreementId = gate.ok ? gate.agreementId : null;
  if (gate.ok) {
    push(3, 'Constitutional Agreement', 'ok', `authorized agr=${gate.agreementId} (status ${gate.status})`);
  } else if (mode === 'authoritative') {
    push(3, 'Constitutional Agreement', 'refused', `409: ${gate.reason}`);
    return done({ ok: false, executed: false, blockedAtStep: 3, gate, agreementId, execution: null, verification: null, settlement: null });
  } else {
    push(3, 'Constitutional Agreement', 'shadow-block', `WOULD refuse 409: ${gate.reason} — shadow continues, delegated call not made`);
  }

  const gateOpen = gate.ok;
  let authority: AuthoritySummary | null = null;
  if (gateOpen) authority = await deps.loadAuthority(gate.agreementId);
  const band = authority?.band ?? 'unknown';
  const governingInvariants = authority?.governingInvariants ?? [];

  if (gateOpen) {
    const st = await deps.checkStanding(input.selectedAgentRef);
    push(4, 'Standing Validation', st ? 'ok' : 'observed', st ? `delegate standing ${st.overall} · ceiling ${st.trustBandCeiling} · agreement band ${band}` : `no standing record — agreement band ${band} governs`);
  } else {
    push(4, 'Standing Validation', 'skipped', 'no agreement');
  }

  if (gateOpen) {
    const forbidden = authority?.forbiddenActions ?? [];
    const blocked = forbidden.includes(EXECUTOR_ACTION);
    if (blocked && mode === 'authoritative') {
      push(5, 'Policy Validation', 'refused', `action '${EXECUTOR_ACTION}' is in the agreement's forbidden envelope`);
      return done({ ok: false, executed: false, blockedAtStep: 5, gate, agreementId, execution: null, verification: null, settlement: null });
    }
    push(5, 'Policy Validation', blocked ? 'shadow-block' : 'ok', blocked ? `WOULD refuse: '${EXECUTOR_ACTION}' forbidden` : `'${EXECUTOR_ACTION}' permitted by the envelope`);
  } else {
    push(5, 'Policy Validation', 'skipped', 'no agreement');
  }

  push(6, 'Bounded Delegation', gateOpen ? 'ok' : 'skipped', gateOpen ? `authority band ${band}${authority?.valueCeiling != null ? ` · spend ceiling ${authority.valueCeiling}` : ' · no spend ceiling (read-only)'}` : 'no agreement');

  let execution: FinancialIntelligenceResult | null = null;
  let verification: VerificationResult | null = null;
  if (gateOpen) {
    execution = await deps.execute(domain, { intent: input.intent, governingInvariants });
    push(7, 'Execution', 'ok', `${execution.live ? `grounded in ${execution.evidenceRefs.length} invariant(s)` : 'un-grounded'}${execution.analysed ? ' · LLM-analysed' : ''}`);
    verification = deps.verify(domain, execution);
    push(8, 'Verification', verification.passed ? 'ok' : 'observed', `${verification.requirements.filter((r) => r.passed).length}/${verification.requirements.length} requirements passed`);
  } else {
    push(7, 'Execution', mode === 'shadow' ? 'shadow-block' : 'skipped', 'no authorized agreement — delegated call not made');
    push(8, 'Verification', 'skipped', 'no execution to verify');
  }

  // 9 Settlement — P3 cap enforcement, then bind a settlement intent (Domains 1/2).
  let settlement: SettlementResult | null = null;
  if (gateOpen && authority?.settlementTerms) {
    const terms = authority.settlementTerms;
    const cap = spendWithinCap({ valueCeiling: authority.valueCeiling } as DelegatedAuthority, terms.amount);
    if (!cap.ok) {
      if (mode === 'authoritative') {
        push(9, 'Settlement', 'refused', `P3 spend cap: ${cap.reason}`);
        return done({ ok: false, executed: true, blockedAtStep: 9, gate, agreementId, execution, verification, settlement: null });
      }
      push(9, 'Settlement', 'shadow-block', `WOULD refuse (P3): ${cap.reason}`);
    } else if (mode === 'authoritative') {
      settlement = await deps.settle(terms, agreementId ?? '');
      push(9, 'Settlement', settlement.status === 'intent_created' ? 'ok' : 'refused', settlement.note + (settlement.intentRef ? ` [intent ${settlement.intentRef}]` : ''));
    } else {
      push(9, 'Settlement', 'observed', `within cap: ${terms.amount} ${terms.currency} via ${terms.rail} (≤ ${authority.valueCeiling}); intent bound in authoritative mode`);
    }
  } else {
    push(9, 'Settlement', 'skipped', 'no settlement terms (advice-only / Domain 3 read-only)');
  }

  push(10, 'Evidence', mode === 'shadow' ? 'observed' : 'ok', mode === 'shadow' ? 'shadow trace only (CFS-017 observe-first)' : 'execution trace recorded');

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

  return done({ ok: true, executed: gateOpen, blockedAtStep: null, gate, agreementId, execution, verification, settlement });
}
