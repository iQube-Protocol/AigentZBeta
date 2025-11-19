import { randomUUID } from 'crypto';

export type RemoteSession = {
  id: string;
  did: string;
  persona: string;
  createdAt: number;
  expiresAt: number;
  caps: string[];
  status: 'active' | 'expired' | 'revoked' | 'completed';
};

const SESSIONS = new Map<string, RemoteSession>();

export function createSession(args: { did: string; persona: string; ttlSec?: number; caps?: string[] }): RemoteSession {
  const id = `rc_${randomUUID()}`;
  const now = Date.now();
  const ttl = (args.ttlSec ?? 900) * 1000;
  const sess: RemoteSession = {
    id,
    did: args.did,
    persona: args.persona,
    createdAt: now,
    expiresAt: now + ttl,
    caps: args.caps ?? [],
    status: 'active'
  };
  SESSIONS.set(id, sess);
  return sess;
}

export function getSession(id: string): RemoteSession | undefined {
  const s = SESSIONS.get(id);
  if (!s) return undefined;
  if (s.status === 'active' && Date.now() > s.expiresAt) {
    s.status = 'expired';
    SESSIONS.set(id, s);
  }
  return s;
}

export function revokeSession(id: string): boolean {
  const s = SESSIONS.get(id);
  if (!s) return false;
  s.status = 'revoked';
  SESSIONS.set(id, s);
  return true;
}

export function completeSession(id: string): boolean {
  const s = SESSIONS.get(id);
  if (!s) return false;
  s.status = 'completed';
  SESSIONS.set(id, s);
  return true;
}
