import { z } from 'zod';

export const baseHeadersSchema = z.object({
  'x-402-intent': z.enum(['iqube.transfer', 'iqube.grant', 'iqube.deliver']),
  'x-402-sender': z.string().min(3),
  'x-402-recipient': z.string().min(3),
  'x-402-asset': z.string().optional(),
  'x-402-amount': z.string().optional(),
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

export function validateByIntent(intent: string, payload: any) {
  if (intent === 'iqube.grant') return grantPayloadSchema.safeParse(payload);
  if (intent === 'iqube.deliver') return deliverPayloadSchema.safeParse(payload);
  if (intent === 'iqube.transfer') return transferPayloadSchema.safeParse(payload);
  return { success: false, error: new Error('Unknown intent') } as any;
}
