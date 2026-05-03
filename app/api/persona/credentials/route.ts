/**
 * GET /api/persona/credentials?personaId=xxx
 *
 * Returns the set of credentials a persona currently holds. Used by the
 * SmartTriadProvider to populate `state.credentials` so credential-gated
 * content (e.g. investor-only, admin-only lore) renders correctly.
 *
 * Sources (each independent — a credential is held if ANY source confirms it):
 *   • CRM   — nakamoto_knyt_personas.is_investor / .role / etc.
 *   • Entitlements — owning a SKU that grants a credential (e.g. zero-knyt)
 *   • Wallet token — stub for now; on-chain check ships in a follow-up cycle
 *
 * Response shape:
 *   { credentials: ['investor', 'admin', 'zero-knyt', ...], source: { investor: 'crm', ... } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEntitlementService } from '@/services/rewards/entitlementService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const personaId = req.nextUrl.searchParams.get('personaId');
  if (!personaId) {
    return NextResponse.json({ credentials: [], source: {} }, { status: 200 });
  }

  const credentials = new Set<string>();
  const source: Record<string, string> = {};

  // ─────────────────────────────────────────────────────────────────────────
  // CRM signals — investor / partner / admin
  // ─────────────────────────────────────────────────────────────────────────
  try {
    const { data: crm } = await supa()
      .from('nakamoto_knyt_personas')
      .select('is_investor, is_partner, role')
      .eq('persona_id', personaId)
      .maybeSingle();
    if (crm?.is_investor) { credentials.add('investor'); source.investor = 'crm'; }
    if (crm?.is_partner)  { credentials.add('partner');  source.partner  = 'crm'; }
    if (crm?.role === 'admin' || crm?.role === 'keeper') {
      credentials.add('admin');
      source.admin = 'crm';
    }
  } catch (e) {
    // CRM table may not exist in all environments — degrade silently
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Entitlement-derived credentials
  // ─────────────────────────────────────────────────────────────────────────
  try {
    const ents = await getEntitlementService().getPersonaEntitlements(personaId);
    const ownedAssetIds = new Set(ents.map((e) => e.assetId).filter(Boolean));

    if (ownedAssetIds.has('zero-knyt-investor')) {
      credentials.add('zero-knyt');
      if (!source['zero-knyt']) source['zero-knyt'] = 'entitlement';
    }
    // Investor SKU ownership implies investor credential as well (CRM + ownership both confer it).
    const investorSkus = [
      'knyt-codex-investor',
      'top-knyt-investor',
      'first-knyt-investor',
      'zero-knyt-investor',
      'satoshi-knyt-investor',
      'digital-knyt-cartridge',
      'digital-knyt-shelf',
      'digital-first-knyt',
    ];
    if (investorSkus.some((sku) => ownedAssetIds.has(sku))) {
      credentials.add('investor');
      if (!source.investor) source.investor = 'entitlement';
    }
  } catch (e) {
    // Entitlement service may not be configured — degrade silently
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Wallet token credentials — STUB for now. Will read on-chain balances or
  // wallet entitlements in a follow-up cycle. Documented in the iQube backlog.
  // ─────────────────────────────────────────────────────────────────────────

  return NextResponse.json({
    credentials: Array.from(credentials),
    source,
  });
}
