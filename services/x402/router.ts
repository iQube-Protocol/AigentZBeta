import { verifyX402Signature } from './signing';
import { baseHeadersSchema, custodyPayloadSchema, claimPayloadSchema } from './schemas';
import { verifyDVNAttestation, extractRoot } from './dvn';

export type DeliveryMode = 'custody' | 'claim' | 'canonical';

export interface X402Header {
  intent: 'iqube.grant'|'iqube.transfer'|'asset.claim'|'asset.send'|'iqube.deliver';
  delivery_mode?: DeliveryMode;
  sender: string;     // DID
  recipient: string;  // DID
  dvn_attest?: string; // hex/root
  signature?: string;  // sender sig over (headers||body)
}

export interface CustodyBody {
  iqube_ref: string;
  capability?: {
    scope: string[];
    limits?: { rpm?: number; tokens_per_day?: number };
    ttl?: string;
    aud?: string;
    nonce?: string;
  };
  settlement?: { asset: string; amount: string };
  meta_anchor?: { cid?: string; hash?: string };
}

export async function handleX402(msg: { headers: Record<string,string>; body: any }) {
  // Basic header validation
  const h = baseHeadersSchema.parse(msg.headers as any);

  // Optional DID signature verification (upstream routes already verify)
  await verifyX402Signature(msg.headers as any, msg.body);

  // Optional DVN root verification stub
  if (h['x-402-dvn-attest']) {
    await verifyDVNAttestation(h['x-402-dvn-attest'], msg).catch(() => undefined);
  }

  const mode = (h['x-402-delivery-mode'] || '').toLowerCase() as DeliveryMode | '';
  switch (mode) {
    case 'custody':
      return handleCustody(msg);
    case 'claim':
      return handleClaim(msg);
    case 'canonical':
    default:
      return handleCanonical(msg);
  }
}

export async function handleCustody(msg: { headers: Record<string,string>; body: CustodyBody }) {
  // Validate body
  const b = custodyPayloadSchema.parse({
    iqube_ref: msg.body.iqube_ref || msg.headers['x-402-ref'],
    capability: msg.body.capability,
    settlement: msg.body.settlement,
    meta_anchor: msg.body.meta_anchor,
  });

  // Parse simple iq ref: iq:<chain>/<contract>/<tokenId>
  let chain: string | null = null;
  try { const p = String(b.iqube_ref).split(':')[1]?.split('/') || []; chain = p[0] || null; } catch {}

  // Derive DVN root if present
  const dvnRoot = msg.headers['x-402-dvn-attest'] ? extractRoot(msg.headers['x-402-dvn-attest'] as string) : null;

  // Placeholder: business logic to call on-chain ACL would go here
  // e.g. contracts(chain).TokenQubeACL.grantCapability(...)

  return { ok: true, chain, dvn_root: dvnRoot };
}

export async function handleClaim(msg: { headers: Record<string,string>; body: any }) {
  // Validate body
  const c = claimPayloadSchema.parse(msg.body);
  const claimId = c.claim_id || '0x' + cryptoRandomHex(32);
  const fromChain = (msg.body.from_chain || msg.headers['x-402-chain-from'] || 'polygon') as string;

  // Placeholder: persist is already handled in route. Here we return normalized object.
  return {
    ok: true,
    claim: {
      id: claimId,
      asset: c.rights.asset,
      amount: c.rights.amount,
      from_chain: fromChain,
      to_chain: c.redeem_to.chain,
      to_did: msg.headers['x-402-recipient'],
      expiry: c.expiry || null,
      dvn_root: msg.headers['x-402-dvn-attest'] || null,
    }
  };
}

export async function handleCanonical(_msg: { headers: Record<string,string>; body: any }) {
  // No-op; existing canonical flow is handled by settlement code paths
  return { ok: true };
}

function cryptoRandomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else if (typeof global !== 'undefined' && (global as any).crypto) {
    // Node fallback
    const { randomFillSync } = (global as any).crypto;
    randomFillSync(arr);
  } else {
    throw new Error('Cryptographic random number generation not available');
  }
  return Buffer.from(arr).toString('hex');
}
