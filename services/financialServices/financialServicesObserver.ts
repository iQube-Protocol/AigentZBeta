/**
 * financialServicesObserver.ts — the Differ × Financial Services Bridge pilot,
 * part 1: a PURE, side-effect-free observer of the Horizen × MoneyPenny
 * Financial Services journey (`services/journey/horizenMoneyPennyJourney.ts`,
 * journeyId `'horizen-moneypenny-admission'`).
 *
 * Modeled on the "glue, not authority" discipline
 * `services/financialServices/serviceRequestOrchestrator.ts` documents in its
 * own header, and on `services/financialServices/agentEligibilityContext.ts`'s
 * "resolve once from real reads" pattern — but this module composes ONLY
 * reads that are individually already read-only:
 *
 *   principal        caller-resolved (getActivePersona), never re-derived here
 *   passport signal  services/identity/passportPrincipal.ts
 *                       loadUsableCitizenPassportForAuthProfile (SELECT only)
 *   journey stages    services/journey/horizenMoneyPennyJourney.ts — a static,
 *                       in-memory JourneyDefinition (no I/O)
 *   stage status      services/journey/stageResolution.ts
 *                       readJourneyResolution (SELECT only — reads the
 *                       ALREADY-PERSISTED ratchet; never calls
 *                       resolveJourneyState/recordJourneyResolution, which
 *                       WRITE — see that file's own module doc for why this
 *                       module is deliberately not "a second observer")
 *   destination       services/journey/catalogueDestinationHelper.ts
 *                       resolveJourneyOperatorDestination — declared pure in
 *                       its own file header ("writes nothing, mutates no
 *                       persona preference or global config")
 *   service catalog   services/financialServices/serviceCatalog.ts
 *                       listFinancialServiceDefinitions — "a pure function
 *                       over a static catalog" (that file's own doc)
 *   completion         services/receipts/activityReceiptService.ts
 *   evidence            listActivityReceiptsForPersona (SELECT only)
 *
 * What this module NEVER calls, and why each is excluded:
 *   - resolveJourneyState / recordJourneyResolution / settleFact — WRITE
 *     (recordJourneyResolution issues an .update(); settleFact the same).
 *   - requestFinancialService / invokeCapability / draftFinancialStructure /
 *     runMoneyPennyChat — these EXECUTE a service or dispatch a provider.
 *   - createActivityReceipt / accrueStanding / any DVN pipeline entry point —
 *     these WRITE a receipt or anchor one.
 *   - resolvePassportPrincipalForAuthUser (DID-chain walk) — belongs to
 *     identity VERIFICATION, not ordinary Passport recognition (operator
 *     ruling 2026-08-03, cited verbatim in the `/state` route this module
 *     deliberately does NOT reuse).
 *
 * Serialisation boundary (CLAUDE.md Identity & Access Spine): this module's
 * return value is built through an explicit allowlist by its ONE caller (the
 * projection endpoint) — it never receives or holds authProfileId beyond the
 * single read that needs it, and never returns personaId, authProfileId, a
 * raw Passport row, or a raw activity_receipts row. `journey.stages[].status`
 * is `'unknown'` whenever no persisted resolution exists yet — never
 * fabricated as `'complete'` or `'ready'`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { readJourneyResolution } from '@/services/journey/stageResolution';
import {
  resolveJourneyOperatorDestination,
  type JourneyOperatorDestinationResolution,
} from '@/services/journey/catalogueDestinationHelper';
import { resolveRegistrableAgent, DEFAULT_REGISTRABLE_AGENT_SLUG } from '@/services/horizen/registrableAgents';
import { loadUsableCitizenPassportForAuthProfile } from '@/services/identity/passportPrincipal';
import { listFinancialServiceDefinitions } from '@/services/financialServices/serviceCatalog';
import { listActivityReceiptsForPersona } from '@/services/receipts/activityReceiptService';

export const FS_DIFFER_PROJECTION_SCHEMA_VERSION = 'fs-differ-projection/v1' as const;

export type FinancialServiceStageStatus = 'complete' | 'ready' | 'blocked' | 'unknown';

export interface FinancialServicesProjectionStage {
  id: string;
  label: string;
  status: FinancialServiceStageStatus;
  explanation: string;
}

export type FinancialServiceProviderMode = 'ADVISOR' | 'ARCHITECT' | 'RUNTIME';

export interface FinancialServicesProjectionService {
  serviceRef: string;
  label: string;
  provider: 'moneypenny';
  mode: FinancialServiceProviderMode;
  availability: 'available' | 'unavailable' | 'unknown';
}

export interface FinancialServicesProjectionNextAction {
  actionRef: string;
  label: string;
  capabilityRef: string;
  nativeSurfaceRef: string;
  handoffEligible: boolean;
}

export interface FinancialServicesProjection {
  schemaVersion: typeof FS_DIFFER_PROJECTION_SCHEMA_VERSION;
  projectionId: string;
  generatedAt: string;
  expiresAt: string;
  journey: {
    id: string;
    currentStageId: string | null;
    stages: FinancialServicesProjectionStage[];
  };
  services: FinancialServicesProjectionService[];
  nextActions: FinancialServicesProjectionNextAction[];
}

/** Short — a projection is a point-in-time read, not a cache to build UX on. */
const PROJECTION_TTL_SECONDS = 90;

/**
 * Advisor/Architect only (operator directive: "Runtime/consequential
 * financial actions ... remain unavailable in this first pilot"). RUNTIME
 * services are still listed in `services[]` for honesty (Differ can show
 * "not yet available here") but are NEVER offered in `nextActions` and are
 * never `handoffEligible`, regardless of catalogue/threshold state.
 */
const PILOT_ELIGIBLE_MODES: ReadonlySet<FinancialServiceProviderMode> = new Set(['ADVISOR', 'ARCHITECT']);

/**
 * The one receipt type that proves a bounded Advisor/Architect service
 * request actually completed — written by the EXISTING, unmodified
 * `services/registry/invocationGateway.ts::emitCapabilityInvocationCompleted`
 * (itself only reachable through `requestFinancialService`'s own gateway
 * call, never from this module). See that file's `CAPABILITY_RECEIPT_ACTION_TYPE`
 * map. Read-only here — this module never writes one.
 */
const COMPLETION_ACTION_TYPE = 'capability_invocation_completed' as const;
const COMPLETION_LOOKBACK = 5;

export interface FinancialServicesPrincipal {
  /** T0 — used only for server-internal reads in this function; never returned. */
  personaId: string;
  /** T0 — used only to resolve the Citizen Passport signal; never returned. */
  authProfileId: string;
}

function stageExplanation(status: FinancialServiceStageStatus, label: string): string {
  switch (status) {
    case 'complete':
      return `${label} is complete.`;
    case 'ready':
      return `${label} is ready — its prerequisites are complete.`;
    case 'blocked':
      return `${label} is blocked on an earlier stage.`;
    default:
      return `${label}'s status has not been observed yet.`;
  }
}

/**
 * Pure derivation over (a) the static journey definition's stage graph
 * (id/label/prerequisites — no I/O) and (b) the persisted `canonicalStages`
 * ratchet (already read, never re-derived). This deliberately does NOT
 * reproduce `resolveJourneyState`'s live-evidence reasoning — a stage this
 * function cannot honestly place is `'unknown'`, never guessed into
 * `'ready'`/`'blocked'`.
 */
function projectStages(canonicalStages: ReadonlySet<string> | null): FinancialServicesProjectionStage[] {
  return HORIZEN_MONEYPENNY_JOURNEY.stages.map((stage) => {
    if (!canonicalStages) {
      return { id: stage.id, label: stage.label, status: 'unknown', explanation: stageExplanation('unknown', stage.label) };
    }
    if (canonicalStages.has(stage.id)) {
      return { id: stage.id, label: stage.label, status: 'complete', explanation: stageExplanation('complete', stage.label) };
    }
    const prerequisitesMet = stage.prerequisites.every((p) => canonicalStages.has(p));
    const status: FinancialServiceStageStatus = prerequisitesMet ? 'ready' : 'blocked';
    return { id: stage.id, label: stage.label, status, explanation: stageExplanation(status, stage.label) };
  });
}

function firstIncompleteStageId(stages: FinancialServicesProjectionStage[]): string | null {
  const next = stages.find((s) => s.status !== 'complete');
  return next ? next.id : null;
}

export async function resolveFinancialServicesProjection(
  admin: SupabaseClient,
  principal: FinancialServicesPrincipal,
): Promise<FinancialServicesProjection> {
  const now = new Date();
  const generatedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + PROJECTION_TTL_SECONDS * 1000).toISOString();
  const projectionId = `fsproj-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  // ── The MoneyPenny agent record this journey is scoped to (static lookup —
  //    no I/O). moneypenny is the DEFAULT registrable agent; this pilot never
  //    lets Differ choose a different one. ─────────────────────────────────
  const agent = resolveRegistrableAgent(DEFAULT_REGISTRABLE_AGENT_SLUG);

  // ── Passport threshold signal — pure SELECT, soft-fails to `false` (never
  //    to a guessed `true`; loadUsableCitizenPassportForAuthProfile's own
  //    `{ ok: false }` branch already means "no usable passport found or the
  //    read failed", both of which this pilot treats identically: not yet at
  //    the Financial Services threshold). ────────────────────────────────
  let citizenPassportUsable = false;
  try {
    const passport = await loadUsableCitizenPassportForAuthProfile(admin, principal.authProfileId);
    citizenPassportUsable = passport.ok;
  } catch {
    citizenPassportUsable = false;
  }

  // ── Persisted stage ratchet — pure SELECT, or null if never yet resolved
  //    for this agent's AigentQube (honest 'unknown', never fabricated). ──
  let canonicalStages: Set<string> | null = null;
  if (agent) {
    try {
      const resolution = await readJourneyResolution(admin, agent.aigentQubeId, HORIZEN_MONEYPENNY_JOURNEY.id);
      canonicalStages = resolution ? new Set(resolution.canonicalStages) : null;
    } catch {
      canonicalStages = null;
    }
  }

  const stages = projectStages(canonicalStages);
  const currentStageId = canonicalStages ? firstIncompleteStageId(stages) : null;

  // ── Catalogue/journey destination — pure, declared side-effect-free in
  //    its own module doc. Threshold-gates the whole Operate surface. ─────
  let destination: JourneyOperatorDestinationResolution;
  try {
    destination = resolveJourneyOperatorDestination({
      journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
      participantState: { citizenPassportUsable },
    });
  } catch {
    destination = {
      valid: false,
      journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
      failedLookup: 'journey-not-registered',
      reason: 'destination resolution threw',
    };
  }

  const destinationOpen = destination.valid && destination.activationMode === 'CATALOGUE_ACTIVATION';
  const nativeSurfaceRef = destination.valid ? destination.operatorDestination.tabSlug : 'unknown';

  // ── Static service catalog — pure. Every definition is listed for
  //    honesty; only ADVISOR/ARCHITECT ever become `nextActions`. ─────────
  const catalog = listFinancialServiceDefinitions();
  const services: FinancialServicesProjectionService[] = catalog.map((def) => {
    const mode = (PILOT_ELIGIBLE_MODES.has(def.providerMode as FinancialServiceProviderMode)
      ? (def.providerMode as FinancialServiceProviderMode)
      : 'RUNTIME') as FinancialServiceProviderMode;
    const availability: FinancialServicesProjectionService['availability'] = !destination.valid
      ? 'unknown'
      : destinationOpen
        ? 'available'
        : 'unavailable';
    return { serviceRef: def.serviceId, label: def.displayName, provider: 'moneypenny', mode, availability };
  });

  // ── Completion evidence — pure SELECT of an already-written receipt.
  //    Read here so a future extension can narrow re-offering; the pilot
  //    itself does not use it to alter `nextActions` (see comment below). ──
  try {
    await listActivityReceiptsForPersona(principal.personaId, {
      cartridge: 'financial-services',
      actionTypes: [COMPLETION_ACTION_TYPE],
      limit: COMPLETION_LOOKBACK,
    });
  } catch {
    // Soft-fail — completion evidence is corroborating only, never load-bearing here.
  }

  const nextActions: FinancialServicesProjectionNextAction[] = catalog
    .filter((def) => PILOT_ELIGIBLE_MODES.has(def.providerMode as FinancialServiceProviderMode))
    .map((def) => ({
      actionRef: def.serviceId,
      label: def.displayName,
      capabilityRef: def.capabilityId,
      nativeSurfaceRef,
      // Eligible only when the catalogue/journey destination is genuinely
      // open — never merely because the service exists in the static
      // catalog.
      handoffEligible: destinationOpen,
    }));

  return {
    schemaVersion: FS_DIFFER_PROJECTION_SCHEMA_VERSION,
    projectionId,
    generatedAt,
    expiresAt,
    journey: {
      id: HORIZEN_MONEYPENNY_JOURNEY.id,
      currentStageId,
      stages,
    },
    services,
    nextActions,
  };
}
