/**
 * GET /api/polity-passport/locker/agreement/[itemId]
 *
 * The holder-side review view of an x409 contract sitting in the caller's
 * Passport Locker: resolves the locker item → its claimed invitation → the
 * live x409 Constitutional Agreement, and returns the same T2-safe status
 * view the public agreement route exposes (status, refs, bounded-authority
 * terms — never the owner commitment, never persona identifiers).
 *
 * Ownership gate: the caller's active persona must HOLD the locker item.
 * The agreementId itself is returned to the holder (they were invited to
 * it — the invitation code was the capability), so their agent can run the
 * acceptance against /api/public/irl/agreement.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getAgreement } from '@/services/constitutional/constitutionalAgreement';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    const admin = getSupabaseServer();
    if (!admin) return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });

    const { itemId } = await params;
    const { data: item } = await admin
      .from('passport_locker_items')
      .select('item_id, holder_persona_id, display_name')
      .eq('item_id', itemId)
      .maybeSingle();
    if (!item || String(item.holder_persona_id) !== persona.personaId) {
      // Same response for missing and foreign items — no existence oracle.
      return NextResponse.json({ ok: false, error: 'Locker item not found' }, { status: 404 });
    }

    const { data: invite } = await admin
      .from('x409_invitations')
      .select('agreement_id, label, claimed_at')
      .eq('claimed_item_id', itemId)
      .maybeSingle();
    if (!invite) {
      return NextResponse.json({ ok: false, error: 'No agreement bound to this locker item' }, { status: 404 });
    }

    const agreement = await getAgreement(String(invite.agreement_id));
    if (!agreement) return NextResponse.json({ ok: false, error: 'Agreement no longer exists' }, { status: 404 });

    return NextResponse.json(
      {
        ok: true,
        agreement: {
          agreementId: agreement.agreementId,
          displayLabel: agreement.displayLabel,
          status: agreement.status,
          capabilityRef: agreement.capabilityRef,
          selectedAgentRef: agreement.selectedAgentRef,
          delegatedAuthority: agreement.object?.payload?.delegatedAuthority ?? null,
          constraints: agreement.object?.payload?.constraints ?? [],
          verificationRequirements: agreement.object?.payload?.verificationRequirements ?? [],
          termsCommitment: agreement.object?.payload?.termsCommitment ?? null,
          acceptance: agreement.acceptance
            ? {
                provider: agreement.acceptance.provider,
                acceptorType: agreement.acceptance.acceptorType,
                commitmentHash: agreement.acceptance.commitmentHash,
                acceptedAt: agreement.acceptance.acceptedAt ?? null,
              }
            : null,
          createdAt: agreement.createdAt,
        },
        claimedAt: invite.claimed_at,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Agreement lookup failed' },
      { status: 500 },
    );
  }
}
