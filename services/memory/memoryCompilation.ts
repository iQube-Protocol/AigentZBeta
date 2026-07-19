/**
 * CFS-045 Memory Compilation — Post-Inference Knowledge Compression.
 * Ratified by the operator 2026-07-19 (charter:
 * codexes/packs/agentiq/updates/2026-07-19_cfs-045-memory-compilation-charter.md).
 *
 * The constitutional memory layer: persistent memory stores what SURVIVED
 * reasoning, never the conversation. Every compiled interaction answers one
 * question — "what invariant, if any, did this interaction reveal?" — with
 * exactly one taxonomy outcome (none | confirmed | strengthened | candidate |
 * refuted | merged | split). The substrate compresses itself via compaction.
 *
 * T-discipline: personaId is a T0 key — it enters this module server-side and
 * never leaves it. Compiled statements must be T1-safe; writes carrying an
 * obvious identifier (UUID / email) are rejected. v1 writes no DVN receipts
 * (memory is private working knowledge — charter §T-discipline).
 *
 * Server-side ONLY. Never import from client code.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { callSovereign } from '@/services/constitutional/modelRouter';

export interface MemoryInvariantRecord {
  id: string;
  cartridgeId: string;
  statement: string;
  status: 'candidate' | 'active' | 'retired';
  /** CFS-045-A1: true = partnership-ratified (human-validated) memory.
   *  Machine compaction must never merge/retire these; only the human can. */
  humanValidated: boolean;
  confidence: number;
  supportCount: number;
  refuteCount: number;
  createdAt: string;
  updatedAt: string;
  lastConfirmedAt: string | null;
}

export type CompilationOutcome =
  | 'none'
  | 'confirmed'
  | 'strengthened'
  | 'candidate'
  | 'refuted'
  | 'merged'
  | 'split';

let db: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (db) return db;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('memoryCompilation: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  db = createClient(url, key);
  return db;
}

/** T1-safety guard: reject statements that carry an obvious identifier.
 *  Memory stores conclusions about patterns, never references to people. */
function isT1Safe(statement: string): boolean {
  const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const emailRe = /[^\s@]+@[^\s@]+\.[^\s@]+/;
  return !uuidRe.test(statement) && !emailRe.test(statement) && statement.trim().length >= 8 && statement.length <= 500;
}

/**
 * Retrieval — top-N memory invariants for (persona, cartridge), confidence ×
 * recency ordered. Returns T1-safe content only (row ids + statements — a
 * memory-row id is not a persona identifier). Best-effort: failures return [].
 */
export async function retrieveMemoryInvariants(
  personaId: string,
  cartridgeId: string,
  limit = 6,
): Promise<MemoryInvariantRecord[]> {
  try {
    const { data } = await client()
      .from('memory_invariants')
      .select('id, cartridge_id, statement, status, human_validated, confidence, support_count, refute_count, created_at, updated_at, last_confirmed_at')
      .eq('persona_id', personaId)
      .eq('cartridge_id', cartridgeId)
      .in('status', ['active', 'candidate'])
      // Partnership-ratified memory outranks working inference (CFS-045-A1).
      .order('human_validated', { ascending: false })
      .order('confidence', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(limit);
    const rows = (data ?? []).map((r) => ({
      id: String(r.id),
      cartridgeId: String(r.cartridge_id),
      statement: String(r.statement),
      status: r.status as MemoryInvariantRecord['status'],
      humanValidated: Boolean(r.human_validated),
      confidence: Number(r.confidence),
      supportCount: Number(r.support_count),
      refuteCount: Number(r.refute_count),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
      lastConfirmedAt: r.last_confirmed_at ? String(r.last_confirmed_at) : null,
    }));
    if (rows.length > 0) {
      // Citation bookkeeping — fire-and-forget.
      void client()
        .from('memory_invariants')
        .update({ last_cited_at: new Date().toISOString() })
        .in('id', rows.map((r) => r.id))
        .then(() => {}, () => {});
    }
    return rows;
  } catch {
    return [];
  }
}

const COMPILATION_SYSTEM = `You are the Memory Compilation reviewer for a constitutional runtime (CFS-045). Memory is NOT a transcript: you store only what survived reasoning.

Given one interaction (operator message + copilot reply) and the operator's EXISTING memory invariants, answer exactly one question: what invariant, if any, did this interaction reveal about the operator's durable goals, working patterns, preferences, or understanding?

An invariant is a stable, general statement that will still be true and useful in future sessions (e.g. "operator prioritises publication of experiment results over new experiment design"). It is NEVER a fact about this conversation ("operator asked about X today"), NEVER transient state, and NEVER contains names, emails, or identifiers.

Respond with STRICT JSON only, no prose:
{"outcome":"none"} — the common case; most interactions teach nothing durable. Choose it freely.
{"outcome":"confirmed","targetId":"<existing id>"} — the interaction re-evidences an existing invariant unchanged.
{"outcome":"strengthened","targetId":"<existing id>"} — materially stronger evidence for an existing invariant.
{"outcome":"candidate","statement":"<new invariant, <=300 chars>"} — a genuinely new durable pattern emerged.
{"outcome":"refuted","targetId":"<existing id>"} — the interaction contradicts an existing invariant.
{"outcome":"merged","targetId":"<id A>","secondTargetId":"<id B>","statement":"<unified statement>"} — two existing invariants are the same pattern.
{"outcome":"split","targetId":"<existing id>","statements":["<part 1>","<part 2>"]} — one invariant conflates two distinct patterns.

Be conservative: prefer "none" over a weak candidate. One outcome only.`;

/**
 * The compilation pass — post-inference review of one smart-triad turn.
 * Routed through callSovereign (Model Router; extraction stage). Applies
 * exactly one taxonomy outcome to the substrate. Designed to run AFTER the
 * response is sent (next/server after()) — it never blocks the chat hot
 * path, and any failure is silent to the operator (logged only).
 */
export async function compileInteraction(args: {
  personaId: string;
  cartridgeId: string;
  userMessage: string;
  assistantResponse: string;
  /** Platform invariant seed ids that grounded the turn (T2-safe refs). */
  sourceSeedIds?: string[];
}): Promise<{ outcome: CompilationOutcome } | null> {
  const { personaId, cartridgeId, userMessage, assistantResponse, sourceSeedIds } = args;
  try {
    const existing = await retrieveMemoryInvariants(personaId, cartridgeId, 20);
    const existingBlock = existing.length
      ? existing.map((m) => `- id=${m.id} [${m.status}, conf=${m.confidence.toFixed(2)}] ${m.statement}`).join('\n')
      : '(none yet)';
    const user = `EXISTING MEMORY INVARIANTS:\n${existingBlock}\n\nINTERACTION:\nOperator: ${userMessage.slice(0, 1500)}\nCopilot: ${assistantResponse.slice(0, 2000)}`;

    const result = await callSovereign('extraction', COMPILATION_SYSTEM, user, 400, 0);
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as {
      outcome?: string;
      targetId?: string;
      secondTargetId?: string;
      statement?: string;
      statements?: string[];
    };
    const outcome = parsed.outcome as CompilationOutcome | undefined;
    if (!outcome) return null;

    const now = new Date().toISOString();
    const byId = new Map(existing.map((m) => [m.id, m]));
    const target = parsed.targetId ? byId.get(parsed.targetId) : undefined;

    switch (outcome) {
      case 'none':
        break;
      case 'confirmed': {
        if (!target) return null;
        const support = target.supportCount + 1;
        await client().from('memory_invariants').update({
          support_count: support,
          last_confirmed_at: now,
          updated_at: now,
          // Two independent confirmations promote a candidate.
          ...(target.status === 'candidate' && support >= 2 ? { status: 'active' } : {}),
        }).eq('id', target.id);
        break;
      }
      case 'strengthened': {
        if (!target) return null;
        await client().from('memory_invariants').update({
          confidence: Math.min(0.95, target.confidence + 0.1),
          support_count: target.supportCount + 1,
          last_confirmed_at: now,
          updated_at: now,
          ...(target.status === 'candidate' ? { status: 'active' } : {}),
        }).eq('id', target.id);
        break;
      }
      case 'candidate': {
        const statement = String(parsed.statement ?? '');
        if (!isT1Safe(statement)) return null;
        await client().from('memory_invariants').insert({
          persona_id: personaId,
          cartridge_id: cartridgeId,
          statement,
          status: 'candidate',
          confidence: 0.5,
          source_seed_ids: sourceSeedIds ?? [],
        });
        break;
      }
      case 'refuted': {
        if (!target) return null;
        const refutes = target.refuteCount + 1;
        await client().from('memory_invariants').update({
          refute_count: refutes,
          confidence: Math.max(0.05, target.confidence - 0.2),
          updated_at: now,
          // Repeated refutation retires MACHINE-tier invariants only.
          // CFS-045-A1: only the human retires what a human has ratified —
          // a validated row accrues refute evidence but never auto-retires.
          ...(refutes >= 2 && !target.humanValidated ? { status: 'retired' } : {}),
        }).eq('id', target.id);
        break;
      }
      case 'merged': {
        const second = parsed.secondTargetId ? byId.get(parsed.secondTargetId) : undefined;
        const statement = String(parsed.statement ?? '');
        if (!target || !second || !isT1Safe(statement)) return null;
        // CFS-045-A1: merging retires the sources — machine ops must never
        // consume a human-validated row.
        if (target.humanValidated || second.humanValidated) return null;
        await client().from('memory_invariants').update({ status: 'retired', updated_at: now }).in('id', [target.id, second.id]);
        await client().from('memory_invariants').insert({
          persona_id: personaId,
          cartridge_id: cartridgeId,
          statement,
          status: 'active',
          confidence: Math.max(target.confidence, second.confidence),
          support_count: target.supportCount + second.supportCount,
          lineage: { merged_from: [target.id, second.id] },
          source_seed_ids: sourceSeedIds ?? [],
        });
        break;
      }
      case 'split': {
        const statements = Array.isArray(parsed.statements) ? parsed.statements.slice(0, 2).map(String) : [];
        if (!target || statements.length !== 2 || !statements.every(isT1Safe)) return null;
        // CFS-045-A1: splitting retires the source — never a validated row.
        if (target.humanValidated) return null;
        await client().from('memory_invariants').update({ status: 'retired', updated_at: now }).eq('id', target.id);
        await client().from('memory_invariants').insert(statements.map((s) => ({
          persona_id: personaId,
          cartridge_id: cartridgeId,
          statement: s,
          status: 'candidate',
          confidence: target.confidence,
          lineage: { split_from: [target.id] },
          source_seed_ids: sourceSeedIds ?? [],
        })));
        break;
      }
      default:
        return null;
    }
    return { outcome };
  } catch (err) {
    console.error('[MemoryCompilation] compile failed (silent to operator):', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Compaction — memory's self-compression (charter §v1.5). Re-asks the
 * compilation question of the substrate itself: merge near-duplicates,
 * retire stale/refuted entries. Operator-triggered in v1.
 */
export async function compactMemory(
  personaId: string,
  cartridgeId: string,
): Promise<{ merged: number; retired: number } | null> {
  try {
    const all = await retrieveMemoryInvariants(personaId, cartridgeId, 50);
    // CFS-045-A1 compaction guard: human-validated rows are partnership-
    // ratified memory — the machine never sees them as compaction material.
    const rows = all.filter((m) => !m.humanValidated);
    if (rows.length < 4) return { merged: 0, retired: 0 };
    const listing = rows.map((m) => `- id=${m.id} [${m.status}, conf=${m.confidence.toFixed(2)}, support=${m.supportCount}, refutes=${m.refuteCount}] ${m.statement}`).join('\n');
    const result = await callSovereign(
      'extraction',
      `You compact a constitutional memory substrate (CFS-045). Given the invariants below, propose merges of near-duplicates and retirements of vague, transient, or superseded entries. Respond with STRICT JSON only: {"ops":[{"op":"merge","ids":["<id A>","<id B>"],"statement":"<unified>"} | {"op":"retire","id":"<id>"}]}. Empty ops array if the substrate is already minimal. At most 8 ops. Be conservative.`,
      listing,
      600,
      0,
    );
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { merged: 0, retired: 0 };
    const parsed = JSON.parse(jsonMatch[0]) as { ops?: Array<{ op?: string; ids?: string[]; id?: string; statement?: string }> };
    const byId = new Map(rows.map((m) => [m.id, m]));
    const now = new Date().toISOString();
    let merged = 0;
    let retired = 0;
    for (const op of (parsed.ops ?? []).slice(0, 8)) {
      if (op.op === 'retire' && op.id && byId.has(op.id)) {
        await client().from('memory_invariants').update({ status: 'retired', updated_at: now }).eq('id', op.id);
        retired += 1;
      } else if (op.op === 'merge' && Array.isArray(op.ids) && op.ids.length === 2 && op.statement && isT1Safe(op.statement)) {
        const [a, b] = [byId.get(op.ids[0]), byId.get(op.ids[1])];
        if (!a || !b) continue;
        await client().from('memory_invariants').update({ status: 'retired', updated_at: now }).in('id', [a.id, b.id]);
        await client().from('memory_invariants').insert({
          persona_id: personaId,
          cartridge_id: cartridgeId,
          statement: op.statement,
          status: 'active',
          confidence: Math.max(a.confidence, b.confidence),
          support_count: a.supportCount + b.supportCount,
          lineage: { merged_from: [a.id, b.id] },
        });
        merged += 1;
      }
    }
    return { merged, retired };
  } catch (err) {
    console.error('[MemoryCompilation] compaction failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/** Owner self-view: list one's own memory invariants (owner self-view
 *  exception — Bearer-scoped route resolves personaId via the spine). */
export async function listMemoryInvariants(personaId: string): Promise<MemoryInvariantRecord[]> {
  const { data } = await client()
    .from('memory_invariants')
    .select('id, cartridge_id, statement, status, human_validated, confidence, support_count, refute_count, created_at, updated_at, last_confirmed_at')
    .eq('persona_id', personaId)
    .neq('status', 'retired')
    .order('human_validated', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(100);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    cartridgeId: String(r.cartridge_id),
    statement: String(r.statement),
    status: r.status as MemoryInvariantRecord['status'],
    humanValidated: Boolean(r.human_validated),
    confidence: Number(r.confidence),
    supportCount: Number(r.support_count),
    refuteCount: Number(r.refute_count),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    lastConfirmedAt: r.last_confirmed_at ? String(r.last_confirmed_at) : null,
  }));
}

/**
 * CFS-045-A1 human validation — the constitutional distinction between
 * candidate inference and ratified memory. Owner-scoped (the persona filter
 * is the ownership gate). validated_at stamps BOTH actions so
 * reviewed = validated_at IS NOT NULL (partnership-metrics bookkeeping).
 */
export async function validateMemoryInvariant(
  personaId: string,
  id: string,
  action: 'validate' | 'reject',
): Promise<boolean> {
  const now = new Date().toISOString();
  const patch =
    action === 'validate'
      ? { human_validated: true, status: 'active', validated_at: now, updated_at: now }
      : // Human rejection is immediate — no two-strike rule for the human.
        { human_validated: false, status: 'retired', validated_at: now, updated_at: now };
  const { error, count } = await client()
    .from('memory_invariants')
    .update(patch, { count: 'exact' })
    .eq('persona_id', personaId)
    .eq('id', id);
  if (error || (count ?? 0) === 0) return false;
  if (action === 'validate') {
    // Confidence floor 0.8 for ratified memory — raise, never lower.
    await client()
      .from('memory_invariants')
      .update({ confidence: 0.8 })
      .eq('persona_id', personaId)
      .eq('id', id)
      .lt('confidence', 0.8);
  }
  return true;
}

export interface PartnershipMetrics {
  total: number;
  validated: number;
  reviewed: number;
  /** validated ÷ reviewed — how often the human ratifies what the machine proposes. */
  acceptanceRate: number | null;
  /** rows with refute evidence ÷ total — how often invariants get revised. */
  revisionRate: number | null;
  /** Per-cartridge share of validated among non-retired — domain stability. */
  stabilityByCartridge: Record<string, number>;
}

/**
 * CFS-045-A1 partnership metrics — properties of the HYBRID system, not of
 * either participant alone. Computed from the substrate, no new writes.
 * The observer-modelling slice consumes these to model the evolution of the
 * partnership.
 */
export async function partnershipMetrics(personaId: string): Promise<PartnershipMetrics> {
  const { data } = await client()
    .from('memory_invariants')
    .select('cartridge_id, status, human_validated, validated_at, refute_count')
    .eq('persona_id', personaId)
    .limit(1000);
  const rows = data ?? [];
  const total = rows.length;
  const validated = rows.filter((r) => r.human_validated).length;
  const reviewed = rows.filter((r) => r.validated_at).length;
  const revised = rows.filter((r) => Number(r.refute_count) > 0).length;
  const byCart: Record<string, { validated: number; live: number }> = {};
  for (const r of rows) {
    if (r.status === 'retired') continue;
    const k = String(r.cartridge_id);
    byCart[k] = byCart[k] ?? { validated: 0, live: 0 };
    byCart[k].live += 1;
    if (r.human_validated) byCart[k].validated += 1;
  }
  const stabilityByCartridge: Record<string, number> = {};
  for (const [k, v] of Object.entries(byCart)) {
    stabilityByCartridge[k] = v.live > 0 ? v.validated / v.live : 0;
  }
  return {
    total,
    validated,
    reviewed,
    acceptanceRate: reviewed > 0 ? validated / reviewed : null,
    revisionRate: total > 0 ? revised / total : null,
    stabilityByCartridge,
  };
}

/** Owner self-view: delete one's OWN memory invariant. The persona filter is
 *  the ownership gate — a foreign id deletes nothing. */
export async function deleteMemoryInvariant(personaId: string, id: string): Promise<boolean> {
  const { error, count } = await client()
    .from('memory_invariants')
    .delete({ count: 'exact' })
    .eq('persona_id', personaId)
    .eq('id', id);
  return !error && (count ?? 0) > 0;
}
