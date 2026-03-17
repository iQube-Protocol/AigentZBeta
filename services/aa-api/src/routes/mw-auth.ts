import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const hdr = req.headers.authorization || '';
  const queryToken =
    typeof req.query.access_token === 'string' && req.query.access_token.trim().length > 0
      ? req.query.access_token.trim()
      : null;
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : queryToken;
  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    const payload = jwt.verify(token, env.AA_JWT_SECRET) as any;
    (req as any).auth = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'invalid token' });
  }
}
