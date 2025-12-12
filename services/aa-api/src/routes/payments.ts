import { Router } from 'express';
import { requireAuth } from './mw-auth.js';
import { supabase } from '../db.js';
import { signX402, submitToFacilitator } from '../x402.js';

export const paymentsRouter = Router();

import crypto from 'crypto';
function cryptoRandomId(bytes = 12) {
  return crypto.randomBytes(bytes).toString('hex');
}

paymentsRouter.post('/quote', requireAuth, async (req, res) => {
  const { tenant_id, did } = (req as any).auth;
  const { asset_id, amount, asset_symbol, seller_did } = req.body || {};
  if (!asset_id || !amount || !asset_symbol || !seller_did) return res.status(400).json({ error: 'asset_id, amount, asset_symbol, seller_did required' });

  const request_id = cryptoRandomId();
  const payload = { request_id, buyer_did: did, seller_did, asset_id, amount, asset_symbol };
  const signature = signX402(payload);

  const { data, error } = await supabase.from('x402_transactions').insert({
    tenant_id, buyer_did: did, seller_did, asset_id, amount, asset_symbol, request_id, status: 'quoted'
  }).select('*').single();
  if (error) return res.status(500).json({ error: error.message });

  res.json({ ...payload, signature, status: data.status });
});

paymentsRouter.post('/submit', requireAuth, async (req, res) => {
  const { tenant_id } = (req as any).auth;
  const { request_id, headers, body } = req.body || {};
  if (!request_id) return res.status(400).json({ error: 'request_id required' });

  const { data: tx, error } = await supabase.from('x402_transactions').select('*').eq('request_id', request_id).single();
  if (error || !tx) return res.status(404).json({ error: 'transaction not found' });

  try {
    const submitResp: any = await submitToFacilitator(headers || {}, body || {});
    await supabase.from('x402_transactions').update({ status: 'submitted', facilitator_ref: String(submitResp?.id || submitResp?.ref || 'submitted') }).eq('id', tx.id);
    return res.json({ ok: true, facilitator_ref: submitResp?.id || submitResp?.ref });
  } catch (e: any) {
    await supabase.from('x402_transactions').update({ status: 'error' }).eq('id', tx.id);
    return res.status(502).json({ error: e.message || 'facilitator error' });
  }
});

paymentsRouter.post('/notify', async (req, res) => {
  const { request_id, status } = req.body || {};
  if (!request_id || !status) return res.status(400).json({ error: 'request_id & status required' });
  const { data: tx } = await supabase.from('x402_transactions').select('*').eq('request_id', request_id).maybeSingle();
  if (!tx) return res.status(404).json({ error: 'not found' });

  await supabase.from('x402_transactions').update({ status }).eq('id', tx.id);
  if (status === 'settled') {
    await supabase.from('entitlements').insert({
      x402_id: tx.id,
      asset_id: tx.asset_id,
      holder_did: tx.buyer_did,
      rights: ['view']
    });
  }
  return res.json({ ok: true });
});

paymentsRouter.get('/tx/:request_id', requireAuth, async (req, res) => {
  const { request_id } = req.params;
  const { data, error } = await supabase.from('x402_transactions').select('*').eq('request_id', request_id).single();
  if (error) return res.status(404).json({ error: 'not found' });
  res.json(data);
});
