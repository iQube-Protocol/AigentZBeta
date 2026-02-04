import { Router } from 'express';
import { requireAuth } from './mw-auth.js';
import { supabase } from '../db.js';

export const entitlementsRouter = Router();

entitlementsRouter.get('/check', requireAuth, async (req, res) => {
  const { asset_id } = req.query as any;
  const { did } = (req as any).auth;
  if (!asset_id) return res.status(400).json({ error: 'asset_id required' });

  const { data, error } = await supabase
    .from('entitlements')
    .select('*')
    .eq('asset_id', asset_id)
    .eq('holder_did', did)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.json({ entitled: false });
  return res.json({ entitled: true, rights: data.rights, tokenqube_id: data.tokenqube_id, expires_at: data.expires_at });
});
