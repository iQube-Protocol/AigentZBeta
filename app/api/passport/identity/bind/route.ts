/**
 * POST /api/passport/identity/bind — persona + KybeDID create/bind flow.
 *
 * PRD §9 steps 2–3: after Bureau sign-in, the caller binds their identity —
 * a Bureau persona (owned via auth_profile_id so getActivePersona resolves
 * it), a KybeDID, and a root_identity anchor. Existing-RootDID mapping: a
 * caller who already has a platform root identity keeps it; their existing
 * KybeDID is reused (one KybeDID per human, never a second).
 *
 * Idempotent: re-binding returns the existing binding (alreadyBound: true).
 *
 * Spine compliance: caller resolution via getCallerIdentityContext (the
 * canonical resolver). Requires Authorization: Bearer <token> — use
 * personaFetch client-side.
 *
 * T0 rule: the response carries ONLY commitment refs (kybePublicRef /
 * rootDidPublicRef). Raw personaId, kybe_did, and root did_uri never leave
 * the server — the client reads its persona surface from
 * /api/wallet/active-persona after binding.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCallerIdentityContext } from '@/services/wallet/personaRepo';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  bindBureauIdentity,
  recoveryPolicyStub,
} from '@/services/passport/bureauIdentityService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const caller = await getCallerIdentityContext(req);
    if (!caller?.authProfileId) {
      return NextResponse.json(
        { ok: false, error: 'Not authenticated' },
        { status: 401 },
      );
    }

    // root_identity anchors on the raw Supabase auth.users id (JWT sub),
    // which can differ from the canonical spine authProfileId.
    const auth = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null;
    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Bearer token required' },
        { status: 401 },
      );
    }
    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: 'Supabase configuration missing' },
        { status: 500 },
      );
    }
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return NextResponse.json(
        { ok: false, error: 'Invalid session' },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const displayName =
      typeof body.displayName === 'string' && body.displayName.trim()
        ? body.displayName.trim()
        : null;

    const result = await bindBureauIdentity({
      authProfileId: caller.authProfileId,
      authUserId: userData.user.id,
      displayName,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }

    const recoveryEmailSet = Boolean(
      (userData.user.user_metadata as Record<string, unknown> | null)?.recovery_email,
    );

    // T0: personaId is intentionally NOT serialized — see route doc comment.
    return NextResponse.json({
      ok: true,
      alreadyBound: Boolean(result.alreadyBound),
      existingRootDidMapped: Boolean(result.existingRootDidMapped),
      kybePublicRef: result.kybePublicRef ?? null,
      rootDidPublicRef: result.rootDidPublicRef ?? null,
      recoveryPolicy: recoveryPolicyStub(recoveryEmailSet),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Bind failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
