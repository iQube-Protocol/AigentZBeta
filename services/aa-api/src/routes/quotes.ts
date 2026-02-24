import { Router } from 'express';
import { requireAuth } from './mw-auth.js';
import { supabase } from '../db.js';
import { pushToTenant } from '../sse.js';

export const quotesRouter = Router();

// Publish a quote (server-side producers). Auth required.
// Body: { symbol, bid?, ask?, mid?, source?, extra? }
quotesRouter.post('/publish', requireAuth, async (req, res) => {
  try {
    const { tenant_id } = (req as any).auth;
    const { symbol, bid, ask, mid, source, extra } = req.body || {};
    if (!tenant_id || !symbol) return res.status(400).json({ error: 'tenant_id (from token) and symbol required' });

    const insert = {
      tenant_id,
      symbol,
      bid: bid ?? null,
      ask: ask ?? null,
      mid: mid ?? null,
      source: source ?? null,
      extra: extra ?? null
    };

    const { data, error } = await supabase
      .from('quotes')
      .insert(insert)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Broadcast to tenant via SSE
    pushToTenant(tenant_id, 'quote', data);

    return res.json({ ok: true, quote: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'publish failed' });
  }
});

// Fetch recent quotes for current tenant.
// Query: ?symbol=BTC-USD&limit=50
quotesRouter.get('/recent', requireAuth, async (req, res) => {
  try {
    const { tenant_id } = (req as any).auth;
    const { symbol, limit } = req.query as { symbol?: string; limit?: string };

    let q = supabase
      .from('quotes')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('ts', { ascending: false });

    if (symbol) q = q.eq('symbol', symbol);
    const lim = Math.min(Math.max(parseInt(limit || '50', 10), 1), 500);
    q = q.limit(lim);

    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ ok: true, quotes: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'fetch failed' });
  }
});
