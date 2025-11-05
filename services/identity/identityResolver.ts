export type ResolvedIdentity = {
  canonicalDid: string;
  displayName?: string;
  personaId?: string;
  verifiedAliases?: Array<{ type: string; value: string }>;
  proofs?: any[];
};

function isDid(input: string) {
  return input.startsWith('did:');
}

function isFio(input: string) {
  return input.includes('@');
}

export async function resolveIdentity(subject: string): Promise<ResolvedIdentity> {
  if (isDid(subject)) {
    return { canonicalDid: subject };
  }
  if (isFio(subject)) {
    const handle = subject.replace(/^fio:/i, '');
    try {
      const base = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const r = await fetch(`${base}/api/identity/fio/lookup?handle=${encodeURIComponent(handle)}`, { cache: 'no-store' });
      if (r.ok) {
        const { data } = await r.json();
        const owner = data?.owner;
        return {
          canonicalDid: `did:iq:alias:fio:${handle}`,
          verifiedAliases: [{ type: 'fio', value: handle }],
          proofs: owner ? [{ type: 'fio_owner_pubkey', value: owner }] : undefined,
        };
      }
    } catch {}
    return { canonicalDid: `did:iq:alias:fio:${handle}`, verifiedAliases: [{ type: 'fio', value: handle }] };
  }
  return { canonicalDid: `did:iq:alias:${subject}` };
}

export async function bindAliasToDid(entityDid: string, aliasType: 'fio'|'evm'|'icp'|'email', aliasValue: string, proofRef?: string) {
  try {
    const { initAgentiqClient } = await import('@qriptoagentiq/core-client');
    const { aliasTtlDays } = await import('../identity/policy');
    const client = initAgentiqClient({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    });
    const supabase = client.supabase;
    const now = new Date();
    const exp = new Date(now.getTime() + aliasTtlDays() * 24 * 60 * 60 * 1000);
    await supabase.from('identity_aliases').insert({
      entity_did: entityDid,
      alias_type: aliasType,
      alias_value: aliasValue,
      verified: true,
      proof_ref: proofRef || null,
      last_verified_at: now.toISOString(),
      expires_at: exp.toISOString(),
    });
  } catch {}
}
