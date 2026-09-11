/**
 * Apex sovereignty seam — self-hosted open-weight inference on our OWN
 * decentralised infrastructure (CFS-015, sovereignty apex). STUB: inert until a
 * node is configured; NO node is deployed today, so every fallback ladder still
 * terminates at the third-party open-weight API floor (venice), unchanged.
 *
 * Why a THIRD tier below venice
 * ─────────────────────────────
 * `inv.sovereignty.100` frames sovereignty as a BUNDLE — model openness,
 * provider choice, no commercial lock-in. venice/llama satisfies openness +
 * choice, but its HOSTING is still a third party's: venice could rate-limit,
 * price-gate, or disappear. True apex sovereignty is open-weight models we run
 * on our OWN decentralised infra, where no third party can deny us inference.
 * So the ladder has three sovereignty tiers, most-sovereign LAST:
 *
 *   1. frontier     — third-party CLOSED-weight (openai, anthropic).
 *   2. open-weight  — third-party-HOSTED open-weight (venice). Today's floor.
 *   3. self-hosted  — our own decentralised nodes. ← APEX. The end-state floor.
 *
 * When our nodes are live the `self-hosted` rung becomes the inalienable
 * TERMINAL fallback, below venice — venice stays a rung but is no longer the
 * floor. Until then this seam is env-gated and inert.
 *
 * Integration shape (why the stub is cheap to fill)
 * ─────────────────────────────────────────────────
 * Local / self-hosted inference servers — vLLM, llama.cpp server, Ollama, LM
 * Studio, TGI — expose an OpenAI-compatible `/chat/completions` API, exactly
 * like the venice rung. So the apex rung reuses the venice rung's shape: only
 * the base URL, the model id, and an OPTIONAL bearer key differ. Wiring it in is
 * appending one more rung, not a new protocol.
 *
 * NOT YET BUILT (named future workstream): deploying the decentralised inference
 * infrastructure — node topology, model distribution across nodes, and
 * verification that remote inference was actually performed by our node (not
 * silently proxied) — is the real work this stub reserves the seam for. This
 * module is only the capability placeholder it will fill.
 *
 * Server-only.
 */

import type { SovereigntyTier } from '@/services/constitutional/modelQube';

export type { SovereigntyTier };

/** Env var names for the apex node seam — a single source so every ladder that
 *  adopts the seam reads the SAME configuration. */
export const SOVEREIGN_NODE_ENV = {
  /** OpenAI-compatible base URL of our node, e.g. https://node.iqube…/v1 */
  baseUrl: 'SOVEREIGN_NODE_BASE_URL',
  /** The open-weight model the node serves, e.g. llama-3.3-70b, qwen2.5-72b. */
  model: 'SOVEREIGN_NODE_MODEL',
  /** Optional bearer — many self-hosted servers need none. */
  apiKey: 'SOVEREIGN_NODE_API_KEY',
} as const;

export interface SovereignNodeConfig {
  /** OpenAI-compatible base URL (trailing slash trimmed). */
  baseUrl: string;
  /** The open-weight model served by the node. */
  model: string;
  /** Optional bearer token; absent for keyless self-hosted servers. */
  apiKey?: string;
  tier: SovereigntyTier; // always 'self-hosted' — apex
}

/**
 * The apex node's config from env, or null when no self-hosted node is wired
 * (the default TODAY — every ladder terminates at the open-weight API floor). A
 * node needs at minimum a base URL + a model; the key is optional (keyless
 * self-hosted servers are common). Pure aside from the env read.
 */
export function sovereignNodeConfig(): SovereignNodeConfig | null {
  const baseUrl = process.env[SOVEREIGN_NODE_ENV.baseUrl];
  const model = process.env[SOVEREIGN_NODE_ENV.model];
  if (!baseUrl || !model) return null;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    model,
    apiKey: process.env[SOVEREIGN_NODE_ENV.apiKey] || undefined,
    tier: 'self-hosted',
  };
}

/**
 * True when an apex self-hosted node is configured — i.e. the terminal
 * sovereign rung is OUR own infra, not the third-party open-weight API. False
 * today (stub): no node deployed. Ladders consult this to decide which rung
 * carries the sovereign floor (apex displaces venice as the floor when live).
 */
export function sovereignNodeConfigured(): boolean {
  return sovereignNodeConfig() !== null;
}
