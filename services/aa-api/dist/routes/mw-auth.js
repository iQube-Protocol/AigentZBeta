import jwt from 'jsonwebtoken';
import { env } from '../env.js';
export function requireAuth(req, res, next) {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token)
        return res.status(401).json({ error: 'missing token' });
    try {
        const payload = jwt.verify(token, env.AA_JWT_SECRET);
        req.auth = payload;
        next();
    }
    catch {
        return res.status(401).json({ error: 'invalid token' });
    }
}
