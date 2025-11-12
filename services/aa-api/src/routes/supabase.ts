import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth } from './mw-auth.js';
import { env } from '../env.js';

export const supabaseRouter = Router();

// POST /aa/v1/supabase/jwt
// Body: { expiresIn?: string } e.g. "1h" | "15m"
// Returns a Supabase JWT embedding tenant_id for RLS and standard role
supabaseRouter.post('/jwt', requireAuth, async (req, res) => {
  try {
    const { did, tenant_id } = (req as any).auth as { did: string; tenant_id: string };
    const { expiresIn = '1h' } = (req.body || {}) as { expiresIn?: string };

    if (!env.SUPABASE_JWT_SECRET) return res.status(500).json({ error: 'SUPABASE_JWT_SECRET not configured' });

    const claims: any = {
      sub: did,
      role: 'authenticated',
      tenant_id,
    };

    const token = jwt.sign(claims, env.SUPABASE_JWT_SECRET, { algorithm: 'HS256', expiresIn });
    return res.json({ ok: true, token, expiresIn });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed to mint supabase jwt' });
  }
});
