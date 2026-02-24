import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../env.js';
const challenges = new Map(); // did -> nonce
export const authRouter = Router();
authRouter.post('/challenge', (req, res) => {
    const { did } = req.body || {};
    if (!did)
        return res.status(400).json({ error: 'did required' });
    const nonce = crypto.randomBytes(16).toString('hex');
    challenges.set(did, nonce);
    res.json({ nonce });
});
authRouter.post('/verify', async (req, res) => {
    const { did, signature } = req.body || {};
    if (!did || !signature)
        return res.status(400).json({ error: 'did & signature required' });
    const nonce = challenges.get(did);
    if (!nonce)
        return res.status(400).json({ error: 'no active challenge' });
    // TODO: verify signature according to DID method
    // For now accept any non-empty signature to unblock dev
    challenges.delete(did);
    const token = jwt.sign({ did, tenant_id: '00000000-0000-0000-0000-000000000000' }, env.AA_JWT_SECRET, { expiresIn: '12h' });
    res.json({ aa_token: token, tenant_id: '00000000-0000-0000-0000-000000000000' });
});
