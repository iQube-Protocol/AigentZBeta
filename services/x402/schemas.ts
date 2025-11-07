import { z } from 'zod';

export const baseHeadersSchema = z.object({
  'x-402-intent': z.enum(['iqube.transfer', 'iqube.grant', 'iqube.deliver', 'asset.claim', 'asset.send']),
  'x-402-sender': z.string().min(3),
  'x-402-recipient': z.string().min(3),
  'x-402-asset': z.string().optional(),
  'x-402-amount': z.string().optional(),
  'x-402-delivery-mode': z.enum(['custody', 'claim', 'canonical']).optional(),
  'x-402-dvn-attest': z.string().optional(),
  'x-402-ref': z.string().optional(),
});

export const grantPayloadSchema = z.object({
  capability: z.object({
    iqube_ref: z.string().min(3),
    scope: z.array(z.string()).min(1),
    ttl: z.string().optional(),
    nonce: z.string().optional(),
  }),
  acl_delta_sig: z.string().optional(),
});

export const deliverPayloadSchema = z.object({
  meta: z.object({ cid: z.string(), hash: z.string() }).optional(),
  blak: z.object({ uri: z.string(), hash: z.string() }).optional(),
  license: z.string().optional(),
  settlement: z.any().optional(),
});

export const transferPayloadSchema = z.object({
  iqube_ref: z.string().min(3),
  actions: z.array(z.literal('transfer_ownership')).min(1),
  settlement: z.any().optional(),
  bridge: z.object({ name: z.string(), nonce: z.number().optional() }).optional(),
  attestations: z.array(z.any()).optional(),
});

// Custody body closely aligns with grant; grant/custody uses the same schema in our handler
export const custodyPayloadSchema = z.object({
  iqube_ref: z.string().min(3),
  capability: z.object({
    scope: z.array(z.string()).min(1),
    limits: z.object({ rpm: z.number().optional(), tokens_per_day: z.number().optional() }).partial().optional(),
    ttl: z.string().optional(),
    aud: z.string().optional(),
    nonce: z.string().optional(),
  }).optional(),
  settlement: z.object({ asset: z.string(), amount: z.string() }).optional(),
  meta_anchor: z.object({ cid: z.string(), hash: z.string() }).partial().optional(),
});

export const claimPayloadSchema = z.object({
  claim_id: z.string().optional(),
  rights: z.object({ asset: z.string(), amount: z.string() }),
  redeem_to: z.object({ chain: z.string(), recipient: z.string() }),
  expiry: z.string().optional(),
  from_chain: z.string().optional(),
});

export function validateByIntent(intent: string, payload: any, headers?: Record<string, string>) {
  if (intent === 'iqube.grant') return grantPayloadSchema.safeParse(payload);
  if (intent === 'iqube.deliver') return deliverPayloadSchema.safeParse(payload);
  if (intent === 'iqube.transfer') return transferPayloadSchema.safeParse(payload);
  if (intent === 'asset.claim') return claimPayloadSchema.safeParse(payload);
  // For delivery-mode based validation (optional enhancement):
  const mode = headers?.['x-402-delivery-mode'];
  if (mode === 'custody') return custodyPayloadSchema.safeParse(payload);
  return { success: false, error: new Error('Unknown intent') } as any;
}
