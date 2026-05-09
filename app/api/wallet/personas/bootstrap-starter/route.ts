/**
 * POST /api/wallet/personas/bootstrap-starter
 *
 * Idempotently creates a starter persona for a freshly signed-up user.
 *
 * Triggered automatically by `useSupabaseSessionPersonas` on the first
 * onAuthStateChange(SIGNED_IN) event when the caller has zero personas.
 * Safe to call repeatedly — returns the existing starter if one exists.
 *
 * Spine integration: the new persona becomes the default for
 * `getActivePersona` since it's the user's only owned persona. The
 * spine resolver picks it up via `auth_profile_id` ownership check.
 *
 * FIO is intentionally NOT registered here — operator decision
 * (2026-05-09): FIO is optional at signup, required only at tx time.
 * The starter persona's `fio_handle` is a deterministic placeholder
 * (`anonym-<short>@aigent`) so existing UI surfaces that read fio_handle
 * have a non-null value to render. Registration on the FIO chain
 * happens later via the existing PersonaSetupWizard flow.
 *
 * Also fires `ecosystem-signup` (signup_source='direct') so the user
 * lands in the CRM `agentiq_developer` cohort and Marketa can run
 * onboarding sequences. CRM enrollment is non-blocking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getCallerAuthProfileId } from '@/services/wallet/personaRepo';

export const dynamic = 'force-dynamic';

function generateStarterHandle(): string {
  const suffix = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `anonym-${suffix}@aigent`;
}

function generateEvmAddress(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(20)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `0x${hex}`;
}

async function fireEcosystemSignup(opts: {
  request: NextRequest;
  personaId: string;
  email: string | null;
  displayName: string;
}): Promise<void> {
  const origin = new URL(opts.request.url).origin;
  try {
    await fetch(`${origin}/api/codex/agentiq-os/ecosystem-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona_id: opts.personaId,
        bridge_stage: 'open_onboarding',
        display_name: opts.displayName,
        email: opts.email,
        signup_source: 'direct',
      }),
    });
  } catch {
    // non-fatal — orchestration event is the canonical record
  }
}

export async function POST(request: NextRequest) {
  try {
    const callerAuthProfileId = await getCallerAuthProfileId(request);
    if (!callerAuthProfileId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({})) as { email?: string };
    const email = typeof body.email === 'string' ? body.email : null;

    // Idempotency: if the caller already owns any active persona, return it.
    // This is a hard requirement — re-signin must NOT recreate.
    const { data: existing } = await supabase
      .from('personas')
      .select('id, display_name, fio_handle, default_identity_state, created_at')
      .eq('auth_profile_id', callerAuthProfileId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({
        ok: true,
        created: false,
        persona: existing[0],
      });
    }

    const fioHandle = generateStarterHandle();
    const evmAddress = generateEvmAddress();
    const displayName = 'anonym';

    const { data: created, error } = await supabase
      .from('personas')
      .insert({
        auth_profile_id: callerAuthProfileId,
        tenant_id: 'metame',
        display_name: displayName,
        fio_handle: fioHandle,
        fio_domain: 'aigent',
        default_identity_state: 'anonymous',
        status: 'active',
        evm_address: evmAddress,
        evm_key: { address: evmAddress },
        chain_addresses: {},
        app_origin: 'agentiq-direct-signup',
      })
      .select('id, display_name, fio_handle, default_identity_state, created_at')
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to bootstrap starter persona', details: error.message },
        { status: 500 },
      );
    }

    // Fire-and-forget CRM enrollment
    void fireEcosystemSignup({
      request,
      personaId: created.id,
      email,
      displayName,
    });

    return NextResponse.json({
      ok: true,
      created: true,
      persona: created,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal error', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
