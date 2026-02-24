import crypto from 'crypto';
import { env } from './env.js';
import fetch from 'node-fetch';
export function signX402(payload) {
    // Placeholder HMAC sign. Replace with your canonical x402 signing (e.g., secp256k1)
    const h = crypto.createHmac('sha256', Buffer.from(env.X402_SIGNING_PRIVATE_KEY));
    h.update(JSON.stringify(payload));
    return h.digest('hex');
}
export async function submitToFacilitator(headers, body) {
    const r = await fetch(env.X402_FACILITATOR_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body)
    });
    if (!r.ok)
        throw new Error(`[x402] facilitator error ${r.status}`);
    return r.json();
}
