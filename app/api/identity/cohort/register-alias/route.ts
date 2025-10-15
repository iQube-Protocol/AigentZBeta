import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { escrowIDL } from '@/services/ops/idl/escrow';

export async function POST(req: NextRequest) {
  try {
    const { aliasCommitment, mailboxId, ttl } = await req.json();
    if (!aliasCommitment || !mailboxId || !ttl) {
      return NextResponse.json({ ok: false, error: 'aliasCommitment, mailboxId, and ttl required' }, { status: 400 });
    }

    const canisterId = process.env.ESCROW_CANISTER_ID || process.env.NEXT_PUBLIC_ESCROW_CANISTER_ID;
    if (!canisterId) {
      return NextResponse.json({ ok: false, error: 'Escrow canister not configured' }, { status: 501 });
    }

    const actor: any = await getActor(canisterId, escrowIDL);
    const commitment = Buffer.from(aliasCommitment, 'hex');
    const mailbox = Buffer.from(mailboxId, 'hex');
    await actor.register_alias(commitment, mailbox, Number(ttl));

    return NextResponse.json({ ok: true, message: 'Alias registered' });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to register alias' }, { status: 500 });
  }
}
