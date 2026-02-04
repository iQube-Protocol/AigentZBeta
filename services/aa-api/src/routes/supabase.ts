import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth } from './mw-auth.js';
import { env } from '../env.js';

export const supabaseRouter = Router();

supabaseRouter.post('/jwt', requireAuth, async (req, res) => {
  const { tenant_id, did } = (req as any).auth;
  const { expiresIn } = req.body || {};
  if (!env.SUPABASE_JWT_SECRET) return res.status(500).json({ error: 'SUPABASE_JWT_SECRET not configured' });
  const token = jwt.sign({ sub: did, tenant_id }, env.SUPABASE_JWT_SECRET, { expiresIn: expiresIn || '1h' });
  res.json({ token });
});
