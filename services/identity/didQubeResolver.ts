/**
 * didQubeResolver — the canonical DiDQube resolver (Phase 2, operator-approved 2026-09-07).
 *
 * Pure, read-only, non-authoritative. It projects the Phase 1 supertype tables
 * (`didqubes`/`human_didqubes`/`agent_didqubes` — see
 * `supabase/migrations/20260930270000_didqube_canonical_supertype.sql`) into a
 * typed resolution; it writes nothing, anchors nothing, and issues nothing.
 * NO consumer (Passport, Factor, Aegis, CTP, DCIR, Standing, Registry/Horizen,
 * DVN) calls this yet — that is Phase 4, deliberately not started here.
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
 * ── Stable-container model for supersession (operator correction, 2026-09-07) ─
 *
 * A DiDQube is the permanent constitutional container — it is NOT superseded
 * merely because a RootDID, VC, or public commitment rotates beneath it. This
 * resolver does not follow `lifecycle_state = 'superseded'` chains on the
 * strength of the `superseded_by` column alone: a successor is honored only
 * when it is independently verified to bind the SAME constitutional anchor
 * (the identical `kybe_identity`/`agent_root_identity` row), never merely a
 * matching `subject_class` (a different subject can share a subject_class).
 * An earlier version of this module traversed `superseded_by` unconditionally
 * and could in principle have carried one subject's identity onto an
 * unrelated successor container that merely happened to exist — corrected
 * before Phase 2.5, see the Phase 2 completion record's disclosed-issue
 * section. Depth is still bounded and cycles still fail closed, but bounded
 * depth alone is not the safety property here — anchor-verified continuity
 * is. See `resolveActiveDiDQubeChain`/`verifyBoundToAnchor` below.
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

// ── Shared chain resolution (stable-container model, defensively cross-checked) ──
//
// STABLE-CONTAINER MODEL (operator ruling, 2026-09-07 correction): a DiDQube is the
// permanent constitutional container. It is never superseded merely because a
// RootDID, VC, or public commitment rotates beneath it — this resolver does not
// traverse `superseded_by` on the strength of the DB row alone. A `superseded`
// didqube may resolve to its successor ONLY when the successor is demonstrably
// bound to the SAME constitutional anchor (the same `kybe_identity`/
// `agent_root_identity` row) as the one the caller is resolving — the narrow
// "the constitutional subject itself is being reconciled" exception, never a
// silent identity transfer to a different subject that happens to share a
// subject_class. Matching `subject_class` alone is explicitly NOT sufficient
// (a different human's DiDQube is also 'natural_person'); the anchor id itself
// must match. No atomic "transfer the anchor to the successor" DB operation
// exists (the container-successor model, rejected here) — this resolver only
// verifies an already-consistent anchor binding, it never establishes one.

interface ActiveChainResult {
  didqubeId: string;
  subjectClass: DiDQubeSubjectClass;
}

type ChainOutcome =
  | { ok: true; chain: ActiveChainResult }
  | { ok: false; state: 'conflicted'; detail: string }
  | { ok: false; state: 'unresolved'; reason: UnresolvedReason };

interface AnchorContext {
  subtypeTable: 'human_didqubes' | 'agent_didqubes';
  anchorColumn: 'kybe_identity_id' | 'agent_root_identity_id';
  anchorId: string;
  expectedSubjectClass: DiDQubeSubjectClass;
}

const MAX_SUPERSESSION_HOPS = 10;

/** 'ok' only when the didqube is bound, in the given subtype table, to EXACTLY the expected anchor id. */
async function verifyBoundToAnchor(
  supabase: SupabaseLike,
  anchor: AnchorContext,
  didqubeId: string,
): Promise<'ok' | 'absent' | 'different_anchor' | 'unavailable'> {
  const { data, error } = await supabase
    .from(anchor.subtypeTable)
    .select(anchor.anchorColumn)
    .eq('didqube_id', didqubeId)
    .maybeSingle();
  if (error) return 'unavailable';
  if (!data) return 'absent';
  const boundAnchorId = (data as Record<string, string | null>)[anchor.anchorColumn];
  if (boundAnchorId !== anchor.anchorId) return 'different_anchor';
  return 'ok';
}

async function resolveActiveDiDQubeChain(supabase: SupabaseLike, startDidqubeId: string, anchor: AnchorContext): Promise<ChainOutcome> {
  const visited = new Set<string>();
  let current = startDidqubeId;

  for (let hop = 0; hop <= MAX_SUPERSESSION_HOPS; hop += 1) {
    if (visited.has(current)) {
      return { ok: false, state: 'conflicted', detail: `supersession cycle detected at didqube_id ${current}` };
    }
    visited.add(current);

    // Every hop beyond the starting didqube is a claimed successor, reached only
    // via `superseded_by` — never trusted until it is shown to bind the SAME
    // anchor the caller is resolving. The starting didqube needs no such check:
    // the caller already found it by querying the anchor's own subtype binding.
    if (current !== startDidqubeId) {
      const bound = await verifyBoundToAnchor(supabase, anchor, current);
      if (bound === 'unavailable') return { ok: false, state: 'unresolved', reason: 'unavailable' };
      if (bound === 'absent') {
        return {
          ok: false,
          state: 'conflicted',
          detail: `successor didqube_id ${current} (reached via supersession from ${startDidqubeId}) has no ${anchor.subtypeTable} binding — cannot verify constitutional-anchor continuity, so the supersession is not honored (stable-container model)`,
        };
      }
      if (bound === 'different_anchor') {
        return {
          ok: false,
          state: 'conflicted',
          detail: `successor didqube_id ${current} (reached via supersession from ${startDidqubeId}) is bound to a DIFFERENT ${anchor.anchorColumn}, not ${anchor.anchorId} — a superseded DiDQube's identity never transfers to a container bound to a different constitutional anchor, even when subject_class matches`,
        };
      }
    }

    const { data, error } = await supabase
      .from('didqubes')
      .select('subject_class, lifecycle_state, superseded_by')
      .eq('didqube_id', current)
      .maybeSingle();
    if (error) return { ok: false, state: 'unresolved', reason: 'unavailable' };
    if (!data) {
      return {
        ok: false,
        state: 'conflicted',
        detail: `didqube_id ${current} is referenced by a subtype binding but has no didqubes row`,
      };
    }

    const row = data as { subject_class: string; lifecycle_state: string; superseded_by: string | null };
    if (row.subject_class !== anchor.expectedSubjectClass) {
      return {
        ok: false,
        state: 'conflicted',
        detail: `didqube_id ${current} has subject_class '${row.subject_class}', not the expected '${anchor.expectedSubjectClass}'`,
      };
    }
    if (row.lifecycle_state === 'active') {
      return { ok: true, chain: { didqubeId: current, subjectClass: anchor.expectedSubjectClass } };
    }
    if (row.lifecycle_state === 'superseded') {
      if (!row.superseded_by) {
        return {
          ok: false,
          state: 'conflicted',
          detail: `didqube_id ${current} is marked superseded but records no superseded_by successor`,
        };
      }
      current = row.superseded_by;
      continue;
    }
    return { ok: false, state: 'conflicted', detail: `didqube_id ${current} has an unrecognised lifecycle_state '${row.lifecycle_state}'` };
  }

  return { ok: false, state: 'conflicted', detail: `supersession chain from ${startDidqubeId} exceeds ${MAX_SUPERSESSION_HOPS} hops` };
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

  const chainResult = await resolveActiveDiDQubeChain(supabase, bindings[0].didqube_id, {
    subtypeTable: 'human_didqubes',
    anchorColumn: 'kybe_identity_id',
    anchorId: kybeIdentityId,
    expectedSubjectClass: 'natural_person',
  });
  if (!chainResult.ok) {
    return chainResult.state === 'conflicted'
      ? { state: 'conflicted', detail: chainResult.detail }
      : { state: 'unresolved', reason: chainResult.reason };
  }
  const crossCheck = await crossCheckNotBoundInOtherSubtype(supabase, chainResult.chain.didqubeId, 'agent_didqubes');
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
      didqubeId: chainResult.chain.didqubeId,
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

  const chainResult = await resolveActiveDiDQubeChain(supabase, bindings[0].didqube_id, {
    subtypeTable: 'agent_didqubes',
    anchorColumn: 'agent_root_identity_id',
    anchorId: agentRootIdentityId,
    expectedSubjectClass: 'agent',
  });
  if (!chainResult.ok) {
    return chainResult.state === 'conflicted'
      ? { state: 'conflicted', detail: chainResult.detail }
      : { state: 'unresolved', reason: chainResult.reason };
  }
  const crossCheck = await crossCheckNotBoundInOtherSubtype(supabase, chainResult.chain.didqubeId, 'human_didqubes');
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
      didqubeId: chainResult.chain.didqubeId,
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
