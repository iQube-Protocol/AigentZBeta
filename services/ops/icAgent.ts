import { HttpAgent, Actor } from '@dfinity/agent';
import fetch from 'cross-fetch';

// Generic actor factory using a provided idlFactory
export function getActor<T = Record<string, any>>(canisterId: string, idlFactory: any) {
  const host = process.env.ICP_HOST || process.env.NEXT_PUBLIC_ICP_HOST || 'http://127.0.0.1:4943';
  const agent = new HttpAgent({ host, fetch: fetch as any });
  // In production on mainnet, you may want to call agent.fetchRootKey() only in local environments
  if (host.includes('127.0.0.1') || host.includes('localhost')) {
    // ignore await to avoid unhandled rejection; local only
    agent.fetchRootKey().catch(() => {/* noop */});
  }
  return Actor.createActor<T>(idlFactory, { agent, canisterId });
}
