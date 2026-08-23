/**
 * MoneyPenny Financial Services Runtime — service catalog (Phase 3, Stage
 * 3.1).
 *
 * A typed lookup table, not a new registry system: real service discovery
 * against a live database is future work (the same "data change, needs live
 * credentials" gap already named for `CONFIDENTIAL_CONSEQUENCE_PROJECTION`'s
 * own Agent Bench row — see docs/vela/VELA_EARLY_ACCESS_HANDOFF.md §6). This
 * module is deliberately honest about that: `resolveFinancialServiceDefinition`
 * is a pure function over a static catalog, not a disguised live lookup.
 */

import { MONEYPENNY_PROVIDER_MODE_CONSEQUENCE_CLASS } from '@/types/financialServices';
import type { FinancialServiceDefinition } from '@/types/financialServices';

/**
 * Informational only — never executes. Gate 2 passes `preview` mode
 * unconditionally for any capability id, so correctness here isn't about
 * what Gate 2 permits — it's about `resolveCapabilityProviders` actually
 * resolving a live MoneyPenny Agent Bench provider (2026-08-23 repair pass,
 * Repair E). `financial_advisory` is the REAL capability descriptor name
 * persisted by the MoneyPenny registry seed
 * (supabase/migrations/20260930000400_aigentqube_moneypenny_registry_asset.sql)
 * — the earlier `MONEYPENNY_ADVISOR` id matched nothing live.
 */
export const MONEYPENNY_ADVISOR: FinancialServiceDefinition = {
  serviceId: 'moneypenny.advisor',
  providerMode: 'ADVISOR',
  serviceClass: MONEYPENNY_PROVIDER_MODE_CONSEQUENCE_CLASS.ADVISOR,
  governancePath: 'NONE',
  displayName: 'MoneyPenny Advisor',
  providerAgentId: 'aigent-moneypenny',
  capabilityId: 'financial_advisory',
  eligibilityPolicy: { requiresAdmission: true, consumerVerificationRequirement: 'NOT_REQUIRED', minimumStandingScore: null },
  authorityRequirement: { requiredAuthoritySource: [], requiresActiveAuthority: true },
  projectionRequirement: 'NOT_REQUIRED',
  confidentialityRequirement: 'NOT_REQUIRED',
  attestationRequirement: 'NOT_REQUIRED',
  executionPolicy: { boundedOnly: true, executionReachable: false },
  pricingPolicy: { priceQc: 0 },
  receiptPolicy: { anchorable: true },
};

/**
 * Proposes/plans — never authorises the real action. Gate 2 also passes
 * `shadow` mode unconditionally; `deriveActionAuthorisation()` is never
 * called for this class (see types/financialServices.ts's `DELIVERED` note).
 * `financial_structure_design` is the REAL capability descriptor name
 * persisted by the MoneyPenny registry seed (2026-08-23 repair pass, Repair
 * E) — see `MONEYPENNY_ADVISOR`'s comment above for the same correction.
 */
export const MONEYPENNY_ARCHITECT: FinancialServiceDefinition = {
  serviceId: 'moneypenny.architect',
  providerMode: 'ARCHITECT',
  serviceClass: MONEYPENNY_PROVIDER_MODE_CONSEQUENCE_CLASS.ARCHITECT,
  governancePath: 'NONE',
  displayName: 'MoneyPenny Architect',
  providerAgentId: 'aigent-moneypenny',
  capabilityId: 'financial_structure_design',
  eligibilityPolicy: { requiresAdmission: true, consumerVerificationRequirement: 'NOT_REQUIRED', minimumStandingScore: null },
  authorityRequirement: { requiredAuthoritySource: [], requiresActiveAuthority: true },
  projectionRequirement: 'NOT_REQUIRED',
  confidentialityRequirement: 'NOT_REQUIRED',
  attestationRequirement: 'NOT_REQUIRED',
  executionPolicy: { boundedOnly: true, executionReachable: false },
  pricingPolicy: { priceQc: 0 },
  receiptPolicy: { anchorable: true },
};

/**
 * The Confidential Runtime — `governancePath: 'CONSTITUTIONAL_COMMERCE'`,
 * the one service governed by the frozen VELA-001 constitutional-commerce
 * ontology and the only one that can reach AUTHORISED and bind execution.
 * MUST use the single capability id Gate 2 actually gates
 * (`CONFIDENTIAL_CONSEQUENCE_PROJECTION`), never a second authoritative-mode
 * exception.
 *
 * `attestationRequirement: 'REQUIRED'` is the load-bearing field, not a
 * placeholder: per the Phase 3 operator ruling, "services with
 * attestationRequirement=REQUIRED may not execute real consequential value
 * until Stage 3.3 is LIVE-PROVEN." Setting it to `REQUIRED` here — rather
 * than `NOT_REQUIRED` or `UNSPECIFIED` — is what makes that rule a
 * STRUCTURAL fact: `composeUnifiedConsequenceProjection()` downgrades any
 * unattested confidential evidence to UNRESOLVED under `REQUIRED`, so this
 * service cannot reach AUTHORISED against today's local
 * (`NoAttestationTeeAuthenticator`) Vela deployment no matter what verdict
 * the enclave itself returns — proven directly in
 * `tests/financial-services-runtime.test.ts`. The ONLY way this changes is
 * Stage 3.3 (`docs/vela/VELA_EARLY_ACCESS_HANDOFF.md` §9) delivering a real
 * `NITRO_ATTESTED` deployment.
 *
 * `capabilityId` MUST stay `CONFIDENTIAL_CONSEQUENCE_PROJECTION` — the one
 * id Gate 2's frozen authoritative-mode exception actually permits. The live
 * MoneyPenny Agent Bench registry seed does not yet carry a descriptor by
 * this exact name (its closest live entry is `bounded_financial_execution`,
 * a documented, already-tracked "data change, needs live credentials" gap —
 * docs/vela/VELA_EARLY_ACCESS_HANDOFF.md §6). Do NOT alias the two in
 * `resolveCapabilityProviders` and do NOT change Gate 2 to accommodate the
 * stale registry metadata (2026-08-23 repair-pass ruling, Repair E) — the
 * fix is registering the real descriptor, not bridging the mismatch in code.
 */
export const MONEYPENNY_RUNTIME: FinancialServiceDefinition = {
  serviceId: 'moneypenny.runtime',
  providerMode: 'RUNTIME',
  serviceClass: MONEYPENNY_PROVIDER_MODE_CONSEQUENCE_CLASS.RUNTIME,
  governancePath: 'CONSTITUTIONAL_COMMERCE',
  displayName: 'MoneyPenny Runtime (Confidential)',
  providerAgentId: 'aigent-moneypenny',
  capabilityId: 'CONFIDENTIAL_CONSEQUENCE_PROJECTION',
  // Real consequential execution requires QUALIFIED Standing — parity with
  // services/standing/standingScore.ts's own QUALIFY_THRESHOLD (25).
  eligibilityPolicy: { requiresAdmission: true, consumerVerificationRequirement: 'NOT_REQUIRED', minimumStandingScore: 25 },
  authorityRequirement: { requiredAuthoritySource: [], requiresActiveAuthority: true },
  projectionRequirement: 'REQUIRED',
  confidentialityRequirement: 'REQUIRED',
  attestationRequirement: 'REQUIRED',
  executionPolicy: { boundedOnly: true, executionReachable: true },
  pricingPolicy: { priceQc: 500 },
  receiptPolicy: { anchorable: true },
};

/**
 * The EXISTING, already-live, non-TEE PRD-MPY-001 Runtime pipeline
 * (`/api/moneypenny/runtime`, `runConstitutionalServicePattern` +
 * `constitutionalAgreement.ts`'s own 409 gate) — restored to this catalog's
 * discovery/eligibility surface (2026-08-23 operator directive: "Vela is an
 * assurance enhancement for the confidential service, not a prerequisite for
 * every MoneyPenny Runtime capability").
 *
 * `providerMode: 'RUNTIME'` is shared with `MONEYPENNY_RUNTIME` above — the
 * two are DISTINCT service definitions (distinct `serviceId`,
 * `capabilityId`, and gating), never one aliased as the other.
 *
 * `serviceClass: 'CONSEQUENTIAL'` (operator correction, 2026-08-23, second
 * pass) — a REAL constitutional consequence class, restored from an earlier
 * repair pass that had misclassified this service as `'PROPOSAL'` purely to
 * dodge Gate 2's `authoritative`-mode refusal. That was the wrong axis to
 * bend: `serviceClass` describes WHAT KIND of consequence a service carries
 * (both Runtime services genuinely bind real financial consequence — see
 * `tests/financial-services-runtime.test.ts`'s
 * "both Runtime services are CONSEQUENTIAL" canary), never WHICH MECHANISM
 * governs it. `governancePath: 'CONSTITUTIONAL_SERVICE_PIPELINE'` is the
 * correct, separate axis for that (see its doc in `types/financialServices.ts`).
 *
 * Gate 2 (`services/registry/capabilityInvocationGates.ts`) remains
 * completely UNCHANGED and UNWIDENED: this service still requests `shadow`
 * mode at the gate — via `GOVERNANCE_PATH_EXECUTION_MODE_OVERRIDE`, not via
 * `serviceClass` — Gate 2 already passes `shadow` unconditionally for ANY
 * capability id, exactly as it does for Advisor/Architect. This service
 * NEVER requests `authoritative` mode and NEVER touches the one frozen
 * `CONFIDENTIAL_CONSEQUENCE_PROJECTION` exception, despite now sharing
 * `MONEYPENNY_RUNTIME`'s `CONSEQUENTIAL` class. Its real authorization
 * decision remains the EXISTING, unmodified `constitutionalAgreement.ts` 409
 * gate, invoked inside `dispatchDelegatedProvider()`'s RUNTIME branch
 * (`serviceRequestOrchestrator.ts`) — never VELA's own
 * `composeUnifiedConsequenceProjection`/`deriveActionAuthorisation`/
 * `bindExecution` primitives, which this service never reaches
 * (`executionPolicy.executionReachable: false` — this is the field that
 * actually keeps it out of VELA's ActionAuthorisation path; it is
 * independent of, and does not derive from, `governancePath`).
 *
 * `capabilityId: 'bounded_financial_execution'` is the REAL, already-live
 * MoneyPenny Agent Bench descriptor for Runtime mode (Repair E's own
 * finding) — never `CONFIDENTIAL_CONSEQUENCE_PROJECTION` (that remains
 * exclusively `MONEYPENNY_RUNTIME`'s id) and never a fabricated new one.
 */
export const MONEYPENNY_RUNTIME_CONSTITUTIONAL: FinancialServiceDefinition = {
  serviceId: 'moneypenny.runtime.constitutional',
  providerMode: 'RUNTIME',
  serviceClass: MONEYPENNY_PROVIDER_MODE_CONSEQUENCE_CLASS.RUNTIME,
  governancePath: 'CONSTITUTIONAL_SERVICE_PIPELINE',
  displayName: 'MoneyPenny Runtime (Constitutional)',
  providerAgentId: 'aigent-moneypenny',
  capabilityId: 'bounded_financial_execution',
  // Same Standing bar as the Confidential variant — both are MoneyPenny
  // Runtime capabilities; neither is easier to reach than the other.
  eligibilityPolicy: { requiresAdmission: true, consumerVerificationRequirement: 'NOT_REQUIRED', minimumStandingScore: 25 },
  authorityRequirement: { requiredAuthoritySource: [], requiresActiveAuthority: true },
  projectionRequirement: 'NOT_REQUIRED',
  confidentialityRequirement: 'NOT_REQUIRED',
  attestationRequirement: 'NOT_REQUIRED',
  executionPolicy: { boundedOnly: true, executionReachable: false },
  // The existing pipeline has no Q¢ pricing model of its own — never
  // double-charge a mechanism that doesn't exist yet.
  pricingPolicy: { priceQc: 0 },
  receiptPolicy: { anchorable: true },
};

const CATALOG: Record<string, FinancialServiceDefinition> = {
  [MONEYPENNY_ADVISOR.serviceId]: MONEYPENNY_ADVISOR,
  [MONEYPENNY_ARCHITECT.serviceId]: MONEYPENNY_ARCHITECT,
  [MONEYPENNY_RUNTIME.serviceId]: MONEYPENNY_RUNTIME,
  [MONEYPENNY_RUNTIME_CONSTITUTIONAL.serviceId]: MONEYPENNY_RUNTIME_CONSTITUTIONAL,
};

/** Service discovery. Pure lookup — see file header for what "discovery" honestly means today. */
export function resolveFinancialServiceDefinition(serviceId: string): FinancialServiceDefinition | null {
  return CATALOG[serviceId] ?? null;
}

export function listFinancialServiceDefinitions(): FinancialServiceDefinition[] {
  return Object.values(CATALOG);
}
