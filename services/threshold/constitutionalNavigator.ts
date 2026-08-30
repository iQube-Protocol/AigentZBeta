/**
 * constitutionalNavigator.ts — the Threshold MCP's own composition seam
 * (2026-08-26, first slice of the "invitation-aware constitutional guide"
 * brief).
 *
 * THE ONE CONCEPTUAL THING THIS FILE MUST NEVER BLUR: the MCP is not the
 * journey. It is the agent-accessible constitutional NAVIGATOR over the
 * journey. Every fact this module returns is READ from an existing,
 * already-canonical resolver — Passport (services/identity/passportPrincipal),
 * sponsorship + delegation (services/identity/constitutionalContext), CAS
 * research-lab grants (services/passport/participationAccess), Reciprocal
 * Artifact Exchange membership (services/research/reciprocalExchange), and
 * per-journey stage evidence (services/journey/resolveJourneyState +
 * each journey's own evidence-assembly function). This file composes; it
 * never re-implements, re-derives, or stores any of those facts itself.
 *
 * THE SEAM THIS FILE CLOSES: every one of those resolvers is keyed by a T0
 * identifier (personaId / authProfileId) — server-internal, never exposed to
 * a client. The Threshold MCP gateway, by design (gatewaySession.ts's own
 * header: "Only T2 references are stored... no T0 ids"), resolves a caller's
 * identity to nothing more than `ScopedSession.principalPublicRef` — a
 * one-way, T2-safe commitment. Before this file, there was no code path from
 * "an MCP tool call carrying a ScopedSession" to "the real personaId needed
 * to call any of the resolvers above." That path is exactly, and only:
 *
 *   ScopedSession.principalPublicRef
 *     -> resolvePersonaIdByPublicRef (services/identity/personaReferences.ts,
 *        PERSONA-PUBLIC-REF-001, admin-only, a plain indexed lookup against
 *        the persisted `personas.public_ref` column — never a hash reversal)
 *     -> personaId
 *     -> resolveOwnerAuthProfileId (services/contactGraph/ownerResolution.ts)
 *     -> authProfileId
 *     -> every personaId/authProfileId-parameterized resolver above.
 *
 * Both reverse-lookup functions already existed in the repo for unrelated
 * reasons (persona self-view; ContactGraph ownership); nothing about them
 * needed to change. What was missing was simply USING them here.
 *
 * T2 DISCIPLINE ON THE WAY OUT, not just the way in: `personaId`/
 * `authProfileId` are resolved and used ONLY inside this function's own
 * scope. `NavigatorState` — everything this module returns — carries no T0
 * identifier anywhere; every field is a boolean, a count, a status label, a
 * stage id/label, or an already-T2-safe scope string (research-lab grant
 * scopes are workspace/experiment ids, not persona-bearing).
 *
 * SCOPE OF THIS FIRST SLICE (operator-directed, 2026-08-26): the journey
 * composition below is wired for exactly one bridge — Ian's OCSGA / Boundary
 * Research crossing (`ian-boundary-research`) — as the acceptance case. The
 * `JOURNEY_ADAPTERS` map exists so wiring the other three bridges (KNYTS, CI,
 * Horizen/MoneyPenny) later is an ADDITIVE entry, never a rewrite of this
 * file's composition logic. See the closeout report for what remains a
 * genuine gap rather than an oversight.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ScopedSession } from '@/services/threshold/gatewaySession';
import { resolvePersonaIdByPublicRef } from '@/services/identity/personaReferences';
import { resolveOwnerAuthProfileId } from '@/services/contactGraph/ownerResolution';
import { isPassportUsable, loadUsableCitizenPassportForAuthProfile, listOwnedPersonaIds } from '@/services/identity/passportPrincipal';
import { resolveConstitutionalContextForPersona } from '@/services/identity/constitutionalContext';
import { getGrantedExperiments } from '@/services/passport/participationAccess';
import { listMyExchanges } from '@/services/research/reciprocalExchange';
import { resolveJourneyState } from '@/services/journey/resolveJourneyState';
import type { AuthoritativePlatformState } from '@/services/journey/resolveJourneyState';
import { ActorRole, type JourneyDefinition } from '@/types/journey';
import { IAN_BOUNDARY_RESEARCH_JOURNEY } from '@/services/journey/ianBoundaryResearchJourney';
import { fetchIanAuthoritativePlatformState } from '@/services/journey/ianJourneyState';
import {
  ensureBoundaryResearchExchangeMembership,
  OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
} from '@/services/journey/boundaryResearchExchangeAdmission';

// ── Per-bridge journey adapter — the ONLY place a new bridge gets added ────

interface JourneyAdapter {
  journey: JourneyDefinition;
  fetchState: (admin: SupabaseClient, personaId: string, authProfileId: string | null) => Promise<AuthoritativePlatformState>;
}

/**
 * bridge id -> its journey + its OWN evidence-assembly function (each
 * journey's state route already has one; this map reuses it verbatim, never
 * a second evidence assembler). ONE entry today (ocsga/Ian) — the other
 * three bridges named in the brief (knyts, ci, horizen) are a real,
 * reported gap: each would need the SAME extraction this slice already
 * performed for Ian (services/journey/ianJourneyState.ts) applied to its own
 * route before it could be added here, so the map stays honest about what it
 * does not yet cover rather than silently returning null for those ids.
 */
const JOURNEY_ADAPTERS: Record<string, JourneyAdapter> = {
  ocsga: {
    journey: IAN_BOUNDARY_RESEARCH_JOURNEY,
    fetchState: async (admin, personaId, authProfileId) => {
      // Same admission boundary the /bridge/ocsga route runs (2026-08-26
      // structural fix) — an MCP-originated read must observe the SAME
      // RAX membership a browser read would, never a second, disagreeing
      // truth (Surface Independence). Best-effort: a failure here degrades
      // to the pre-fix read, never throws.
      await ensureBoundaryResearchExchangeMembership(admin, {
        personaId,
        authProfileId,
        workspaceId: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
      }).catch(() => null);
      const result = await fetchIanAuthoritativePlatformState(personaId, authProfileId);
      return result.state;
    },
  },
};

export function supportedBridgeIds(): string[] {
  return Object.keys(JOURNEY_ADAPTERS);
}

// ── The composed, T2-safe result shape ──────────────────────────────────────

export interface NavigatorJourneyView {
  id: string;
  label: string;
  currentStageId: string;
  currentStageLabel: string;
  complete: boolean;
  /** What the current stage's own evidence is still missing — never a guess. */
  evidenceMissing: string[];
}

export interface NavigatorNextAct {
  stageId: string;
  label: string;
  /** The stage's own operator-facing "why", verbatim from the journey
   *  definition's `companion.before` copy — never re-authored here. */
  because: string;
  /** Who performs it — PRINCIPAL | DELEGATE | EITHER, verbatim from the
   *  stage's own `actorRole` (types/journey.ts). */
  actor: string;
}

export interface NavigatorState {
  resolvable: boolean;
  /** Set only when `resolvable` is false — the honest reason, never a guess. */
  reason?: string;
  context: {
    bridge: string;
    initiatingService: string;
  };
  principal: {
    /** 'usable' / 'not-usable' mirror `isPassportUsable`'s own two outcomes;
     *  'unresolved' means the read itself could not complete (never coerced
     *  to 'not-usable' — an unread fact is not a negative fact). */
    passportStatus: 'usable' | 'not-usable' | 'unresolved';
  };
  agent: {
    /** Every agent this PERSON has sponsored (across every persona they
     *  own — the CFS-024 person-scoping resolveConstitutionalContext already
     *  applies), not scoped to the one agent connected via this MCP session —
     *  see the closeout report for that finer-grained (per-agentAlias) gap. */
    sponsoredAgentCount: number;
    /** The active persona's own delegation ledger (services/delegation/
     *  delegationGrantStore.ts) — at least one active grant exists. */
    delegationActive: boolean;
  };
  grants: {
    /** CAS research-lab access grant (services/passport/participationAccess.ts) —
     *  the system Ian's own OCSGA workspace scope rides on. */
    researchLab: { hasGrant: boolean; scopes: string[] };
    /** Reciprocal Artifact Exchange membership (services/research/
     *  reciprocalExchange.ts) — the system Ian's own journey PROGRESSION
     *  rides on; genuinely separate from the CAS grant above. */
    reciprocalExchange: { hasActiveExchange: boolean; status: string | null };
  };
  journey: NavigatorJourneyView | null;
  nextAct: NavigatorNextAct | null;
  /** Honest gap reports carried through from every composed resolver —
   *  never silently dropped. */
  evidenceGaps: string[];
}

function unresolvableState(reason: string, bridge: string, initiatingService: string): NavigatorState {
  return {
    resolvable: false,
    reason,
    context: { bridge, initiatingService },
    principal: { passportStatus: 'unresolved' },
    agent: { sponsoredAgentCount: 0, delegationActive: false },
    grants: {
      researchLab: { hasGrant: false, scopes: [] },
      reciprocalExchange: { hasActiveExchange: false, status: null },
    },
    journey: null,
    nextAct: null,
    evidenceGaps: [reason],
  };
}

/**
 * Resolve the composed constitutional-navigator state for an MCP session.
 * Read-only, admin-scoped (the caller must pass the SAME service-role
 * `SupabaseClient` every other Threshold gateway tool uses — never a
 * user-scoped client, since the reverse-lookup this depends on is
 * admin-only by design).
 *
 * `bridge` selects which journey's state to compose (see JOURNEY_ADAPTERS).
 * Defaults to the session's own `initiatingService` when omitted; falls back
 * honestly (`resolvable: true`, `journey: null`) when no adapter exists yet
 * for the resolved bridge id, rather than guessing a destination.
 */
export async function resolveConstitutionalNavigatorState(
  admin: SupabaseClient,
  session: ScopedSession,
  opts?: { bridge?: string },
): Promise<NavigatorState> {
  const bridge = opts?.bridge ?? session.initiatingService;

  const personaId = await resolvePersonaIdByPublicRef(admin, session.principalPublicRef);
  if (!personaId) {
    return unresolvableState(
      'Could not resolve the session principal to a real persona — the public reference did not match a known persona. Nothing below is derivable until this resolves.',
      bridge,
      session.initiatingService,
    );
  }

  const authProfileResult = await resolveOwnerAuthProfileId(personaId);
  const authProfileId = authProfileResult.ok ? authProfileResult.value : null;
  const evidenceGaps: string[] = [];
  if (!authProfileResult.ok) {
    evidenceGaps.push(`Could not resolve the owning auth profile: ${authProfileResult.error}. Passport status stays unresolved.`);
  }

  // ── Principal: Passport ────────────────────────────────────────────────
  let passportStatus: NavigatorState['principal']['passportStatus'] = 'unresolved';
  if (authProfileId) {
    const credential = await loadUsableCitizenPassportForAuthProfile(admin, authProfileId);
    if (credential.ok) {
      passportStatus = isPassportUsable(credential.passport) ? 'usable' : 'not-usable';
    } else {
      evidenceGaps.push(`Passport read failed: ${credential.reason}.`);
    }
  }

  // ── Agent: sponsorship + delegation ────────────────────────────────────
  const constitutionalContext = authProfileId
    ? await resolveConstitutionalContextForPersona(personaId, authProfileId).catch(() => null)
    : null;
  if (authProfileId && !constitutionalContext) {
    evidenceGaps.push('Sponsorship/delegation roster read failed — reported as zero rather than guessed.');
  }
  const sponsoredAgentCount = constitutionalContext?.boundAgents.length ?? 0;
  const delegationActive = (constitutionalContext?.assignedAgents ?? []).some((a) => a.active);

  // ── Grants: CAS research-lab + RAX reciprocal exchange ─────────────────
  const grantedExperiments = await getGrantedExperiments(admin, personaId).catch(() => null);
  const researchLabScopes =
    grantedExperiments && grantedExperiments.allowed !== 'all'
      ? Array.from(grantedExperiments.allowed)
      : grantedExperiments?.allowed === 'all'
        ? ['all']
        : [];
  if (!grantedExperiments) evidenceGaps.push('CAS research-lab grant read failed — reported as no grant rather than guessed.');

  // Merge-aware discovery (2026-08-30, "MCP navigator discovery" repair) —
  // the SAME roster Passport resolution above already used
  // (listUsableCitizenPassportForAuthProfile -> listOwnedPersonaIds), so a
  // bound exchange party under a MERGED sibling auth profile is discoverable
  // exactly as their Passport already is. Falls back to [personaId] alone
  // when the roster cannot resolve — never widens incorrectly.
  let ownedPersonaIds: string[] = [personaId];
  if (authProfileId) {
    const owned = await listOwnedPersonaIds(admin, authProfileId).catch(() => null);
    if (owned?.ok) ownedPersonaIds = owned.personaIds;
  }
  const exchanges = await listMyExchanges(admin, ownedPersonaIds).catch(() => null);
  let hasActiveExchange = false;
  let exchangeStatus: string | null = null;
  if (exchanges?.ok) {
    if (exchanges.exchanges.length > 0) {
      hasActiveExchange = true;
      exchangeStatus = exchanges.exchanges[0].status;
    }
  } else if (exchanges && !exchanges.ok) {
    evidenceGaps.push(`Reciprocal Artifact Exchange read failed: ${exchanges.error}.`);
  }

  // ── Journey: pluggable per-bridge adapter ──────────────────────────────
  const adapter = JOURNEY_ADAPTERS[bridge];
  let journeyView: NavigatorJourneyView | null = null;
  let nextAct: NavigatorNextAct | null = null;
  if (!adapter) {
    evidenceGaps.push(
      `No journey adapter is wired for bridge '${bridge}' yet — journey/nextAct stay null rather than guessed. See supportedBridgeIds() for what is covered.`,
    );
  } else {
    const authState = await adapter.fetchState(admin, personaId, authProfileId);
    const runtime = resolveJourneyState(adapter.journey, authState);
    const currentStageDef = adapter.journey.stages.find((s) => s.id === runtime.currentStageId) ?? null;
    const currentStageRuntime = runtime.stages.find((s) => s.stageId === runtime.currentStageId) ?? null;
    journeyView = {
      id: adapter.journey.id,
      label: adapter.journey.label,
      currentStageId: runtime.currentStageId,
      currentStageLabel: currentStageDef?.label ?? runtime.currentStageId,
      complete: runtime.complete,
      evidenceMissing: currentStageRuntime?.evidenceMissing ?? [],
    };
    if (!runtime.complete && currentStageDef) {
      nextAct = {
        stageId: currentStageDef.id,
        label: currentStageDef.label,
        because: currentStageDef.companion.before,
        actor: String(currentStageDef.actorRole ?? ActorRole.PRINCIPAL),
      };
    }
  }

  return {
    resolvable: true,
    context: { bridge, initiatingService: session.initiatingService },
    principal: { passportStatus },
    agent: { sponsoredAgentCount, delegationActive },
    grants: {
      researchLab: { hasGrant: Boolean(grantedExperiments?.hasGrant), scopes: researchLabScopes },
      reciprocalExchange: { hasActiveExchange, status: exchangeStatus },
    },
    journey: journeyView,
    nextAct,
    evidenceGaps,
  };
}
