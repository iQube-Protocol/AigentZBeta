import { HttpAgent, Actor } from '@dfinity/agent';
import fetch from 'cross-fetch';

// Generic actor factory using a provided idlFactory
export async function getActor<T = Record<string, any>>(canisterId: string, idlFactory: any) {
  const explicitHost = process.env.ICP_HOST || process.env.NEXT_PUBLIC_ICP_HOST;
  const isLocal = (process.env.DFX_NETWORK || '').toLowerCase() === 'local';
  const host = explicitHost || (isLocal ? 'http://127.0.0.1:4943' : 'https://icp-api.io');
  const agent = new HttpAgent({ host, fetch: fetch as any });
  // In production on mainnet, you may want to call agent.fetchRootKey() only in local environments
  if (host.includes('127.0.0.1') || host.includes('localhost')) {
    // Properly await fetchRootKey for local development
    try {
      await agent.fetchRootKey();
    } catch (e) {
      console.warn('Failed to fetch root key:', e);
    }
  }
  return Actor.createActor<T>(idlFactory, { agent, canisterId });
}
