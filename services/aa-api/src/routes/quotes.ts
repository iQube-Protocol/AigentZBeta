import { Router } from 'express';
import { requireAuth } from './mw-auth.js';
import { supabase } from '../db.js';

export const quotesRouter = Router();

quotesRouter.post('/publish', requireAuth, async (req, res) => {
  const { tenant_id } = (req as any).auth;
  const { symbol, bid, ask, mid, source, extra } = req.body || {};
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  const { data, error } = await supabase
    .from('quotes')
    .insert({ tenant_id, symbol, bid, ask, mid, source, extra })
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

quotesRouter.get('/recent', requireAuth, async (req, res) => {
  const { tenant_id } = (req as any).auth;
  const { symbol, limit } = req.query as any;
  const lim = Math.min(parseInt(limit || '25', 10), 100);
  const q = supabase
    .from('quotes')
    .select('*')
    .eq('tenant_id', tenant_id)
    .order('ts', { ascending: false })
    .limit(lim);
  const { data, error } = symbol ? await q.eq('symbol', symbol) : await q;
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});
