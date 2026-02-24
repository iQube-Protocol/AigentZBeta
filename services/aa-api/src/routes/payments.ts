import { Router } from 'express';
import { requireAuth } from './mw-auth.js';
import { supabase } from '../db.js';
import { signX402, submitToFacilitator } from '../x402.js';
import { pushToTenant } from '../sse.js';
import crypto from 'crypto';

export const paymentsRouter = Router();

// POST /aa/v1/payments/quote
// Body: { asset_id }
// Returns: { headers, body, x402_id, request_id }
paymentsRouter.post('/quote', requireAuth, async (req, res) => {
  try {
    const { did: buyer_did, tenant_id } = (req as any).auth as { did: string; tenant_id: string };
    const { asset_id } = req.body || {};
    if (!asset_id) return res.status(400).json({ error: 'asset_id required' });

    // Fetch asset and policy
    const { data: asset, error: aerr } = await supabase.from('content_assets').select('*').eq('id', asset_id).single();
    if (aerr || !asset) return res.status(404).json({ error: 'asset not found' });
    const { data: policy } = await supabase.from('asset_policies').select('*').eq('asset_id', asset_id).order('created_at', { ascending: false }).limit(1).single();
    if (!policy) return res.status(400).json({ error: 'no policy for asset' });

    const payload = {
      request_id: cryptoRandomId(),
      tenant_id,
      buyer_did,
      seller_did: policy.pay_to_did,
      asset_id,
      rights: policy.rights,
      amount: policy.price_amount,
      asset_symbol: policy.price_asset,
      created_at: new Date().toISOString()
    };

    const signature = signX402(payload);
    const headers = { 'x-x402-signature': signature };
    const body = payload;

    // Record transaction in DB
    const { data: tx, error: terr } = await supabase
      .from('x402_transactions')
      .insert({
        tenant_id,
        buyer_did,
        seller_did: policy.pay_to_did,
        asset_id,
        amount: policy.price_amount,
        asset_symbol: policy.price_asset,
        status: 'initiated',
        request_id: payload.request_id
      })
      .select('*')
      .single();
    if (terr) return res.status(500).json({ error: terr.message });

    // Optional autosubmit to facilitator per env flag
    if (process.env.X402_AUTOSUBMIT === 'true') {
      try {
        const submitResp: any = await submitToFacilitator(headers as any, body);
        await supabase
          .from('x402_transactions')
          .update({ status: 'submitted', facilitator_ref: String((submitResp?.id ?? submitResp?.ref ?? 'submitted')) })
          .eq('id', tx.id);
      } catch (e) {
        // Leave status as initiated if submit fails; client can call /submit later
      }
    }

    return res.json({ ok: true, headers, body, x402_id: tx.id, request_id: payload.request_id });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'quote failed' });
  }
});

// POST /aa/v1/payments/notify
// Body: { request_id, status, facilitator_ref? }
// On settled: create entitlement and broadcast SSE to tenant
paymentsRouter.post('/notify', async (req, res) => {
  try {
    const { request_id, status, facilitator_ref } = req.body || {};
    if (!request_id || !status) return res.status(400).json({ error: 'request_id and status required' });

    // Load transaction
    const { data: tx, error: terr } = await supabase
      .from('x402_transactions')
      .select('*')
      .eq('request_id', request_id)
      .single();
    if (terr || !tx) return res.status(404).json({ error: 'transaction not found' });

    // Update status
    const { data: updated, error: uerr } = await supabase
      .from('x402_transactions')
      .update({ status, facilitator_ref: facilitator_ref ?? null })
      .eq('id', tx.id)
      .select('*')
      .single();
    if (uerr) return res.status(500).json({ error: uerr.message });

    if (status === 'settled') {
      // Fetch policy to get rights
      const { data: policy } = await supabase
        .from('asset_policies')
        .select('*')
        .eq('asset_id', tx.asset_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Create entitlement
      const { data: ent, error: eerr } = await supabase
        .from('entitlements')
        .insert({
          x402_id: tx.id,
          asset_id: tx.asset_id,
          holder_did: tx.buyer_did,
          rights: policy?.rights ?? ['view']
        })
        .select('*')
        .single();
      if (eerr) return res.status(500).json({ error: eerr.message });

      // Broadcast to tenant clients
      pushToTenant(tx.tenant_id, 'entitlement_created', { entitlement: ent, transaction: updated });
    }

    return res.json({ ok: true, transaction: updated });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'notify failed' });
  }
});

// POST /aa/v1/payments/submit
// Body: { request_id }
// Rebuild signed payload from transaction and submit to facilitator
paymentsRouter.post('/submit', requireAuth, async (req, res) => {
  try {
    const { request_id } = req.body || {};
    if (!request_id) return res.status(400).json({ error: 'request_id required' });

    const { data: tx, error: terr } = await supabase
      .from('x402_transactions')
      .select('*')
      .eq('request_id', request_id)
      .single();
    if (terr || !tx) return res.status(404).json({ error: 'transaction not found' });

    const { data: policy } = await supabase
      .from('asset_policies')
      .select('*')
      .eq('asset_id', tx.asset_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const payload = {
      request_id: tx.request_id,
      tenant_id: tx.tenant_id,
      buyer_did: tx.buyer_did,
      seller_did: tx.seller_did,
      asset_id: tx.asset_id,
      rights: policy?.rights ?? ['view'],
      amount: tx.amount,
      asset_symbol: tx.asset_symbol,
      created_at: tx.created_at
    };
    const signature = signX402(payload);
    const headers = { 'x-x402-signature': signature };
    const body = payload;

    const resp: any = await submitToFacilitator(headers as any, body);

    const { data: updated, error: uerr } = await supabase
      .from('x402_transactions')
      .update({ status: 'submitted', facilitator_ref: String((resp?.id ?? resp?.ref ?? 'submitted')) })
      .eq('id', tx.id)
      .select('*')
      .single();
    if (uerr) return res.status(500).json({ error: uerr.message });

    return res.json({ ok: true, transaction: updated });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'submit failed' });
  }
});

// GET /aa/v1/payments/tx/:request_id
paymentsRouter.get('/tx/:request_id', requireAuth, async (req, res) => {
  try {
    const { request_id } = req.params as { request_id: string };
    const { data: tx, error } = await supabase
      .from('x402_transactions')
      .select('*')
      .eq('request_id', request_id)
      .single();
    if (error || !tx) return res.status(404).json({ error: 'not found' });

    const { data: ent } = await supabase
      .from('entitlements')
      .select('*')
      .eq('x402_id', tx.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return res.json({ ok: true, transaction: tx, entitlement: ent || null });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'status failed' });
  }
});

function cryptoRandomId(): string {
  if (typeof (crypto as any).randomUUID === 'function') {
    return (crypto as any).randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
}
