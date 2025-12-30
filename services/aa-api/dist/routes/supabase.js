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
        const { did, tenant_id } = req.auth;
        const expiresInRaw = (req.body?.expiresIn || '1h');
        if (!env.SUPABASE_JWT_SECRET)
            return res.status(500).json({ error: 'SUPABASE_JWT_SECRET not configured' });
        const claims = {
            sub: did,
            role: 'authenticated',
            tenant_id,
        };
        // @ts-expect-error - jwt.sign type inference issue with expiresIn string type
        const token = jwt.sign(claims, env.SUPABASE_JWT_SECRET, { expiresIn: expiresInRaw });
        return res.json({ ok: true, token, expiresIn: expiresInRaw });
    }
    catch (e) {
        return res.status(500).json({ error: e?.message || 'failed to mint supabase jwt' });
    }
});
