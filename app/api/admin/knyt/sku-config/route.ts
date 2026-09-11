/**
 * Admin API — KNYT SKU Minting Mode Config
 *
 * GET  /api/admin/knyt/sku-config          — returns all configured minting modes
 * PATCH /api/admin/knyt/sku-config         — upsert minting mode for one or more SKUs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { requireCartridgeAdmin } from '@/services/access/requireCartridgeAdmin';

const VALID_MODES = ['immediate', 'deferred', 'canonical', 'remote'] as const;
type MintingMode = (typeof VALID_MODES)[number];

export async function GET(req: NextRequest) {
  // 2026-05-26: gate added. SKU minting mode is operational config
  // — must be KNYT cartridge admin (or global) to read.
  const gate = await requireCartridgeAdmin(req, 'knyt-codex');
  if (gate instanceof NextResponse) return gate;

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, error: 'Supabase unavailable' }, { status: 500 });

  const { data, error } = await supabase
    .from('knyt_sku_config')
    .select('sku_id, minting_mode, updated_at, updated_by')
    .order('sku_id');

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, configs: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireCartridgeAdmin(req, 'knyt-codex');
  if (gate instanceof NextResponse) return gate;

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, error: 'Supabase unavailable' }, { status: 500 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  // Accept either a single { sku_id, minting_mode, updated_by? }
  // or an array of the same shape
  const rows: Array<{ sku_id: string; minting_mode: string; updated_by?: string }> = Array.isArray(body)
    ? body
    : [body as { sku_id: string; minting_mode: string; updated_by?: string }];

  for (const row of rows) {
    if (!row.sku_id || typeof row.sku_id !== 'string') {
      return NextResponse.json({ ok: false, error: 'sku_id required' }, { status: 400 });
    }
    if (!VALID_MODES.includes(row.minting_mode as MintingMode)) {
      return NextResponse.json({ ok: false, error: `Invalid minting_mode: ${row.minting_mode}` }, { status: 400 });
    }
  }

  const upsertRows = rows.map((r) => ({
    sku_id: r.sku_id,
    minting_mode: r.minting_mode,
    updated_at: new Date().toISOString(),
    updated_by: r.updated_by ?? null,
  }));

  const { error } = await supabase
    .from('knyt_sku_config')
    .upsert(upsertRows, { onConflict: 'sku_id' });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, updated: upsertRows.length });
}
