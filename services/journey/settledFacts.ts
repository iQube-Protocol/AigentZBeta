/**
 * Settled facts — pre-paid reasoning.
 *
 * ── THE OPERATOR'S RULING (2026-08-03), verbatim ──────────────────────────
 *
 *   > "It's already been reasoned. Why is it re-reasoning again as to whether
 *   >  Nakamoto is registered or not? That's an invariant now. It's proven,
 *   >  we have the proof, it's been registered. … It's exactly the same thing
 *   >  we're talking about with the LLMs constantly re-reasoning over facts
 *   >  that have already been established, and then diverging because it's
 *   >  non-deterministic."
 *
 *   > **Settled Fact Non-Reconsideration:** Once a fact has been established
 *   > through the required evidence and constitutional resolution process,
 *   > downstream systems must consume the settled fact rather than
 *   > independently re-deriving it from lower-level evidence.
 *
 * ── WHY THIS MODULE EXISTS ────────────────────────────────────────────────
 *
 * "Aigent Nakamoto is registered on Horizen" was established once: a
 * confirmed transaction, an ERC-8004 tokenId (8798), its registry rendering
 * (0x225e), a persisted binding, an examined proof. It then got re-derived
 * independently by at least five observers — the journey stepper, the Verify
 * gate, the Claim gate, the Register panel's ladder, and the agent-page
 * surface — each mixing receipts, registry reads and UI state differently,
 * and each therefore able to reach a different answer. Every one of those was
 * reported as a separate bug. They were one bug: a settled fact with no
 * settled home, re-litigated at every screen.
 *
 * The architecture the operator specified:
 *
 *   evidence and reasoning -> constitutional resolution -> PERSISTED INVARIANT
 *   -> all later stages consume the invariant
 *
 * NOT:
 *
 *   evidence -> reason -> next screen gathers overlapping evidence -> reason
 *   again -> possibly diverge
 *
 * The first compresses reasoning. The second pays for it repeatedly and
 * introduces fresh risk each time. This module is the "persisted invariant"
 * box.
 *
 * ── WHAT THIS IS NOT ──────────────────────────────────────────────────────
 *
 * It is NOT a cache. A cache is an optimisation whose absence changes only
 * speed, and which may be recomputed at will. A settled fact is the
 * AUTHORITY: recomputing it from lower-level evidence is the defect, not the
 * fallback. The distinction matters because it decides what a downstream
 * observer does when it cannot find supporting evidence — a cache would
 * recompute; a settled fact stands, and the observer records an audit gap.
 *
 *   > "Evidence absence in a downstream observer is not evidence that a
 *   >  settled fact has ceased to be true."
 *
 * ── WHERE IT LIVES ────────────────────────────────────────────────────────
 *
 * In `registry_assets.metadata.settled_facts` — the row that already exists
 * and is already the canonical projection for an AigentQube. Deliberately NOT
 * a new table: the journey is currently blocked on one unapplied migration
 * already, and adding a second prerequisite to fix a continuity problem would
 * increase Time to Repair to buy nothing. If settled facts later outgrow the
 * projection, that is a migration made on its own merits.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The question vocabulary. Deliberately CLOSED: a settled fact whose
 * predicate nobody recognises cannot be consumed, and an open string would
 * let two surfaces settle "the same" fact under two names — the very
 * duplication this module exists to end.
 */
export type SettledPredicate =
  | 'is_registered'
  | 'control_is_proven'
  | 'passport_is_issued'
  | 'delegation_is_granted';

/**
 * Why a settled fact may be reopened. NOTHING ELSE MAY.
 *
 * The operator named these exactly: the binding is revoked; the chain reorgs
 * past the registration; the registry contract proves the token nonexistent;
 * a governed correction supersedes the record; the cryptographic evidence is
 * shown to be invalid.
 *
 * Note what is absent, and absent on purpose: "an observer could not find the
 * receipt", "a reread failed", "a migration is missing", "a later stage
 * errored". Those are evidence gaps and operational faults. Neither is an
 * invalidation event, and treating one as though it were is precisely how a
 * settled fact gets silently reopened.
 */
export type InvalidationEvent =
  | 'binding-revoked'
  | 'chain-reorg-past-registration'
  | 'registry-proves-token-nonexistent'
  | 'governed-correction-supersedes'
  | 'evidence-shown-invalid';

export const INVALIDATION_EVENTS: readonly InvalidationEvent[] = [
  'binding-revoked',
  'chain-reorg-past-registration',
  'registry-proves-token-nonexistent',
  'governed-correction-supersedes',
  'evidence-shown-invalid',
];

export interface SettledFact<T = Record<string, unknown>> {
  /** The agent or entity the fact is about. */
  subject: string;
  predicate: SettledPredicate;
  /** The settled content — e.g. `{ standard, network, tokenId, registryId }`. */
  object: T;
  status: 'settled' | 'invalidated';
  /**
   * What the resolution was based on. AUDIT MATERIAL, not inputs to be
   * re-evaluated: a consumer reads `status`, never re-derives from these.
   */
  evidenceRefs: string[];
  resolvedAt: string;
  /** Who or what performed the constitutional resolution. */
  resolutionAuthority: string;
  /** Prior settlements this one replaces — a supersede chain, never a delete. */
  supersedes: string[];
  /** Set only when `status === 'invalidated'`, and only by a listed event. */
  invalidatedBy?: InvalidationEvent;
  invalidatedAt?: string;
  invalidationDetail?: string;
}

/** The stable key for one (subject, predicate) settlement. */
export function settledFactKey(subject: string, predicate: SettledPredicate): string {
  return `${subject}:${predicate}`;
}

type SettledFactMap = Record<string, SettledFact>;

async function readMap(admin: SupabaseClient, aigentQubeId: string): Promise<SettledFactMap> {
  const { data } = await admin.from('registry_assets').select('metadata').eq('asset_id', aigentQubeId).maybeSingle();
  const facts = (data?.metadata as { settled_facts?: SettledFactMap } | null)?.settled_facts;
  return facts && typeof facts === 'object' ? facts : {};
}

/**
 * Read a settled fact. Returns null when the question has never been settled
 * — which is a DIFFERENT answer from "settled false", and callers must treat
 * it as such: unsettled means "resolve it now, once"; invalidated means "it
 * was true and a listed event ended it".
 */
export async function readSettledFact<T = Record<string, unknown>>(
  admin: SupabaseClient,
  aigentQubeId: string,
  subject: string,
  predicate: SettledPredicate,
): Promise<SettledFact<T> | null> {
  const map = await readMap(admin, aigentQubeId);
  return (map[settledFactKey(subject, predicate)] as SettledFact<T> | undefined) ?? null;
}

/** True only for a fact that is present AND not invalidated. */
export function isSettled(fact: SettledFact | null | undefined): boolean {
  return fact?.status === 'settled';
}

export type SettleResult =
  | { ok: true; fact: SettledFact; alreadySettled: boolean }
  | { ok: false; reason: 'no-write-target' | 'write-failed'; detail: string };

/**
 * Settle a fact ONCE, idempotently.
 *
 * A second settlement of an already-settled (subject, predicate) does NOT
 * overwrite — it returns the existing fact with `alreadySettled: true`. That
 * is what makes this a settlement rather than a cache write: re-running the
 * resolver cannot change an answer that has already been resolved, so two
 * concurrent surfaces racing to settle the same fact cannot produce two
 * different truths. Superseding requires `supersedeSettledFact` and a named
 * authority.
 */
export async function settleFact(
  admin: SupabaseClient,
  aigentQubeId: string,
  input: Omit<SettledFact, 'status' | 'resolvedAt' | 'supersedes'> & { resolvedAt?: string },
): Promise<SettleResult> {
  const { data } = await admin.from('registry_assets').select('metadata').eq('asset_id', aigentQubeId).maybeSingle();
  if (!data) {
    return { ok: false, reason: 'no-write-target', detail: `no registry_assets row for "${aigentQubeId}"` };
  }
  const metadata = (data.metadata as Record<string, unknown> | null) ?? {};
  const map = ((metadata.settled_facts as SettledFactMap | undefined) ?? {}) as SettledFactMap;
  const key = settledFactKey(input.subject, input.predicate);

  const existing = map[key];
  if (existing && existing.status === 'settled') {
    return { ok: true, fact: existing, alreadySettled: true };
  }

  const fact: SettledFact = {
    subject: input.subject,
    predicate: input.predicate,
    object: input.object,
    status: 'settled',
    evidenceRefs: input.evidenceRefs,
    resolvedAt: input.resolvedAt ?? new Date().toISOString(),
    resolutionAuthority: input.resolutionAuthority,
    // An invalidated prior settlement is superseded, never erased.
    supersedes: existing ? [`${key}@${existing.resolvedAt}`] : [],
  };

  const { error } = await admin
    .from('registry_assets')
    .update({ metadata: { ...metadata, settled_facts: { ...map, [key]: fact } } })
    .eq('asset_id', aigentQubeId);
  if (error) {
    /*
     * NAMED, NOT SWALLOWED. `updateRegistryAssetBinding` had three silent
     * return points and a discarded `.update()` error — it "succeeded" while
     * writing nothing, and every reader downstream was eventually wrong
     * (RES-2026-08-03-HORIZEN-OBSERVER-RECONCILIATION-001). A settlement that
     * did not persist must say so.
     */
    console.error('[SETTLED FACT] failed to persist', { aigentQubeId, key, error: error.message });
    return { ok: false, reason: 'write-failed', detail: error.message };
  }
  return { ok: true, fact, alreadySettled: false };
}

/**
 * Reopen a settled fact — ONLY via a listed invalidation event.
 *
 * There is no other way to un-settle something, and that is the point. A
 * downstream observer that cannot find its evidence has an evidence gap; it
 * has no standing to call this.
 */
export async function invalidateSettledFact(
  admin: SupabaseClient,
  aigentQubeId: string,
  subject: string,
  predicate: SettledPredicate,
  event: InvalidationEvent,
  detail: string,
  authority: string,
): Promise<SettleResult> {
  const { data } = await admin.from('registry_assets').select('metadata').eq('asset_id', aigentQubeId).maybeSingle();
  if (!data) return { ok: false, reason: 'no-write-target', detail: `no registry_assets row for "${aigentQubeId}"` };

  const metadata = (data.metadata as Record<string, unknown> | null) ?? {};
  const map = ((metadata.settled_facts as SettledFactMap | undefined) ?? {}) as SettledFactMap;
  const key = settledFactKey(subject, predicate);
  const existing = map[key];
  if (!existing) {
    return { ok: false, reason: 'write-failed', detail: `nothing settled at "${key}" to invalidate` };
  }

  const invalidated: SettledFact = {
    ...existing,
    status: 'invalidated',
    invalidatedBy: event,
    invalidatedAt: new Date().toISOString(),
    invalidationDetail: detail,
    resolutionAuthority: authority,
  };
  const { error } = await admin
    .from('registry_assets')
    .update({ metadata: { ...metadata, settled_facts: { ...map, [key]: invalidated } } })
    .eq('asset_id', aigentQubeId);
  if (error) {
    console.error('[SETTLED FACT] failed to invalidate', { aigentQubeId, key, error: error.message });
    return { ok: false, reason: 'write-failed', detail: error.message };
  }
  return { ok: true, fact: invalidated, alreadySettled: false };
}
