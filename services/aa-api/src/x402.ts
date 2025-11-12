import crypto from 'crypto';
import { env } from './env.js';
import fetch from 'node-fetch';

export function signX402(payload: Record<string, any>): string {
  const h = crypto.createHmac('sha256', Buffer.from(env.X402_SIGNING_PRIVATE_KEY || 'dev'));
  h.update(JSON.stringify(payload));
  return h.digest('hex');
}

export async function submitToFacilitator(headers: Record<string, string>, body: any) {
  const endpoint = env.X402_FACILITATOR_ENDPOINT;
  if (!endpoint) throw new Error('X402_FACILITATOR_ENDPOINT not set');
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`[x402] facilitator error ${r.status}`);
  return r.json();
}
