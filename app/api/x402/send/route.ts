import { NextRequest, NextResponse } from 'next/server';
import { resolveIdentity } from '@/services/identity/identityResolver';
import { getSupabaseServer } from '../../_lib/supabaseServer';
import { verifyX402Signature } from '@/services/x402/signing';
import { baseHeadersSchema, validateByIntent } from '@/services/x402/schemas';
import { shouldEscrow } from '@/services/x402/policy';
import { executeCustodyGrant } from '@/services/x402/exec';
import { bindAliasToDid } from '@/services/identity/identityResolver';

export async function POST(req: NextRequest) {
  const headers = Object.fromEntries(req.headers.entries());
  const payload = await req.json().catch(() => ({}));
  const intent = headers['x-402-intent'];
  const sender = headers['x-402-sender'] || headers['x-402-from'];
  const recipient = headers['x-402-recipient'] || headers['x-402-to'];
  if (!intent || !sender || !recipient) {
    return NextResponse.json({ ok: false, error: 'Missing required x402 headers' }, { status: 400 });
  }
  // Normalize aliases so schema validation passes
  if (!headers['x-402-sender'] && sender) headers['x-402-sender'] = sender;
  if (!headers['x-402-recipient'] && recipient) headers['x-402-recipient'] = recipient;
  const headerCheck = baseHeadersSchema.safeParse(headers as any);
  if (!headerCheck.success) {
    return NextResponse.json({ ok: false, error: 'Invalid headers', details: headerCheck.error.flatten() }, { status: 400 });
  }
  const payloadCheck = validateByIntent(intent, payload, headers as any);
  if (!(payloadCheck as any).success) {
    return NextResponse.json({ ok: false, error: 'Invalid payload', details: (payloadCheck as any).error?.flatten?.() || 'schema' }, { status: 400 });
  }
  const resolvedSender = await resolveIdentity(sender);
  const resolvedRecipient = await resolveIdentity(recipient);
  const consentAliasBind = String(headers['x-402-consent-alias-bind'] || '').toLowerCase() === 'true';

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 500 });
  }
  const devBypass = String(headers['x-402-dev-skip-sig'] || '').toLowerCase() === 'true';
  if (!devBypass) {
    const validSig = await verifyX402Signature(headers as any, payload);
    if (!validSig) {
      return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 400 });
    }
  }
  const insertHeaders: Record<string, string> = {
    ...headers,
    'x-402-resolved-sender': resolvedSender.canonicalDid,
    'x-402-resolved-recipient': resolvedRecipient.canonicalDid,
  };
  const { data: msgRow, error: msgErr } = await supabase
    .from('x402_messages')
    .insert({
      intent,
      headers: insertHeaders,
      payload,
      state: 'received',
      resolved_sender_did: resolvedSender.canonicalDid,
      resolved_recipient_did: resolvedRecipient.canonicalDid,
    })
    .select('id')
    .single();
  if (msgErr) {
    return NextResponse.json({ ok: false, error: msgErr.message }, { status: 500 });
  }
  const settlement = {
    message_id: msgRow.id,
    asset: headers['x-402-asset'] || 'QCT.QCENT',
    amount: headers['x-402-amount'] || '0',
    status: 'pending',
  } as any;
  const { data: settleRow, error: settleErr } = await supabase
    .from('x402_settlements')
    .insert(settlement)
    .select('id')
    .single();
  if (settleErr) {
    return NextResponse.json({ ok: false, error: settleErr.message }, { status: 500 });
  }
  try {
    // Persist DVN attestation root if provided
    const dvnRoot = headers['x-402-dvn-attest'];
    if (dvnRoot) {
      await supabase.from('dvn_attestations').insert({
        message_id: msgRow.id,
        root: String(dvnRoot),
        msg_hash: null,
      });
    }

    // Delivery mode routing
    const deliveryMode = String(headers['x-402-delivery-mode'] || '').toLowerCase();
    if (deliveryMode === 'custody' && intent === 'iqube.grant' && payload?.capability) {
      const cap = payload.capability as any;
      const iqubeRef: string = cap.iqube_ref || headers['x-402-ref'] || '';
      const toDid = resolvedRecipient.canonicalDid;
      // Attempt simple chain parse from ref: iq:chain/contract/tokenId
      let chain: string | null = null;
      try { const p = String(iqubeRef).split(':')[1]?.split('/') || []; chain = p[0] || null; } catch {}
      await supabase.from('custody_events').insert({
        iqube_ref: iqubeRef,
        to_did: toDid,
        scope: cap.scope || [],
        ttl: cap.ttl ? new Date(cap.ttl).toISOString() : null,
        x402_message_id: msgRow.id,
        x402_hash: null,
        dvn_root: dvnRoot || null,
        chain,
        block_number: null,
        tx_hash: null,
      });

      try {
        const ttlSec = cap.ttl ? Math.max(0, Math.floor((new Date(cap.ttl).getTime() - Date.now()) / 1000)) : 0;
        await executeCustodyGrant({
          iqubeRef: iqubeRef,
          recipientAddress: undefined,
          scope: cap.scope || [],
          ttlSec,
          limits: cap.limits,
          dvnAttestation: typeof dvnRoot === 'string' ? dvnRoot : undefined,
          messageSig: (headers['x-402-signature'] as string | undefined)?.replace('ed25519:', '0x'),
        });
      } catch {}
    }

    if (intent === 'asset.claim' && payload?.rights && payload?.redeem_to) {
      const claimId: string = payload.claim_id || msgRow.id;
      const fromChain: string = payload.from_chain || headers['x-402-chain-from'] || 'polygon';
      const dvnRoot = String(headers['x-402-dvn-attest'] || '');
      // Try new schema first
      const insertNew = await supabase.from('claims').insert({
        claim_id: claimId,
        asset: String(payload.rights.asset),
        amount: String(payload.rights.amount),
        from_chain: String(fromChain),
        to_chain: String(payload.redeem_to.chain),
        to_did: resolvedRecipient.canonicalDid,
        expiry: payload.expiry ? new Date(payload.expiry).toISOString() : null,
        dvn_root: dvnRoot,
        status: 'open',
      });
      if (insertNew.error) {
        const msg = String(insertNew.error.message || '');
        if (msg.includes('column') || msg.includes('does not exist')) {
          // Fallback to legacy schema
          const amountQcent = (() => {
            try { return BigInt(String(payload.rights.amount)); } catch { return 0n; }
          })();
          await supabase.from('claims').insert({
            id: claimId,
            iqube_id: String(payload.iqube_id || ''),
            claimant_did: resolvedRecipient.canonicalDid,
            rights: ['redeem'],
            amount_qcent: amountQcent.toString(),
            redeem_to: String(payload.redeem_to.recipient),
            status: 'open'
          } as any);
        } else {
          throw insertNew.error;
        }
      } else {
        // Best-effort also write legacy row for mixed-schema environments
        try {
          const amountQcent = (() => {
            try { return BigInt(String(payload.rights.amount)); } catch { return 0n; }
          })();
          await supabase.from('claims').insert({
            id: claimId,
            iqube_id: String(payload.iqube_id || ''),
            claimant_did: resolvedRecipient.canonicalDid,
            rights: ['redeem'],
            amount_qcent: amountQcent.toString(),
            redeem_to: String(payload.redeem_to.recipient),
            status: 'open'
          } as any);
        } catch {}
      }
    }

    const chainIdHeader = headers['x-402-chainid'] || headers['x-402-chain-id'];
    const tokenHeader = headers['x-402-tokenaddress'] || headers['x-402-token-address'];
    const payToHeader = headers['x-402-payto'] || headers['x-402-pay-to'];
    const chainId = Number(chainIdHeader || 80002);
    const tokenAddress = (tokenHeader as string) || '0x4C4f1aD931589449962bB675bcb8e95672349d09';
    const treasury = process.env.TREASURY_ADDRESS || '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5f';
    const to = (payToHeader as string) || treasury;
    const rawAmount = headers['x-402-amount'] || '0';
    const amountQcent = BigInt(rawAmount);
    const amountWei = (amountQcent * 10n ** 18n).toString();
    const escrow = shouldEscrow({ intent, amountQcent });
    if (!escrow) {
      const signerUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/a2a/signer/transfer`;
      const a2aBody = {
        chainId,
        amount: amountWei,
        asset: 'QCT',
        agentId: 'aigent-z',
        to,
        tokenAddress,
      };
      const r = await fetch(signerUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(a2aBody),
      });
      const text = await r.text();
      let txHash: string | null = null;
      try {
        const parsed = JSON.parse(text);
        txHash = parsed?.txHash || null;
      } catch {}
      if (r.ok && txHash) {
        await supabase
          .from('x402_settlements')
          .update({ status: 'paid', escrow_tx: txHash })
          .eq('id', settleRow.id);
      }
    }
  } catch (e) {
    // leave settlement pending if payment fails; continue
  }
  try {
    if (intent === 'iqube.grant' && payload?.capability) {
      const cap = payload.capability;
      const isFio = (headers['x-402-recipient'] || '').includes('@');
      await supabase.from('iqube_capabilities').insert({
        iqube_ref: cap.iqube_ref,
        audience_did: resolvedRecipient.canonicalDid,
        audience_alias: consentAliasBind && isFio ? [{ type: 'fio', value: headers['x-402-recipient'] }] : null,
        scope: cap.scope || [],
        ttl: cap.ttl ? new Date(cap.ttl).toISOString() : null,
        state: 'active',
        acl_delta_sig: payload.acl_delta_sig || null,
      });
      if (consentAliasBind && isFio) {
        const handle = (headers['x-402-recipient'] as string).replace(/^fio:/i, '');
        await bindAliasToDid(resolvedRecipient.canonicalDid, 'fio', handle);
      }
      await supabase.from('iqube_events').insert({
        iqube_ref: cap.iqube_ref,
        type: 'grant',
        x402_message_id: msgRow.id,
        identity_snapshot: {
          sender: resolvedSender.canonicalDid,
          recipient: resolvedRecipient.canonicalDid,
        },
      });
    } else if (intent === 'iqube.deliver') {
      await supabase.from('deliveries').insert({
        message_id: msgRow.id,
        meta_cid: payload?.meta?.cid || null,
        blak_uri: payload?.blak?.uri || null,
        hashes: {
          meta: payload?.meta?.hash || null,
          blak: payload?.blak?.hash || null,
        },
        status: 'pending',
      });
      if (payload?.license && payload?.meta?.cid) {
        await supabase.from('iqube_events').insert({
          iqube_ref: payload?.capability?.iqube_ref || insertHeaders['x-402-ref'] || null,
          type: 'deliver',
          x402_message_id: msgRow.id,
          state_proof: { license: payload.license },
          identity_snapshot: {
            sender: resolvedSender.canonicalDid,
            recipient: resolvedRecipient.canonicalDid,
          },
        });
      }
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Persistence error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data: { messageId: msgRow.id, settlementId: settleRow.id } }, { status: 202 });
}
