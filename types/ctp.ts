/**
 * CTP-001 — Constitutional Transition Primitive: the canonical type contract
 * for the registry and the Constitutional Runtime.
 *
 * (2026-08-31, "CTP foundation" — Phase 1 of `AEE-XP-001A`, the CTP required
 * delivery amendment: `codexes/packs/agentiq/updates/
 * 2026-08-31_aee-xp-ctp-required-delivery-amendment.md`. Charter:
 * `codexes/packs/irl/foundation/CTP-001_constitutional-transition-primitive-
 * registry-and-execution-model.md`.)
 *
 * This module defines SHAPE ONLY — no I/O, no resolution logic.
 * `services/ctp/registry.ts` holds the registered instances;
 * `services/ctp/constitutionalRuntime.ts` is the sole execution seam.
 *
 * ── Scope of this first slice ────────────────────────────────────────────
 *
 * This is a real, working foundation — not a stub — but it is deliberately
 * NOT the charter's full future vision (§13 DB-boundary enforcement, §16
 * full CI suite, a true bytecode/source implementation hash). Where this
 * slice is narrower than the charter, the narrowing is named in a comment
 * at the point it matters, never silently claimed as complete.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ── Participants (charter §3) — never aliases of one another ──────────────

export type SubjectRequirementType = 'PERSONHOOD';
export type ActorRequirementType = 'AUTHORIZED_PRINCIPAL_IDENTITY' | 'AUTHORIZED_DELEGATE';

/**
 * The resolved participant set for ONE invocation. `subjectPersonaId` (who
 * the act constitutionally concerns) and `principalPersonaId` (the bound
 * principal identity) are kept as separate fields even where a given
 * primitive's resolution always sets them equal — the charter's structural
 * requirement (§3, delivery amendment #28) is that these are never silently
 * COLLAPSED into one field, not that they must always differ in value.
 */
export interface ResolvedParticipants {
  subjectPersonaId: string;
  principalPersonaId: string;
  /** Who is actually performing the call right now. */
  actorPersonaId: string;
  actorKind: 'principal' | 'delegate';
  /** Set only when actorKind === 'delegate' and a formal grant identifier
   *  exists for it. Null is honest absence, never a placeholder. */
  delegateGrantRef: string | null;
}

export type CTPChannel = 'web' | 'mcp' | 'agent' | 'api' | 'operator';

export interface ConstitutionalContext {
  channel: CTPChannel;
  /** Free-text channel/session provenance (e.g. an MCP agent alias, a
   *  request id). Preserved on the receipt for audit; NEVER read by any
   *  authorization decision — channel-specific authorization semantics are
   *  prohibited (delivery amendment §2.4). */
  channelSessionRef: string | null;
  /** The caller-asserted persona, already resolved by the identity spine
   *  (getActivePersona / MCP's constitutionalNavigator seam) — NOT itself
   *  trusted as subject/principal/actor. Each primitive's
   *  resolveParticipants() decides those, independently, from this value. */
  callerPersonaId: string;
  callerAuthProfileId: string | null;
}

export type AuthorityResolutionResult =
  | { result: 'VALID'; basis: string[] }
  | { result: 'INVALID'; reason: string };

export type AuthorizationResolutionResult =
  | { result: 'AUTHORIZED' }
  | { result: 'REFUSED'; reasonCode: string; reason: string };

/** A JSON-serializable prior/resulting-state snapshot. Each primitive
 *  defines its own concrete shape — this is deliberately a loose
 *  `Record<string, unknown>` rather than a union of every domain's state,
 *  because the runtime never inspects it; it only carries it into evidence. */
export type CTPStateSnapshot = Record<string, unknown>;

export interface ConsequenceProjection {
  effects: string[];
  /** Effect categories the charter names (§9) — informational, carried onto
   *  the receipt; a primitive's own authorize() may read it, the runtime
   *  never gates on it directly. */
  categories?: string[];
}

export type CTPOutcome = 'SUCCESS' | 'REFUSED';

/** The normalized evidence shape (delivery amendment §2.3). Identical shape
 *  for a success (full receipt) or a refusal (most transition-only fields
 *  null) — ONE evidence table, ONE shape, discriminated by `outcome`, which
 *  is itself the "failed attempts are also evidence" requirement (charter
 *  §11) made structural rather than a second table with a second shape. */
export interface ConstitutionalTransitionEvidence {
  evidenceId: string;
  primitiveId: string;
  /** Null only when the primitive itself could not be resolved (an unknown
   *  primitive refusal has no version to report). */
  primitiveVersion: string | null;
  implementationRef: string | null;
  implementationHash: string | null;
  /** Null on a refusal that never reached participant resolution (e.g. an
   *  unknown primitive, or a channel the primitive does not permit). */
  subjectPersonaId: string | null;
  principalPersonaId: string | null;
  actorPersonaId: string | null;
  actorKind: 'principal' | 'delegate' | null;
  delegateGrantRef: string | null;
  channel: CTPChannel;
  channelSessionRef: string | null;
  /** The caller as originally asserted — always present, even on the
   *  earliest possible refusal. */
  callerPersonaId: string;
  authorityResolution: AuthorityResolutionResult | null;
  authorizationResolution: AuthorizationResolutionResult | null;
  priorState: CTPStateSnapshot | null;
  projectedConsequence: ConsequenceProjection | null;
  resultingState: CTPStateSnapshot | null;
  realizedConsequence: Record<string, unknown> | null;
  outcome: CTPOutcome;
  /** Populated only when outcome === 'REFUSED'. */
  reasonCode: string | null;
  reason: string | null;
  timestamp: string;
}

/**
 * The registered CTP definition — binds contract + resolution functions +
 * the canonical implementation. Domain-specific logic lives in each
 * primitive's own module (`services/ctp/primitives/*.ts`); this interface is
 * the shape every primitive must satisfy to register.
 *
 * TInput is the primitive's own invocation input shape (e.g.
 * `{ exchangeId: string; agentRef?: string }`); TImplResult is whatever the
 * bound canonical implementation returns on success.
 */
export interface ConstitutionalTransitionPrimitive<TInput = unknown, TImplResult = unknown> {
  primitiveId: string;
  version: string;
  status: 'CANDIDATE' | 'EXPERIMENTAL' | 'RATIFIED' | 'ACTIVE' | 'DEPRECATED' | 'SUPERSEDED';
  domain: string;
  description: string;
  subjectRequirement: SubjectRequirementType;
  actorRequirement: ActorRequirementType[];
  delegability: boolean;
  permittedChannels: CTPChannel[];
  invariantRefs: string[];

  /** Resolve subject/principal/actor/delegate from the caller context and
   *  the primitive's own input — the ONLY place a given invocation decides
   *  who is acting. May read the DB (e.g. exchange membership). */
  resolveParticipants(
    admin: SupabaseClient,
    ctx: ConstitutionalContext,
    input: TInput,
  ): Promise<{ ok: true; participants: ResolvedParticipants } | { ok: false; reasonCode: string; reason: string }>;

  /** Durable authority check — independent of current state (charter §8:
   *  "Authority (durable) ≠ Authorization"). */
  resolveAuthority(
    admin: SupabaseClient,
    participants: ResolvedParticipants,
    input: TInput,
  ): Promise<AuthorityResolutionResult>;

  /** Canonical prior state, read fresh — never cached. */
  readPriorState(admin: SupabaseClient, participants: ResolvedParticipants, input: TInput): Promise<CTPStateSnapshot>;

  /** Pure — projects the expected effect from prior state + input. No I/O. */
  projectConsequence(priorState: CTPStateSnapshot, input: TInput): ConsequenceProjection;

  /** Evaluated AFTER authority + prior state + consequence are known — the
   *  gate distinct from authority (charter §8). Pure — no I/O. */
  authorize(
    participants: ResolvedParticipants,
    authority: AuthorityResolutionResult,
    priorState: CTPStateSnapshot,
    projection: ConsequenceProjection,
    input: TInput,
  ): AuthorizationResolutionResult;

  /** The bound canonical implementation. MUST be the EXISTING service
   *  function wherever one already correctly performs this transition
   *  (CTP-001A §3 — "bind, don't rewrite"). This runtime performs no
   *  mutation of its own; every write happens inside this call. */
  implementationRef: string;
  /**
   * A NAMED-BINDING hash — sha256 of `implementationRef@version`, proving
   * WHICH implementation is registered as canonical for this primitive/
   * version. This is deliberately NOT a source/bytecode hash (the charter's
   * eventual `implementation_hash` could mean either; true source-hash
   * verification, which would catch an unreviewed edit to the bound
   * function's own body, is out of scope for this first slice and is not
   * claimed here).
   */
  implementationHash: string;
  execute(
    admin: SupabaseClient,
    participants: ResolvedParticipants,
    input: TInput,
  ): Promise<{ ok: true; result: TImplResult } | { ok: false; error: string }>;

  /** Derive the resulting-state snapshot from the implementation's own
   *  result — never a second, possibly-racing read. */
  resultingStateFrom(result: TImplResult): CTPStateSnapshot;

  /** Optional — realized/observed consequence beyond the state transition
   *  itself (charter's "consequence realization"). */
  realizeConsequence?(result: TImplResult): Record<string, unknown> | null;
}
