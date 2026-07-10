/**
 * Constitutional Presence — the live per-delegate scorer for the Homecoming Test
 * (CFS-023). For each named delegate it reads the REAL platform tables and
 * resolves the highest CONTIGUOUS rung of the Constitutional Presence ladder
 * (L0 card → L5 operationally sovereign, types/homecoming.ts).
 *
 * Discipline mirrors the Chrysalis Test (app/api/constitutional/chrysalis-test):
 * every read is best-effort and independent; a query that fails degrades ONE
 * rung to `pending` (honest — "could not determine"), never fakes a rung green
 * and never throws. `pending` stops the contiguous climb exactly like a genuine
 * gap, so a delegate is never credited with a rung above an undetermined one.
 *
 * The ladder→signal mapping is the charter's (PRESENCE_SIGNAL): each rung is
 * proven by a real artifact — an agent_root_identity seed, an agent_persona, an
 * active bounded-delegation grant with the right scope, an issued passport.
 *
 * Server-only (reads Supabase). The rung ASSEMBLY + summary are pure and
 * canary-tested; only the table reads are impure.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  CONSTITUTIONAL_PRESENCE_LADDER,
  DELEGATE_CHARTER_STATUS,
  HOMECOMING_DELEGATES,
  PRESENCE_SIGNAL,
  presenceLevelIndex,
  resolvePresenceLevel,
  type DelegateCharterStatus,
  type HomecomingDelegateId,
  type PresenceLevel,
} from '@/types/homecoming';

type SupabaseServer = NonNullable<ReturnType<typeof getSupabaseServer>>;

/** A per-rung outcome. `pending` = could not determine (read failed / not wired). */
export type RungStatus = 'reached' | 'not-reached' | 'pending';

export interface RungAssessment {
  level: PresenceLevel;
  index: number;
  status: RungStatus;
  evidence: string;
}

export interface DelegatePresence {
  delegate: HomecomingDelegateId;
  agentClass: string;
  charterStatus: DelegateCharterStatus;
  /** Highest CONTIGUOUS rung reached, or null (below L0 — conceptual). */
  presenceLevel: PresenceLevel | null;
  presenceIndex: number; // -1 when null
  rungs: RungAssessment[];
}

export interface HomecomingPresenceReport {
  delegates: DelegatePresence[];
  summary: {
    total: number;
    present: number; // at or above L0
    reasoning: number; // at or above L2 (reasoning connected)
    sovereign: number; // at L5
    conceptual: number; // below L0
  };
}

/**
 * The DB identity of each delegate, keyed by `agent_card_slug` — the stable,
 * UNIQUE business key. This matters: a legacy-seeded row has agent_id === slug
 * (e.g. `know1`), but a GENESIS-created row (sponsorPolityAgent) has agent_id
 * `polity-bound:<slug>` while its slug lives in agent_card_slug. Keying on the
 * slug recognises both, so a delegate stood up via genesis (Agent Homecoming)
 * registers correctly. `handCuratedCard` marks a delegate with a published Agent
 * Card ROUTE but no DB seed yet (Aletheon — the archetype/first-mover).
 */
const DELEGATE_DB: Record<HomecomingDelegateId, { slug: string; handCuratedCard: boolean }> = {
  'aigent-z': { slug: 'aigent-z', handCuratedCard: false },
  marketa: { slug: 'marketa', handCuratedCard: false },
  kn0w1: { slug: 'know1', handCuratedCard: false },
  aletheon: { slug: 'aletheon', handCuratedCard: true },
  moneypenny: { slug: 'moneypenny', handCuratedCard: false },
  nakamoto: { slug: 'nakamoto', handCuratedCard: false },
};

// ─── Pure assembly + summary (deterministic — canary-tested) ─────────────────

/**
 * Assemble the ordered rung list from resolved per-rung statuses, and derive the
 * contiguous presence level. A `pending` rung is NOT satisfied for the purpose of
 * the climb (honest: undetermined ≠ reached). Pure.
 */
export function assembleRungs(statuses: Partial<Record<PresenceLevel, RungStatus>>): {
  rungs: RungAssessment[];
  presenceLevel: PresenceLevel | null;
  presenceIndex: number;
} {
  const rungs: RungAssessment[] = CONSTITUTIONAL_PRESENCE_LADDER.map((level) => {
    const status = statuses[level] ?? 'pending';
    return {
      level,
      index: PRESENCE_SIGNAL[level].level,
      status,
      evidence: status === 'reached' ? PRESENCE_SIGNAL[level].proof : `not observed — ${PRESENCE_SIGNAL[level].proof}`,
    };
  });
  const satisfied: Partial<Record<PresenceLevel, boolean>> = {};
  for (const level of CONSTITUTIONAL_PRESENCE_LADDER) satisfied[level] = statuses[level] === 'reached';
  const presenceLevel = resolvePresenceLevel(satisfied);
  return { rungs, presenceLevel, presenceIndex: presenceLevel ? presenceLevelIndex(presenceLevel) : -1 };
}

/** Summarise a set of delegate presences. Pure. */
export function summarizePresence(delegates: DelegatePresence[]): HomecomingPresenceReport['summary'] {
  const atLeast = (d: DelegatePresence, n: number) => d.presenceIndex >= n;
  return {
    total: delegates.length,
    present: delegates.filter((d) => atLeast(d, 0)).length,
    reasoning: delegates.filter((d) => atLeast(d, 2)).length,
    sovereign: delegates.filter((d) => atLeast(d, 5)).length,
    conceptual: delegates.filter((d) => d.presenceIndex < 0).length,
  };
}

// ─── Impure signal reads (best-effort; degrade to `pending`) ─────────────────

/** A read that distinguishes a genuine failure (`ok:false` → pending) from an
 *  empty result (`ok:true, data:null` → honestly absent). */
type ReadResult<T> = { ok: true; data: T } | { ok: false };
async function tryRead<T>(fn: () => Promise<T>): Promise<ReadResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch {
    return { ok: false };
  }
}

/** Read every rung signal for one delegate. Each read independently best-effort. */
async function readDelegateStatuses(
  client: SupabaseServer,
  delegate: HomecomingDelegateId,
): Promise<Partial<Record<PresenceLevel, RungStatus>>> {
  const { slug, handCuratedCard } = DELEGATE_DB[delegate];
  const statuses: Partial<Record<PresenceLevel, RungStatus>> = {};

  // Root identity (drives L0 card + L1 knowledge + L5 passport component). Keyed
  // on agent_card_slug so both legacy seeds and genesis rows resolve.
  const rootRead = await tryRead(async () => {
    const { data, error } = await client
      .from('agent_root_identity')
      .select('id, bound_passport_id')
      .eq('agent_card_slug', slug)
      .maybeSingle();
    if (error) throw error;
    return data as { id: string; bound_passport_id: string | null } | null;
  });
  const root = rootRead.ok ? rootRead.data : null;

  // L0 — card exists: a seeded root OR a hand-curated card route. The hand-curated
  // route is a static fact (does not depend on the DB read), so it is never pending.
  statuses.card = handCuratedCard || root ? 'reached' : rootRead.ok ? 'not-reached' : 'pending';

  // L1 — knowledge connected: a persisted registry identity (the DB seed itself).
  statuses.knowledge = !rootRead.ok ? 'pending' : root ? 'reached' : 'not-reached';

  // L2 — reasoning connected: an agent_persona bound to the root identity.
  if (root) {
    const personaRead = await tryRead(async () => {
      const { count, error } = await client
        .from('agent_persona')
        .select('id', { count: 'exact', head: true })
        .eq('agent_root_id', root.id);
      if (error) throw error;
      return count ?? 0;
    });
    statuses.reasoning = !personaRead.ok ? 'pending' : personaRead.data > 0 ? 'reached' : 'not-reached';
  } else {
    statuses.reasoning = rootRead.ok ? 'not-reached' : 'pending';
  }

  // Active bounded-delegation grant (drives L3 studio, L4 development, L5 grant).
  const grantRead = await tryRead(async () => {
    const { data, error } = await client
      .from('delegation_grants')
      .select('allowed_actions, status')
      .ilike('agent_root_did', `%${slug}%`)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data as { allowed_actions: unknown; status: string } | null;
  });
  const grant = grantRead.ok ? grantRead.data : null;
  const grantActions: string[] = Array.isArray(grant?.allowed_actions)
    ? (grant!.allowed_actions as unknown[]).map((a) => String(a))
    : [];
  const hasGrant = !!grant;

  // L3 — studio connected: grant scope authorises draft_document / skill invocation.
  statuses.studio = !grantRead.ok
    ? 'pending'
    : hasGrant && grantActions.includes('draft_document')
      ? 'reached'
      : 'not-reached';

  // L4 — development connected: grant scope authorises registry_submission_proposal.
  statuses.development = !grantRead.ok
    ? 'pending'
    : hasGrant && grantActions.includes('registry_submission_proposal')
      ? 'reached'
      : 'not-reached';

  // L5 — operationally sovereign: issued passport AND an active bounded grant.
  const passportIssued = root ? !!root.bound_passport_id : false;
  statuses.sovereign = !rootRead.ok || !grantRead.ok
    ? 'pending'
    : passportIssued && hasGrant
      ? 'reached'
      : 'not-reached';

  return statuses;
}

/**
 * Assess Constitutional Presence for every named delegate. Read-only. The route
 * stamps `computedAt`; this stays clock-free so the pure summary is testable.
 */
export async function assessConstitutionalPresence(): Promise<HomecomingPresenceReport> {
  const client = getSupabaseServer();
  const delegates: DelegatePresence[] = [];

  for (const delegate of HOMECOMING_DELEGATES) {
    delegates.push(await assessDelegate(client, delegate));
  }

  return { delegates, summary: summarizePresence(delegates) };
}

/**
 * Assess one delegate's Constitutional Presence. `client` may be null (no
 * storage) → every rung pending, honest. Exported so Agent Homecoming can report
 * a delegate's presence immediately after standing it up.
 */
export async function assessDelegate(
  client: SupabaseServer | null,
  delegate: HomecomingDelegateId,
): Promise<DelegatePresence> {
  const meta = DELEGATE_CHARTER_STATUS[delegate];
  const statuses = client
    ? await readDelegateStatuses(client, delegate)
    : ({} as Partial<Record<PresenceLevel, RungStatus>>);
  const { rungs, presenceLevel, presenceIndex } = assembleRungs(statuses);
  return { delegate, agentClass: meta.agentClass, charterStatus: meta.status, presenceLevel, presenceIndex, rungs };
}
