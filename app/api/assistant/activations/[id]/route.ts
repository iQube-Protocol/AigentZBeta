/**
 * POST /api/assistant/activations/[id]?action=activate|request|revoke
 *
 * Single route that handles all three persona-driven mutations. Keeps
 * surface area small while letting the UI hit one URL.
 *
 * - `activate` — only for `open` activations OR admins on `gated` rows.
 * - `request`  — for `gated` activations; creates a `pending` row.
 * - `revoke`   — any persona can deactivate their own surface.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getCallerIdentityContext } from '@/services/wallet/personaRepo';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  activate,
  requestAccess,
  revoke,
} from '@/services/activations/spineActivations';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const { id: activationId } = await ctx.params;
  const url = new URL(request.url);
  const action = url.searchParams.get('action') ?? 'activate';
  const isAdmin = !!context.cartridgeFlags?.isAdmin;

  console.log(`[activations] ${action} persona=${context.personaId.slice(0, 8)}… activation=${activationId} isAdmin=${isAdmin}`);

  try {
    if (action === 'activate') {
      const result = await activate(context.personaId, activationId, { isAdmin });
      if (!result.ok) {
        console.warn(`[activations] activate FAILED: ${result.reason}`);
        return NextResponse.json(
          { error: 'activate-failed', detail: result.reason },
          { status: 400, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      // Return the persisted row so the client can verify (and surface
      // `granted_via` / `granted_at` in the diagnostic surface).
      return NextResponse.json({ ok: true, activationId: result.activationId }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (action === 'request') {
      // Threading caller identity through so the admin Access Requests
      // tab gets a real email + display label on the surfaced row.
      const caller = await getCallerIdentityContext(request);
      let displayLabel: string | null = null;
      try {
        const admin = getSupabaseServer();
        if (admin) {
          const { data: personaRow } = await admin
            .from('personas')
            .select('display_label')
            .eq('id', context.personaId)
            .maybeSingle();
          displayLabel = (personaRow as { display_label?: string | null } | null)?.display_label ?? null;
        }
      } catch {
        displayLabel = null;
      }
      if (!displayLabel && caller?.email) {
        displayLabel = caller.email.split('@')[0] ?? null;
      }
      const result = await requestAccess(context.personaId, activationId, {
        authProfileId: context.authProfileId ?? null,
        email: caller?.email ?? null,
        displayLabel,
      });
      if (!result.ok) {
        console.warn(`[activations] request FAILED: ${result.reason}`);
        return NextResponse.json(
          { error: 'request-failed', detail: result.reason },
          { status: 400, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      return NextResponse.json({ ok: true, activationId: result.activationId }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (action === 'revoke') {
      const result = await revoke(context.personaId, activationId);
      if (!result.ok) {
        console.warn(`[activations] revoke FAILED: ${result.reason}`);
        return NextResponse.json(
          { error: 'revoke-failed', detail: result.reason },
          { status: 400, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      return NextResponse.json({ ok: true, activationId: result.activationId }, { headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json(
      { error: 'invalid-action', detail: `action must be activate|request|revoke (got '${action}')` },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[assistant/activations/[id]] failed:', msg);
    return NextResponse.json(
      { error: 'activation-mutation-failed', detail: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
