/**
 * GET /api/constitutional/chrysalis-test — the Chrysalis Test, live.
 *
 * CFS-015's final acceptance test computed against the actual platform state
 * instead of asserted in prose. Every criterion is checked mechanically and
 * read-only; each check is best-effort and independent (one failing query
 * degrades ONE criterion to its honest state, never the whole test).
 *
 * Honest-status discipline: `pending` is a first-class status (a criterion
 * whose capability is ratified-but-not-yet-exercised), never faked green.
 * `partial` = observably flowing but below the criterion's full claim.
 *
 * Admin-gated (spine).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getCanonVersionStamp } from '@/services/invariants/store';
import { CONSTITUTIONAL_PROVIDERS } from '@/services/constitutional/inferenceProviders';

export const dynamic = 'force-dynamic';

type CriterionStatus = 'pass' | 'partial' | 'pending' | 'fail';

interface ChrysalisCriterion {
  id: string;
  title: string;
  status: CriterionStatus;
  evidence: string;
}

async function countRows(
  client: NonNullable<ReturnType<typeof getSupabaseServer>>,
  table: string,
  build: (q: any) => any,
): Promise<number | null> {
  try {
    const base = client.from(table).select('id', { count: 'exact', head: true });
    const { count, error } = await build(base);
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const client = getSupabaseServer();
  if (!client) return NextResponse.json({ error: 'storage unavailable' }, { status: 500 });

  const criteria: ChrysalisCriterion[] = [];

  // 1. Constitutional reasoning — the substrate exists and is versioned.
  {
    const canonical = await countRows(client, 'invariants', (q) => q.eq('status', 'canonical'));
    const validated = await countRows(client, 'invariants', (q) => q.eq('status', 'validated'));
    const proposed = await countRows(client, 'invariants', (q) => q.eq('status', 'proposed'));
    const total = (canonical ?? 0) + (validated ?? 0) + (proposed ?? 0);
    const canon = await getCanonVersionStamp().catch(() => null);
    criteria.push({
      id: 'constitutional-reasoning',
      title: 'Constitutional reasoning — the invariant substrate',
      status: total > 0 ? 'pass' : 'fail',
      evidence:
        total > 0
          ? `${total} invariants (canonical ${canonical ?? 0} · validated ${validated ?? 0} · proposed ${proposed ?? 0}) · canon ${canon ?? 'unknown'}`
          : 'no invariants in the substrate — run the seed ingest',
    });
  }

  // 2. Reasoning surfaces governed — invariants_used observably flowing.
  {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const governed = await countRows(client, 'activity_receipts', (q) =>
      q.not('invariants_used', 'is', null).neq('invariants_used', '{}').gte('created_at', since),
    );
    criteria.push({
      id: 'reasoning-surfaces-governed',
      title: 'Reasoning surfaces governed through Invariant Intelligence',
      status: governed === null ? 'pending' : governed > 0 ? 'pass' : 'pending',
      evidence:
        governed === null
          ? 'invariants_used column not queryable — receipts migration state unknown'
          : `${governed} receipts carrying invariants_used in the last 30 days`,
    });
  }

  // 3. Rendering governed — render-validation receipts exist.
  {
    const renders = await countRows(client, 'activity_receipts', (q) =>
      q.eq('action_type', 'experience_render_validated'),
    );
    criteria.push({
      id: 'rendering-governed',
      title: 'Rendering surfaces governed (coherence-validated, receipted)',
      status: renders && renders > 0 ? 'pass' : 'pending',
      evidence:
        renders && renders > 0
          ? `${renders} experience_render_validated receipts`
          : 'no render-validation receipts yet — generate an invariant video brief post-deploy',
    });
  }

  // 4. Develops capabilities — implementation packs generated.
  {
    const packs = await countRows(client, 'activity_receipts', (q) =>
      q.eq('action_type', 'implementation_pack_generated'),
    );
    criteria.push({
      id: 'develops-capabilities',
      title: 'Develops capabilities (Implementation Packs through Aigent Z)',
      status: packs && packs > 0 ? 'pass' : 'pending',
      evidence:
        packs && packs > 0
          ? `${packs} implementation_pack_generated receipts`
          : 'no packs generated yet — use the Capability Pipeline tab',
    });
  }

  // 5. Generates receipts — the trail exists, with DVN anchoring share.
  {
    const total = await countRows(client, 'activity_receipts', (q) => q);
    const anchored = await countRows(client, 'activity_receipts', (q) =>
      q.eq('receipt_status', 'dvn_recorded'),
    );
    criteria.push({
      id: 'generates-receipts',
      title: 'Generates receipts (DVN-anchorable constitutional trail)',
      status: total && total > 0 ? (anchored && anchored > 0 ? 'pass' : 'partial') : 'fail',
      evidence:
        total && total > 0
          ? `${total} receipts · ${anchored ?? 0} DVN-recorded`
          : 'no activity receipts — the trail is not flowing',
    });
  }

  // 6. Validates outcomes — canonical published results per experiment leg.
  {
    try {
      const { data } = await client.from('experiment_results').select('experiment');
      const byExp = new Map<string, number>();
      for (const r of data ?? []) byExp.set(String(r.experiment), (byExp.get(String(r.experiment)) ?? 0) + 1);
      const legs = ['EXP-001', 'EXP-002', 'EXP-003'].filter((e) => (byExp.get(e) ?? 0) > 0);
      criteria.push({
        id: 'validates-outcomes',
        title: 'Validates outcomes (canonical hash-committed results)',
        status: legs.length === 3 ? 'pass' : legs.length > 0 ? 'partial' : 'pending',
        evidence:
          (data?.length ?? 0) > 0
            ? `${data!.length} published results — legs covered: ${[...byExp.keys()].sort().join(', ')}`
            : 'nothing published — use the Results tab backfill',
      });
    } catch {
      criteria.push({
        id: 'validates-outcomes',
        title: 'Validates outcomes (canonical hash-committed results)',
        status: 'pending',
        evidence: 'experiment_results not queryable — apply the migration',
      });
    }
  }

  // 7. Learns operationally — the flywheel is turning.
  {
    const cited = await countRows(client, 'invariants', (q) => q.gt('times_used', 0));
    criteria.push({
      id: 'learns-operationally',
      title: 'Learns operationally (Reach/Standing flywheel turning)',
      status: cited && cited > 0 ? 'pass' : 'pending',
      evidence:
        cited && cited > 0
          ? `${cited} invariants with runtime citations (times_used > 0)`
          : 'no runtime citations recorded yet',
    });
  }

  // 8. Sovereignty — EXP-004 published with the claim held.
  {
    try {
      const { data } = await client
        .from('experiment_results')
        .select('aggregates')
        .eq('experiment', 'EXP-004')
        .order('created_at', { ascending: false })
        .limit(1);
      const agg = (data?.[0]?.aggregates ?? null) as Record<string, unknown> | null;
      criteria.push({
        id: 'sovereignty',
        title: 'Sovereign survivability (EXP-004 drill)',
        status: agg ? (agg.sovereigntyHolds === true ? 'pass' : 'fail') : 'pending',
        evidence: agg
          ? `latest drill: sovereigntyHolds=${String(agg.sovereigntyHolds)} · completed ${String(agg.completed)}`
          : 'no EXP-004 run published yet — run the Sovereignty tab (venice credits required)',
      });
    } catch {
      criteria.push({
        id: 'sovereignty',
        title: 'Sovereign survivability (EXP-004 drill)',
        status: 'pending',
        evidence: 'experiment_results not queryable',
      });
    }
  }

  // 9. Provider interchangeability — honest slot inventory (static truth).
  {
    const real = CONSTITUTIONAL_PROVIDERS.filter(
      (p) => p.id !== 'gemini' && p.id !== 'codex',
    );
    const openWeight = CONSTITUTIONAL_PROVIDERS.some((p) => p.kind === 'open-weight');
    criteria.push({
      id: 'provider-interchangeability',
      title: 'External models as interchangeable inference providers',
      status: real.length >= 2 && openWeight ? 'partial' : 'pending',
      evidence: `${real.length} live provider adapters + ${CONSTITUTIONAL_PROVIDERS.length - real.length} honest stubs · open-weight fallback present — 'pass' requires the full orchestration phase (CFS-015 Strand Two Phase Two)`,
    });
  }

  // 10. Deployment — D1 (pack-proposed) RATIFIED 2026-07-06 (CFS-016 v1.0);
  // native execution (D2+) remains unratified, so full 'pass' stays out of
  // reach by design until the ladder advances.
  {
    const proposals = await countRows(client, 'activity_receipts', (q) =>
      q.eq('action_type', 'deployment_proposed'),
    );
    criteria.push({
      id: 'deployment-native',
      title: 'Constitutional deployment (authority ladder — CFS-016)',
      status: proposals && proposals > 0 ? 'partial' : 'pending',
      evidence:
        proposals && proposals > 0
          ? `D1 operating: ${proposals} deployment_proposed receipt(s) · native execution (D2+) unratified — 'pass' requires it`
          : "D1 ratified (CFS-016 v1.0) — no proposals recorded yet; native execution (D2+) unratified",
    });
  }

  const passed = criteria.filter((c) => c.status === 'pass').length;
  return NextResponse.json({
    ok: true,
    criteria,
    summary: { passed, partial: criteria.filter((c) => c.status === 'partial').length, pending: criteria.filter((c) => c.status === 'pending').length, failed: criteria.filter((c) => c.status === 'fail').length, total: criteria.length },
    computedAt: new Date().toISOString(),
  });
}
