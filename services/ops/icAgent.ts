import { HttpAgent, Actor } from '@dfinity/agent';
import fetch from 'cross-fetch';

// Generic actor factory using a provided idlFactory
export async function getActor<T = Record<string, any>>(canisterId: string, idlFactory: any) {
  const explicitHost = process.env.ICP_HOST || process.env.NEXT_PUBLIC_ICP_HOST;
  const isLocal = (process.env.DFX_NETWORK || '').toLowerCase() === 'local';
  const isMainnet = (process.env.DFX_NETWORK || 'ic').toLowerCase() === 'ic';
  
  // Force ic0.app for mainnet to ensure query signatures are available
  let host = explicitHost || (isLocal ? 'http://127.0.0.1:4943' : (isMainnet ? 'https://ic0.app' : 'https://icp-api.io'));

  // If attempting to use a local replica, probe reachability and fall back to mainnet gateway if unreachable
  if (host.includes('127.0.0.1') || host.includes('localhost')) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const resp = await (fetch as any)(`${host}/api/v2/status`, { method: 'GET', cache: 'no-store', signal: controller.signal });
      clearTimeout(timeout);
      if (!resp?.ok) throw new Error('Local replica status not OK');
    } catch (_e) {
      // Fall back to certificate-providing gateway to avoid ECONNREFUSED in staging/prod
      host = isMainnet ? 'https://ic0.app' : 'https://icp-api.io';
    }
  }

  // Optional server identity for authenticated updates
  let identity: any = undefined;
  let pem: string | undefined = process.env.DFX_IDENTITY_PEM || process.env.NEXT_PUBLIC_DFX_IDENTITY_PEM;
  const pemPath = process.env.DFX_IDENTITY_PEM_PATH;
  if (!pem && pemPath) {
    try {
      const { readFileSync } = await import('fs');
      pem = readFileSync(pemPath, 'utf8');
    } catch {
      // ignore file read errors and fall back to anonymous
    }
  }
  if (pem && typeof pem === 'string' && pem.includes('BEGIN') && pem.includes('KEY')) {
    try {
      const idMod: any = await import('@dfinity/identity');
      if (idMod?.Ed25519KeyIdentity?.fromPem) {
        try { identity = idMod.Ed25519KeyIdentity.fromPem(pem); } catch {}
      }
      if (!identity && idMod?.Secp256k1KeyIdentity?.fromPem) {
        try { identity = idMod.Secp256k1KeyIdentity.fromPem(pem); } catch {}
      }
    } catch {
      // identity module not available; continue anonymously
    }
  }

  const agent = new HttpAgent({ host, ...(identity ? { identity } : {}), fetch: fetch as any });

  // Only fetch root key when talking to a local replica
  if (host.includes('127.0.0.1') || host.includes('localhost')) {
    try {
      await agent.fetchRootKey();
    } catch (e) {
      console.warn('Failed to fetch root key:', e);
    }
  }

  return Actor.createActor<T>(idlFactory, { agent, canisterId });
}
