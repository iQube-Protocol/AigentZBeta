import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ops/dvn/migration-ledger
 *
 * Read-only migration-drift diagnostic (Horizen Pilot Closure — "migration
 * drift first", 2026-08-09). The dvn_status discovery raised the question of
 * whether dev-beta's Supabase project is missing MORE than one migration.
 * This checks the CANONICAL OBJECTS three specific migrations are supposed
 * to have produced, directly against the live tables — never against a
 * migration-runner's own bookkeeping (which may itself be silent about a
 * failed/skipped apply).
 *
 * Checked:
 *   - 20260808010000_activity_receipt_dual_leg_anchoring.sql
 *       -> activity_receipts.{commitment_hash,pos_receipt_id,pos_status,
 *          btc_batch_root,btc_anchor_txid,dvn_status}
 *   - 20260930000400_aigentqube_moneypenny_registry_asset.sql
 *       -> registry_assets row (asset_id='aigentqube-moneypenny') +
 *          iqube_id_map row (source_id='aigentqube-moneypenny')
 *   - 20260930002300_moneypenny_runtime_endpoint.sql
 *       -> registry_assets.metadata->'runtime' on that same row
 *   - (bonus, same shape) 20260930000700_aigentqube_nakamoto_registry_asset.sql
 *       -> registry_assets row (asset_id='aigentqube-nakamoto') — Nakamoto is
 *          the pilot's OTHER agent; confirms whether this is a
 *          MoneyPenny-specific gap or a broader deploy-time drift.
 * *   - 20260930040000_qubetalk_communications_membrane_domain_substrate.sql
 *       -> the 12 qubetalk_* tables + passport_peer_messages' new columns
 *          (conversation_id, transport, direction, sensitivity, consequence,
 *          delivery_state)
 *   - 20260930050000_contactgraph_substrate.sql
 *       -> contact_persons/contact_personas/contact_endpoints + the bridge
 *          columns on qubetalk_participants/qubetalk_participant_endpoints
 *   - 20260930060000_qubetalk_contact_endpoint_exact_bridge.sql
 *       -> qubetalk_participant_endpoints.contact_endpoint_id (exact-endpoint
 *          follow-on refinement, additive alongside contact_persona_id)
 *   (added 2026-08-25 after this exact drift recurred for the QubeTalk +
 *   ContactGraph capability — Amplify deployed the application commit while
 *   dev's Supabase project had neither migration applied, surfacing as a
 *   PostgREST "table not found in schema cache" error live in aigentMe/
 *   Runtime. The standing invariant this section enforces: application
 *   deployment is not QubeTalk deployment if the required domain schema has
 *   not crossed with it.)
 *
 * Best-effort probe of supabase_migrations.schema_migrations (the Supabase
 * CLI's own applied-migration ledger) is attempted but never required — most
 * projects do not expose that schema through PostgREST, and a failure there
 * is reported, not treated as an error.
 *
 * Auth: CRON_TRIGGER_TOKEN, same convention as the other /api/ops/dvn/*
 * infra routes.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_TRIGGER_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'cron_token_not_configured' }, { status: 503 });
  }
  const provided =
    request.headers.get('x-cron-token') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ error: 'db unavailable' }, { status: 503 });
  }

  // ── 20260808010000: activity_receipts dual-leg columns ────────────────────
  const dualLegColumns = ['commitment_hash', 'pos_receipt_id', 'pos_status', 'btc_batch_root', 'btc_anchor_txid', 'dvn_status'];
  const dualLegPresent: string[] = [];
  const dualLegMissing: string[] = [];
  for (const col of dualLegColumns) {
    const probe = await admin.from('activity_receipts').select(col).limit(1);
    if (probe.error && /does not exist/i.test(probe.error.message)) {
      dualLegMissing.push(col);
    } else {
      dualLegPresent.push(col);
    }
  }

  // ── 20260930000400 + 20260930002300: MoneyPenny AigentQube + runtime ──────
  const { data: registryRows, error: registryError } = await admin
    .from('registry_assets')
    .select('asset_id, asset_class, metadata')
    .in('asset_id', ['aigentqube-moneypenny', 'aigentqube-nakamoto']);

  const moneypennyAsset = (registryRows ?? []).find((r: any) => r.asset_id === 'aigentqube-moneypenny') ?? null;
  const nakamotoAsset = (registryRows ?? []).find((r: any) => r.asset_id === 'aigentqube-nakamoto') ?? null;

  const { data: idMapRows, error: idMapError } = await admin
    .from('iqube_id_map')
    .select('source, source_id, primitive_type')
    .in('source_id', ['aigentqube-moneypenny', 'aigentqube-nakamoto']);

  // ── Best-effort: Supabase CLI's own migration ledger ───────────────────────
  let schemaMigrations: unknown = null;
  let schemaMigrationsError: string | null = null;
  try {
    const probe = await (admin as any)
      .schema('supabase_migrations')
      .from('schema_migrations')
      .select('version, name')
      .gte('version', '20260800000000')
      .order('version', { ascending: true });
    if (probe.error) {
      schemaMigrationsError = probe.error.message;
    } else {
      schemaMigrations = probe.data;
    }
  } catch (err) {
    schemaMigrationsError = err instanceof Error ? err.message : String(err);
  }

  // ── QubeTalk Communications Membrane + ContactGraph substrate ─────────────
  // (20260930040000 / 20260930050000, added 2026-08-25 after this exact
  // failure mode recurred: Amplify deployed the app while dev's Supabase
  // project had neither migration — see
  // codexes/packs/agentiq/updates/2026-09-30_contactgraph-substrate-and-qubetalk-integration.md's
  // "Live deployment repair" addendum. "Application deployment is not
  // QubeTalk deployment if the required domain schema has not crossed with
  // it" — this section is the standing check for that invariant, same
  // discipline as the dual-leg-anchoring probe above: checked against the
  // live tables/columns themselves, never against migration-runner
  // bookkeeping.
  const qubeTalkTables = [
    'qubetalk_participants', 'qubetalk_participant_endpoints', 'qubetalk_relationship_state',
    'qubetalk_groups', 'qubetalk_group_endpoints', 'qubetalk_group_memberships',
    'qubetalk_conversations', 'qubetalk_publications', 'qubetalk_publication_projections',
    'qubetalk_engagements', 'qubetalk_agent_policies', 'qubetalk_events',
  ];
  const contactGraphTables = ['contact_persons', 'contact_personas', 'contact_endpoints'];
  const qubeTalkTablesPresent: string[] = [];
  const qubeTalkTablesMissing: string[] = [];
  for (const table of qubeTalkTables) {
    const probe = await admin.from(table).select('id').limit(1);
    if (probe.error && /does not exist|schema cache/i.test(probe.error.message)) {
      qubeTalkTablesMissing.push(table);
    } else {
      qubeTalkTablesPresent.push(table);
    }
  }
  const contactGraphTablesPresent: string[] = [];
  const contactGraphTablesMissing: string[] = [];
  for (const table of contactGraphTables) {
    const probe = await admin.from(table).select('id').limit(1);
    if (probe.error && /does not exist|schema cache/i.test(probe.error.message)) {
      contactGraphTablesMissing.push(table);
    } else {
      contactGraphTablesPresent.push(table);
    }
  }
  // Bridge columns (20260930050000, part 4) — QubeTalk references
  // ContactGraph resolution; both nullable, so presence (not value) is what
  // proves the bridge migration ran.
  const bridgeColumnsMissing: string[] = [];
  const participantBridgeProbe = await admin.from('qubetalk_participants').select('contact_person_id').limit(1);
  if (participantBridgeProbe.error && /does not exist|schema cache/i.test(participantBridgeProbe.error.message)) {
    bridgeColumnsMissing.push('qubetalk_participants.contact_person_id');
  }
  const endpointBridgeProbe = await admin.from('qubetalk_participant_endpoints').select('contact_persona_id').limit(1);
  if (endpointBridgeProbe.error && /does not exist|schema cache/i.test(endpointBridgeProbe.error.message)) {
    bridgeColumnsMissing.push('qubetalk_participant_endpoints.contact_persona_id');
  }
  // 20260930060000 — exact-endpoint follow-on refinement (kept alongside the
  // coarser contact_persona_id above, never replacing it).
  const exactEndpointBridgeProbe = await admin.from('qubetalk_participant_endpoints').select('contact_endpoint_id').limit(1);
  if (exactEndpointBridgeProbe.error && /does not exist|schema cache/i.test(exactEndpointBridgeProbe.error.message)) {
    bridgeColumnsMissing.push('qubetalk_participant_endpoints.contact_endpoint_id');
  }
  // MessageQube extension columns on the pre-existing passport_peer_messages
  // table (20260930040000, part 5) — the migration that is easiest to miss
  // entirely, since passport_peer_messages itself already existed and every
  // pre-migration query against it keeps working, masking the gap.
  const messageQubeProbe = await admin
    .from('passport_peer_messages')
    .select('conversation_id, transport, direction, sensitivity, consequence, delivery_state')
    .limit(1);
  const messageQubeColumnsApplied = !(
    messageQubeProbe.error && /does not exist|schema cache/i.test(messageQubeProbe.error.message)
  );
  // Best-effort: does this project expose a raw-SQL RPC (e.g. exec_sql)? Only
  // relevant to whether the missing DDL (ALTER TABLE / CREATE INDEX in
  // 20260808010000) can be applied programmatically at all — PostgREST has no
  // other path to run DDL. A harmless no-op query; never used to actually
  // apply anything from this read-only diagnostic.
  let execSqlAvailable = false;
  let execSqlError: string | null = null;
  try {
    const probe = await admin.rpc('exec_sql', { query: 'select 1' } as any);
    if (probe.error) {
      execSqlError = probe.error.message;
    } else {
      execSqlAvailable = true;
    }
  } catch (err) {
    execSqlError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(
    {
      dualLegAnchoring_20260808010000: {
        present: dualLegPresent,
        missing: dualLegMissing,
        fullyApplied: dualLegMissing.length === 0,
      },
      moneypennyAigentQube_20260930000400: {
        registryAssetPresent: Boolean(moneypennyAsset),
        registryAsset: moneypennyAsset,
        iqubeIdMapPresent: (idMapRows ?? []).some((r: any) => r.source_id === 'aigentqube-moneypenny'),
        registryError: registryError?.message ?? null,
        idMapError: idMapError?.message ?? null,
      },
      moneypennyRuntimeEndpoint_20260930002300: {
        runtimePresent: Boolean((moneypennyAsset as any)?.metadata?.runtime),
        runtime: (moneypennyAsset as any)?.metadata?.runtime ?? null,
      },
      nakamotoAigentQube_20260930000700_bonus: {
        registryAssetPresent: Boolean(nakamotoAsset),
        registryAsset: nakamotoAsset,
        iqubeIdMapPresent: (idMapRows ?? []).some((r: any) => r.source_id === 'aigentqube-nakamoto'),
      },
      qubeTalkDomainSubstrate_20260930040000: {
        tablesPresent: qubeTalkTablesPresent,
        tablesMissing: qubeTalkTablesMissing,
        messageQubeColumnsApplied,
        fullyApplied: qubeTalkTablesMissing.length === 0 && messageQubeColumnsApplied,
      },
      contactGraphSubstrate_20260930050000: {
        tablesPresent: contactGraphTablesPresent,
        tablesMissing: contactGraphTablesMissing,
        bridgeColumnsMissing,
        fullyApplied: contactGraphTablesMissing.length === 0 && bridgeColumnsMissing.length === 0,
      },
      supabaseCliMigrationLedger: {
        available: schemaMigrations !== null,
        rows: schemaMigrations,
        error: schemaMigrationsError,
      },
      rawSqlRpc: {
        available: execSqlAvailable,
        error: execSqlError,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
