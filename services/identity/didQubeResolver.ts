/**
 * didQubeResolver — the canonical DiDQube resolver (Phase 2, operator-approved 2026-09-07).
 *
 * Pure, read-only, non-authoritative. It projects the Phase 1 supertype tables
 * (`didqubes`/`human_didqubes`/`agent_didqubes` — see
 * `supabase/migrations/20260930270000_didqube_canonical_supertype.sql`) into a
 * typed resolution; `resolveDiDQube` itself writes nothing, anchors nothing,
 * and issues nothing. `ensureAgentDiDQubeBinding` (below) is the one
 * exception — a narrow, idempotent write path Phase 4 consumers use to
 * complete a binding, added when Factor became the first real consumer
 * (2026-09-07, execution plan Phase 4 item 1). Aegis, CTP, DCIR, Standing,
 * Registry/Horizen, and DVN are not yet integrated — each migrates
 * independently, per the execution plan's own sequencing.
 *
 * ── Composition, not re-derivation (inv.engineering.036/037) ────────────────
 *
 * `auth_user_id` resolution reuses `resolveRootPrincipalForAuthUser` (the
 * Passport-INDEPENDENT auth→root→kybe walk `passportPrincipal.ts` already
 * exports for exactly this reason). `proven_wallet` resolution reuses the
 * fuller `resolvePassportPrincipal`, which — unlike the auth_user_id walk —
 * bundles a usable-Passport requirement into its own success condition (its
 * private `resolveAuthUserForKybe` step is not separately exported). This
 * resolver does not re-derive that private walk to decouple Passport
 * usability from wallet lineage (that would be exactly the "second identity
 * path" `inv.engineering.036/037` forbids); the honest consequence, disclosed
 * rather than hidden, is that a proven wallet with a resolvable kybe but no
 * currently-usable Passport reports `unresolved` with reason
 * `passport_gate_unmet` here, even though its DiDQube itself would resolve
 * fine via the anchor-only paths (`kybe_identity_id`/`auth_user_id`). A future
 * exported, Passport-independent wallet→root walk (mirroring
 * `resolveRootPrincipalForAuthUser`) would remove this gap — flagged as a
 * follow-up, not fixed by inventing a parallel implementation here.
 *
 * ── No fallback to `personas.root_did` ───────────────────────────────────────
 *
 * This module never reads or references the `personas` table. Every walk here
 * goes through `kybe_identity` / `root_identity` / `agent_root_identity` /
 * `polity_passport_records`, or through `passportPrincipal.ts`'s own walks,
 * which already avoid it. Eliminating existing authoritative reads of
 * `personas.root_did` elsewhere in the tree is Phase 2.5, tracked separately.
 *
 * ── Four distinct value kinds, never conflated (ruling #6) ──────────────────
 *
 * Every resolved primitive keeps `constitutionalAnchor` (the permanent anchor
 * — `kybe_identity` for humans, `agent_root_identity` for agents),
 * `currentIdentityPrimitive` (the current reissuable identity layer beneath
 * it — `root_identity` for humans; for agents this Phase 1 schema has no
 * separate reissuable layer, so it coincides with the anchor itself, and that
 * coincidence is stated explicitly rather than silently assumed to be the
 * general case), `passportCredential` (existence + usability only), and
 * `publicCommitment` (an explicitly-versioned one-way commitment — see below)
 * as four separate fields. No caller-facing shape collapses them.
 *
 * ── Versioned public commitments (ruling #6) ─────────────────────────────────
 *
 * `publicCommitment` carries `commitmentVersion: 'v1'` alongside the value.
 * `v1` is exactly today's `didPublicRef()` 16-hex truncated-sha256 pattern
 * (`services/passport/bureauIdentityService.ts`) — reused, not re-derived.
 * `v1` must never be treated as inherently equivalent to a DID; a future
 * commitment scheme is a new version value, never a silent reinterpretation
 * of `v1` output.
 *
 * ── Trust classes on every resolved primitive (ruling #7) ────────────────────
 *
 * `server_derived` — `auth_user_id` and direct anchor-id inputs; accepted
 * only from server-side callers, never from a browser-supplied value.
 * `proven_control` — a wallet address the caller has already cryptographically
 * proven control of (the same "pass the recovered signer" contract
 * `resolvePassportPrincipal` already enforces).
 * `network_qualified` — an ERC-8004 identifier with a verified binding
 * record. No such binding store exists yet in this codebase (checked against
 * the Phase 0 inventory, not assumed) — this input kind is accepted for
 * forward compatibility with the resolver's contract but always resolves
 * `unresolved`/`unqualified_reference` until one exists. Not guessed at.
 * `discovery` — a public Agent Card URL or runtime identifier. It MAY locate
 * exactly one candidate `agent_root_identity` row (the same `agent_card_url`
 * lookup `sponsorPolityAgent.ts`/the Phase 0 Passport reconciliation already
 * use), but a `discovery`-trust-class primitive is never constitutional
 * authority on its own — a consequential (approval-gating/execution-gating)
 * consumer must treat it the same as `unresolved` for its own purposes. That
 * classification is Phase 4's job (ruling #8); this resolver only tags it.
 *
 * ── Resolution states ────────────────────────────────────────────────────────
 *
 * `resolved | unresolved | ambiguous | conflicted | unsupported_subject_class`
 * (operator-approved vocabulary, 2026-09-07 third review). `absent` is not a
 * top-level state — an absent anchor is represented as
 * `{ state: 'unresolved', reason: 'anchor_absent' }`.
 *
 * ── Fail-closed, defensively, even against invariants Phase 1 already
 *    enforces at the DB layer ─────────────────────────────────────────────────
 *
 * The Phase 1 migration enforces one-anchor-per-DiDQube, one-DiDQube-per-
 * anchor, subject-class matching, and single-subtype exclusivity via UNIQUE
 * constraints and triggers. Those triggers fire on INSERT/UPDATE of the
 * SUBTYPE tables — nothing prevents a later, out-of-band `UPDATE didqubes SET
 * subject_class = ...` from desynchronizing a `didqubes` row from the subtype
 * table it was originally bound through. This resolver does not trust the
 * DDL alone: it re-checks subject-class agreement and single-subtype
 * exclusivity at READ time and reports `conflicted` (not a guess, not a
 * silent pick) if they disagree.
 *
 * ── Stable-container model for supersession — LITERAL, no traversal at all
 *    (operator correction, 2026-09-07, second pass) ──────────────────────────
 *
 * A DiDQube is the permanent constitutional container. RootDID, VC, Passport,
 * and public-commitment rotation must never supersede the DiDQube container.
 * This resolver therefore does NOT traverse `superseded_by` at all — not even
 * with anchor verification. An earlier pass of this fix ("anchor-verified
 * container replacement") still walked from a `superseded` didqube to its
 * recorded successor whenever the successor could be shown to bind the same
 * anchor; the operator correctly identified that as still describing
 * container REPLACEMENT, dressed up with a check, rather than the stable
 * container the model is named for — a DiDQube's identity must never move to
 * a *different* didqube_id at all, constitutional-anchor-verified or not.
 *
 * The resolver now does exactly one thing with a `didqubes` row it finds via
 * the anchor's own subtype binding: if `lifecycle_state = 'active'`, resolve
 * it, in place, with no further lookups. If `lifecycle_state = 'superseded'`,
 * return `unresolved`/`superseded_unreconciled` (or `conflicted` if the row is
 * itself malformed — see below) and go no further. There is no successor
 * lookup, no `superseded_by` dereference, no chain, no cycle or depth concern
 * (a single row can be inspected but never walked, so there is nothing to
 * cycle through). A real reconciliation mechanism for a genuinely-superseded
 * constitutional subject (e.g. correcting a duplicate erroneous DiDQube for
 * the same anchor) is a SEPARATE, deliberately-designed act this resolver
 * does not implement — flagged as a future, explicit capability, never
 * inferred by a read-only resolver walking a pointer.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { didPublicRef } from '@/services/passport/bureauIdentityService';
import {
  isPassportUsable,
  resolvePassportPrincipal,
  resolveRootPrincipalForAuthUser,
  type PassportSnapshot,
  type PrincipalFailure,
} from '@/services/identity/passportPrincipal';
import type { WalletChain } from '@/services/identity/walletAliasService';

type SupabaseLike = NonNullable<ReturnType<typeof getSupabaseServer>>;

// ── Public contract ───────────────────────────────────────────────────────────

export type DiDQubeSubjectClass = 'natural_person' | 'agent';

/** Deferred subject classes — no canonical root table exists for either yet (Phase 0 finding). */
export type UnsupportedSubjectClass = 'robot' | 'organization';

export type TrustClass = 'server_derived' | 'proven_control' | 'network_qualified' | 'discovery';

export type UnresolvedReason =
  | 'anchor_absent'
  | 'lineage_incomplete'
  | 'unqualified_reference'
  | 'passport_gate_unmet'
  /**
   * The anchor's DiDQube exists but is marked `lifecycle_state = 'superseded'`.
   * The stable-container model does not traverse to a recorded successor — no
   * reconciliation mechanism for a genuinely-superseded constitutional subject
   * exists yet (a separate, deliberately-designed capability, not inferred
   * here). This is a normal, expected outcome for such a row, not a data
   * defect — hence `unresolved`, not `conflicted`.
   */
  | 'superseded_unreconciled'
  | 'unavailable';

export type DiDQubeResolverInput =
  | { kind: 'kybe_identity_id'; kybeIdentityId: string }
  | { kind: 'agent_root_identity_id'; agentRootIdentityId: string }
  | { kind: 'auth_user_id'; authUserId: string }
  | { kind: 'proven_wallet'; provenWalletAddress: string; chain?: WalletChain }
  | { kind: 'agent_card_url'; agentCardUrl: string }
  | { kind: 'erc8004'; networkId: string; identifier: string; verifiedBindingRef?: string }
  | { kind: 'subject_class_hint'; subjectClass: UnsupportedSubjectClass };

export interface CommitmentRef {
  commitmentVersion: 'v1';
  value: string;
}

export interface ConstitutionalAnchorRef {
  kind: 'kybe_identity' | 'agent_root_identity';
  id: string;
}

export type CurrentIdentityPrimitiveRef =
  | { kind: 'root_identity'; id: string; didUri: string | null }
  | { kind: 'agent_root_identity'; id: string; didUri: string | null; coincidesWithAnchor: true }
  | null;

export interface PassportCredentialRef {
  /** T0 — server-internal only. Never serialize further than this object. */
  passportId: string;
  passportClass: string | null;
  usable: boolean;
}

/** T0 throughout — every field is server-internal; never serialize to a browser or a receipt. */
export interface DiDQubePrimitive {
  didqubeId: string;
  subjectClass: DiDQubeSubjectClass;
  lifecycleState: 'active';
  constitutionalAnchor: ConstitutionalAnchorRef;
  currentIdentityPrimitive: CurrentIdentityPrimitiveRef;
  passportCredential: PassportCredentialRef | null;
  publicCommitment: CommitmentRef;
  provenance: { inputKind: DiDQubeResolverInput['kind']; resolvedVia: string };
  trustClass: TrustClass;
}

export type DiDQubeResolution =
  | { state: 'resolved'; primitive: DiDQubePrimitive }
  | { state: 'unresolved'; reason: UnresolvedReason }
  | { state: 'ambiguous'; candidateCount: number }
  | { state: 'conflicted'; detail: string }
  | { state: 'unsupported_subject_class'; subjectClass: UnsupportedSubjectClass };

// ── Entry point ────────────────────────────────────────────────────────────

export async function resolveDiDQube(input: DiDQubeResolverInput): Promise<DiDQubeResolution> {
  if (input.kind === 'subject_class_hint') {
    return { state: 'unsupported_subject_class', subjectClass: input.subjectClass };
  }

  const supabase = getSupabaseServer();
  if (!supabase) return { state: 'unresolved', reason: 'unavailable' };

  switch (input.kind) {
    case 'kybe_identity_id':
      return buildHumanPrimitive(supabase, input.kybeIdentityId, {
        trustClass: 'server_derived',
        inputKind: input.kind,
        resolvedVia: 'direct kybe_identity_id (server-internal caller only)',
      });

    case 'agent_root_identity_id':
      return buildAgentPrimitive(supabase, input.agentRootIdentityId, {
        trustClass: 'server_derived',
        inputKind: input.kind,
        resolvedVia: 'direct agent_root_identity_id (server-internal caller only)',
      });

    case 'auth_user_id': {
      const root = await resolveRootPrincipalForAuthUser(input.authUserId);
      if (!root.ok) {
        return { state: 'unresolved', reason: root.reason === 'unavailable' ? 'unavailable' : 'lineage_incomplete' };
      }
      return buildHumanPrimitive(supabase, root.kybeId, {
        trustClass: 'server_derived',
        inputKind: input.kind,
        resolvedVia: 'auth_user_id → resolveRootPrincipalForAuthUser (composed, not re-derived)',
        preferredRootIdentityId: root.rootIdentityId,
      });
    }

    case 'proven_wallet': {
      const principal = await resolvePassportPrincipal(input.provenWalletAddress, input.chain ?? 'evm');
      if (!principal.ok) {
        return { state: 'unresolved', reason: mapWalletFailureReason(principal.reason) };
      }
      return buildHumanPrimitive(supabase, principal.principal.kybeId, {
        trustClass: 'proven_control',
        inputKind: input.kind,
        resolvedVia: 'proven_wallet → resolvePassportPrincipal (composed, not re-derived)',
        preferredRootIdentityId: principal.principal.rootIdentityId,
      });
    }

    case 'agent_card_url': {
      const { data, error } = await supabase
        .from('agent_root_identity')
        .select('id')
        .eq('agent_card_url', input.agentCardUrl)
        .limit(2);
      if (error) return { state: 'unresolved', reason: 'unavailable' };
      const rows = (data ?? []) as Array<{ id: string }>;
      if (rows.length === 0) return { state: 'unresolved', reason: 'anchor_absent' };
      if (rows.length > 1) return { state: 'ambiguous', candidateCount: rows.length };
      return buildAgentPrimitive(supabase, rows[0].id, {
        trustClass: 'discovery',
        inputKind: input.kind,
        resolvedVia:
          'agent_card_url discovery lookup — never constitutional authority alone (ruling #7)',
      });
    }

    case 'erc8004': {
      // No ERC-8004 binding store exists yet in this codebase (verified against
      // the Phase 0 inventory, not assumed). Accepted for forward compatibility
      // with the resolver's public contract; always unqualified until a real
      // verified-binding store exists to check `verifiedBindingRef` against.
      if (!input.verifiedBindingRef) {
        return { state: 'unresolved', reason: 'unqualified_reference' };
      }
      return { state: 'unresolved', reason: 'unqualified_reference' };
    }

    default:
      return { state: 'unresolved', reason: 'anchor_absent' };
  }
}

// ── Binding creation — the ONE write path this module exposes ────────────────
//
// resolveDiDQube itself stays pure/read-only (module doc above). Phase 4
// consumers (starting with Factor, 2026-09-07) need a way to complete a
// binding for an agent_root_identity row that predates this consumer's own
// integration, or that a consumer just minted itself — this is that one,
// narrow, idempotent write path. It NEVER creates the anchor row itself
// (agent_root_identity), never touches human bindings (those arise from
// kybe_identity's own process, out of scope here), and is the ONLY place
// outside the Phase 0 one-time backfill script
// (scripts/didqube-phase1-backfill.mjs) that writes a didqubes/
// agent_didqubes row — every future consumer must call this, never insert
// directly (Extend, Don't Duplicate — inv.engineering.036/037).

export type EnsureAgentDiDQubeBindingResult =
  | { ok: true; didqubeId: string; created: boolean }
  | { ok: false; error: string };

/**
 * Idempotent: if a binding already exists for this anchor, returns it
 * unchanged. Requires the anchor row to already exist — never manufactures
 * one. A race between the existence check and the insert (two concurrent
 * callers binding the same anchor) is resolved by re-reading after a failed
 * insert rather than assuming failure — the migration's own UNIQUE
 * constraint on `agent_root_identity_id` is what actually prevents a
 * duplicate; this just makes losing that race a normal, non-error outcome
 * for the caller that lost it.
 */
export async function ensureAgentDiDQubeBinding(
  agentRootIdentityId: string,
): Promise<EnsureAgentDiDQubeBindingResult> {
  const supabase = getSupabaseServer();
  if (!supabase) return { ok: false, error: 'Supabase configuration missing' };

  const { data: existing, error: existingErr } = await supabase
    .from('agent_didqubes')
    .select('didqube_id')
    .eq('agent_root_identity_id', agentRootIdentityId)
    .maybeSingle();
  if (existingErr) return { ok: false, error: existingErr.message };
  if (existing) {
    return { ok: true, didqubeId: (existing as { didqube_id: string }).didqube_id, created: false };
  }

  const { data: anchorRow, error: anchorErr } = await supabase
    .from('agent_root_identity')
    .select('id')
    .eq('id', agentRootIdentityId)
    .maybeSingle();
  if (anchorErr) return { ok: false, error: anchorErr.message };
  if (!anchorRow) return { ok: false, error: `agent_root_identity ${agentRootIdentityId} does not exist` };

  const { data: didqubeRow, error: didqubeErr } = await supabase
    .from('didqubes')
    .insert({ subject_class: 'agent' })
    .select('didqube_id')
    .single();
  if (didqubeErr) return { ok: false, error: didqubeErr.message };
  const didqubeId = (didqubeRow as { didqube_id: string }).didqube_id;

  const { error: bindErr } = await supabase
    .from('agent_didqubes')
    .insert({ didqube_id: didqubeId, agent_root_identity_id: agentRootIdentityId });
  if (bindErr) {
    // Lost a concurrent race — re-check rather than assume failure. The
    // freshly-inserted didqubes row above becomes a harmless orphan in this
    // case (never referenced, never surfaced by the resolver, which only
    // ever reaches a didqubes row via a subtype binding).
    const { data: raced } = await supabase
      .from('agent_didqubes')
      .select('didqube_id')
      .eq('agent_root_identity_id', agentRootIdentityId)
      .maybeSingle();
    if (raced) return { ok: true, didqubeId: (raced as { didqube_id: string }).didqube_id, created: false };
    return { ok: false, error: bindErr.message };
  }
  return { ok: true, didqubeId, created: true };
}

function mapWalletFailureReason(reason: PrincipalFailure): UnresolvedReason {
  switch (reason) {
    case 'wallet_unknown':
      return 'anchor_absent';
    case 'lineage_incomplete':
    case 'principal_unprovisioned':
      return 'lineage_incomplete';
    case 'no_passport':
    case 'passport_inactive':
      return 'passport_gate_unmet';
    case 'unavailable':
    default:
      return 'unavailable';
  }
}

// ── Direct DiDQube inspection — stable-container model, LITERAL (no traversal) ──
//
// A DiDQube is the permanent constitutional container. RootDID, VC, Passport,
// and public-commitment rotation must never supersede it. This resolver
// inspects EXACTLY the one `didqubes` row the anchor's own subtype binding
// points to — it never dereferences `superseded_by`, never looks up a
// successor, and never walks anything. An `active` row resolves, in place. A
// `superseded` row is `unresolved`/`superseded_unreconciled` (or `conflicted`
// if the row itself is malformed — see below): the identity does not move to
// a different didqube_id, constitutional-anchor-verified or not. A real
// reconciliation mechanism for a genuinely-superseded subject is a separate,
// deliberately-designed capability this resolver does not implement.

interface DirectResolution {
  didqubeId: string;
  subjectClass: DiDQubeSubjectClass;
}

type DirectOutcome =
  | { ok: true; resolution: DirectResolution }
  | { ok: false; state: 'conflicted'; detail: string }
  | { ok: false; state: 'unresolved'; reason: UnresolvedReason };

/**
 * Inspects exactly the one `didqubes` row `didqubeId` names — no traversal,
 * no successor lookup, no `superseded_by` dereference. Malformed data (no
 * row, subject_class mismatch, an unrecognised lifecycle_state, or a
 * `superseded` row with no `superseded_by` recorded at all) is `conflicted` —
 * a diagnostic signal for historical data inspection, never a path to a
 * resolved primitive. A well-formed `superseded` row is `unresolved`/
 * `superseded_unreconciled`, not `conflicted` — it is not a data defect, it is
 * a valid, currently-unhandled constitutional state.
 */
async function resolveDirectDiDQube(
  supabase: SupabaseLike,
  didqubeId: string,
  expectedSubjectClass: DiDQubeSubjectClass,
): Promise<DirectOutcome> {
  const { data, error } = await supabase
    .from('didqubes')
    .select('subject_class, lifecycle_state, superseded_by')
    .eq('didqube_id', didqubeId)
    .maybeSingle();
  if (error) return { ok: false, state: 'unresolved', reason: 'unavailable' };
  if (!data) {
    return {
      ok: false,
      state: 'conflicted',
      detail: `didqube_id ${didqubeId} is referenced by a subtype binding but has no didqubes row`,
    };
  }

  const row = data as { subject_class: string; lifecycle_state: string; superseded_by: string | null };
  if (row.subject_class !== expectedSubjectClass) {
    return {
      ok: false,
      state: 'conflicted',
      detail: `didqube_id ${didqubeId} has subject_class '${row.subject_class}', not the expected '${expectedSubjectClass}'`,
    };
  }
  if (row.lifecycle_state === 'active') {
    return { ok: true, resolution: { didqubeId, subjectClass: expectedSubjectClass } };
  }
  if (row.lifecycle_state === 'superseded') {
    // Diagnostic only: a superseded row recording no successor at all is
    // malformed historical data, distinct from the normal (well-formed)
    // superseded case below. Neither case is traversed into.
    if (!row.superseded_by) {
      return {
        ok: false,
        state: 'conflicted',
        detail: `didqube_id ${didqubeId} is marked superseded but records no superseded_by successor`,
      };
    }
    return { ok: false, state: 'unresolved', reason: 'superseded_unreconciled' };
  }
  return { ok: false, state: 'conflicted', detail: `didqube_id ${didqubeId} has an unrecognised lifecycle_state '${row.lifecycle_state}'` };
}

/** Defensive cross-check: the SAME didqube_id must never hold a binding in the OTHER subtype table. */
async function crossCheckNotBoundInOtherSubtype(
  supabase: SupabaseLike,
  didqubeId: string,
  otherTable: 'human_didqubes' | 'agent_didqubes',
): Promise<{ ok: true } | { ok: false; detail: string }> {
  const { data, error } = await supabase.from(otherTable).select('didqube_id').eq('didqube_id', didqubeId).maybeSingle();
  if (error) return { ok: false, detail: `unable to cross-check ${otherTable} for didqube_id ${didqubeId}: ${error.message}` };
  if (data) {
    return { ok: false, detail: `didqube_id ${didqubeId} is bound in BOTH human_didqubes and agent_didqubes` };
  }
  return { ok: true };
}

// ── Human primitive ────────────────────────────────────────────────────────

interface BuildOpts {
  trustClass: TrustClass;
  inputKind: DiDQubeResolverInput['kind'];
  resolvedVia: string;
  preferredRootIdentityId?: string;
}

async function buildHumanPrimitive(supabase: SupabaseLike, kybeIdentityId: string, opts: BuildOpts): Promise<DiDQubeResolution> {
  const { data: bindingRows, error: bindingErr } = await supabase
    .from('human_didqubes')
    .select('didqube_id')
    .eq('kybe_identity_id', kybeIdentityId)
    .limit(2);
  if (bindingErr) return { state: 'unresolved', reason: 'unavailable' };
  const bindings = (bindingRows ?? []) as Array<{ didqube_id: string }>;
  if (bindings.length === 0) return { state: 'unresolved', reason: 'anchor_absent' };
  if (bindings.length > 1) return { state: 'ambiguous', candidateCount: bindings.length };

  const directResult = await resolveDirectDiDQube(supabase, bindings[0].didqube_id, 'natural_person');
  if (!directResult.ok) {
    return directResult.state === 'conflicted'
      ? { state: 'conflicted', detail: directResult.detail }
      : { state: 'unresolved', reason: directResult.reason };
  }
  const crossCheck = await crossCheckNotBoundInOtherSubtype(supabase, directResult.resolution.didqubeId, 'agent_didqubes');
  if (!crossCheck.ok) return { state: 'conflicted', detail: crossCheck.detail };

  // Constitutional anchor's own public DID material — required for the commitment.
  const { data: kybeRow, error: kybeErr } = await supabase
    .from('kybe_identity')
    .select('kybe_did')
    .eq('id', kybeIdentityId)
    .maybeSingle();
  if (kybeErr) return { state: 'unresolved', reason: 'unavailable' };
  const kybeDid = (kybeRow as { kybe_did?: string } | null)?.kybe_did;
  if (!kybeDid) {
    return { state: 'conflicted', detail: `kybe_identity ${kybeIdentityId} carries no kybe_did — constitutional anchor is missing its public DID material` };
  }

  // Current reissuable identity primitive — the specific root already resolved
  // by the caller's own walk if supplied, else the most recently created root
  // under this kybe. Absence is not a resolution failure (ruling #2: a human
  // DiDQube is established by kybe_identity alone).
  let currentIdentityPrimitive: CurrentIdentityPrimitiveRef = null;
  if (opts.preferredRootIdentityId) {
    const { data: rootRow, error: rootErr } = await supabase
      .from('root_identity')
      .select('id, did_uri')
      .eq('id', opts.preferredRootIdentityId)
      .maybeSingle();
    if (rootErr) return { state: 'unresolved', reason: 'unavailable' };
    if (rootRow) {
      const r = rootRow as { id: string; did_uri: string | null };
      currentIdentityPrimitive = { kind: 'root_identity', id: r.id, didUri: r.did_uri ?? null };
    }
  } else {
    const { data: rootRows, error: rootErr } = await supabase
      .from('root_identity')
      .select('id, did_uri, created_at')
      .eq('kybe_id', kybeIdentityId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (rootErr) return { state: 'unresolved', reason: 'unavailable' };
    const latest = (rootRows ?? [])[0] as { id: string; did_uri: string | null } | undefined;
    if (latest) currentIdentityPrimitive = { kind: 'root_identity', id: latest.id, didUri: latest.did_uri ?? null };
  }

  const passportCredential = await lookupHumanPassportCredential(supabase, kybeIdentityId);
  if (passportCredential === 'unavailable') return { state: 'unresolved', reason: 'unavailable' };

  return {
    state: 'resolved',
    primitive: {
      didqubeId: directResult.resolution.didqubeId,
      subjectClass: 'natural_person',
      lifecycleState: 'active',
      constitutionalAnchor: { kind: 'kybe_identity', id: kybeIdentityId },
      currentIdentityPrimitive,
      passportCredential,
      publicCommitment: { commitmentVersion: 'v1', value: didPublicRef(kybeDid) },
      provenance: { inputKind: opts.inputKind, resolvedVia: opts.resolvedVia },
      trustClass: opts.trustClass,
    },
  };
}

async function lookupHumanPassportCredential(
  supabase: SupabaseLike,
  kybeIdentityId: string,
): Promise<PassportCredentialRef | null | 'unavailable'> {
  const { data, error } = await supabase
    .from('polity_passport_records')
    .select('passport_id, passport_class, citizen_status, participant_status, passport_grade, revoked, expires_at')
    .eq('kybe_identity_id', kybeIdentityId)
    .order('issued_at', { ascending: false })
    .limit(5);
  if (error) return 'unavailable';
  const rows = (data ?? []) as Array<{
    passport_id: string;
    passport_class: string | null;
    citizen_status: string | null;
    participant_status: string | null;
    passport_grade: string | null;
    revoked: boolean;
    expires_at: string | null;
  }>;
  if (rows.length === 0) return null;

  const toSnapshot = (r: (typeof rows)[number]): PassportSnapshot => ({
    passportClass: r.passport_class,
    citizenStatus: r.citizen_status,
    participantStatus: r.participant_status,
    passportGrade: r.passport_grade,
    revoked: Boolean(r.revoked),
    expiresAt: r.expires_at,
  });
  const chosen = rows.find((r) => isPassportUsable(toSnapshot(r))) ?? rows[0];
  return { passportId: chosen.passport_id, passportClass: chosen.passport_class, usable: isPassportUsable(toSnapshot(chosen)) };
}

// ── Agent primitive ─────────────────────────────────────────────────────────

async function buildAgentPrimitive(supabase: SupabaseLike, agentRootIdentityId: string, opts: BuildOpts): Promise<DiDQubeResolution> {
  const { data: bindingRows, error: bindingErr } = await supabase
    .from('agent_didqubes')
    .select('didqube_id')
    .eq('agent_root_identity_id', agentRootIdentityId)
    .limit(2);
  if (bindingErr) return { state: 'unresolved', reason: 'unavailable' };
  const bindings = (bindingRows ?? []) as Array<{ didqube_id: string }>;
  if (bindings.length === 0) return { state: 'unresolved', reason: 'anchor_absent' };
  if (bindings.length > 1) return { state: 'ambiguous', candidateCount: bindings.length };

  const directResult = await resolveDirectDiDQube(supabase, bindings[0].didqube_id, 'agent');
  if (!directResult.ok) {
    return directResult.state === 'conflicted'
      ? { state: 'conflicted', detail: directResult.detail }
      : { state: 'unresolved', reason: directResult.reason };
  }
  const crossCheck = await crossCheckNotBoundInOtherSubtype(supabase, directResult.resolution.didqubeId, 'human_didqubes');
  if (!crossCheck.ok) return { state: 'conflicted', detail: crossCheck.detail };

  const { data: agentRow, error: agentErr } = await supabase
    .from('agent_root_identity')
    .select('did_uri, bound_passport_id')
    .eq('id', agentRootIdentityId)
    .maybeSingle();
  if (agentErr) return { state: 'unresolved', reason: 'unavailable' };
  const agent = agentRow as { did_uri: string | null; bound_passport_id: string | null } | null;
  if (!agent) {
    return { state: 'conflicted', detail: `agent_root_identity ${agentRootIdentityId} has a didqube binding but no longer exists as a row` };
  }
  if (!agent.did_uri) {
    return { state: 'conflicted', detail: `agent_root_identity ${agentRootIdentityId} carries no did_uri — constitutional anchor is missing its public DID material` };
  }

  let passportCredential: PassportCredentialRef | null = null;
  if (agent.bound_passport_id) {
    const { data: passportRow, error: passportErr } = await supabase
      .from('polity_passport_records')
      .select('passport_id, passport_class, citizen_status, participant_status, passport_grade, revoked, expires_at')
      .eq('passport_id', agent.bound_passport_id)
      .maybeSingle();
    if (passportErr) return { state: 'unresolved', reason: 'unavailable' };
    if (passportRow) {
      const p = passportRow as {
        passport_id: string;
        passport_class: string | null;
        citizen_status: string | null;
        participant_status: string | null;
        passport_grade: string | null;
        revoked: boolean;
        expires_at: string | null;
      };
      const snapshot: PassportSnapshot = {
        passportClass: p.passport_class,
        citizenStatus: p.citizen_status,
        participantStatus: p.participant_status,
        passportGrade: p.passport_grade,
        revoked: Boolean(p.revoked),
        expiresAt: p.expires_at,
      };
      passportCredential = { passportId: p.passport_id, passportClass: p.passport_class, usable: isPassportUsable(snapshot) };
    }
  }

  return {
    state: 'resolved',
    primitive: {
      didqubeId: directResult.resolution.didqubeId,
      subjectClass: 'agent',
      lifecycleState: 'active',
      constitutionalAnchor: { kind: 'agent_root_identity', id: agentRootIdentityId },
      // Phase 1 has no separate reissuable layer for agents — the anchor IS
      // the current identity primitive. Stated explicitly, not silently
      // assumed to generalize to a future agent-side reissuance mechanism.
      currentIdentityPrimitive: { kind: 'agent_root_identity', id: agentRootIdentityId, didUri: agent.did_uri, coincidesWithAnchor: true },
      passportCredential,
      publicCommitment: { commitmentVersion: 'v1', value: didPublicRef(agent.did_uri) },
      provenance: { inputKind: opts.inputKind, resolvedVia: opts.resolvedVia },
      trustClass: opts.trustClass,
    },
  };
}
