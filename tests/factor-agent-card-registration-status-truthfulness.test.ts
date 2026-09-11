/**
 * Factor's Agent Card — registry_entry status must never contradict
 * metadata.horizen (Factor Operate blocker closeout, 2026-09-06).
 *
 * Live-verified defect (2026-09-06 closeout doc): Factor's live
 * `registry_assets.metadata.external_registry_bindings[0]` shows
 * `status: 'registered'`, `token_id: '9176'` — confirmed via direct
 * Supabase read against project bsjhfvctmduxhohtllly. `metadata.horizen`
 * projects this correctly (it always did — `binding?.token_id ?? null`).
 * But `registry_entry.status`/`status_note` were a SEPARATE, hand-typed
 * literal written 2026-09-05 (before the live registration) claiming "Horizen
 * registration pending" / "No on-chain registration broadcast has occurred"
 * — a fact frozen at write time, never re-derived, and therefore a direct
 * contradiction against the SAME document's own `metadata.horizen.tokenId`
 * the moment registration actually completed.
 *
 * Fix: registry_entry.status/status_note are now DERIVED from the same
 * `binding` metadata.horizen already projects — one canonical registration
 * reader, never a second hand-typed claim. These tests exercise the real
 * route handler against an injected Supabase double, proving both branches
 * agree.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

let bindingRow: { metadata: { external_registry_bindings: unknown[] } } | null = null;

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: bindingRow, error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock('@/services/factor/factorCapabilityManifest', () => ({
  FACTOR_CAPABILITIES: [],
}));

vi.mock('@/app/api/agents/_lib/requestOrigin', () => ({
  resolveRequestOrigin: () => 'https://example.test',
}));

// Owner/settlement wallet + runtime descriptor lookups (AgentKeyService,
// AgentPurposeWalletService, getAssetRuntimeDescriptor) are each wrapped in
// their own try/catch in the real route (soft-fail by design — "must never
// 500 on a registry read") and are irrelevant to registry_entry
// truthfulness; left unmocked, they throw against this test's Supabase
// double and the route's own catch blocks resolve them to null, exactly as
// production does when a purpose wallet has not been provisioned yet.

beforeEach(() => {
  bindingRow = null;
  vi.resetModules();
});

async function fetchCard() {
  const { GET } = await import('@/app/api/agents/factor/agent-card.json/route');
  const res = await GET(new NextRequest('https://example.test/api/agents/factor/agent-card.json'));
  return res.json();
}

describe('Factor Agent Card — registry_entry.status agrees with metadata.horizen (never contradicts it)', () => {
  it('BEFORE registration: both honestly say pending, and status_note names the real reason', async () => {
    bindingRow = null; // no binding row at all yet
    const json = await fetchCard();

    expect(json.metadata.horizen.tokenId).toBeNull();
    expect(json.registry_entry.status).toMatch(/pending/i);
    expect(json.registry_entry.status_note).toMatch(/no on-chain registration broadcast has occurred/i);
  });

  it('AFTER registration: metadata.horizen.tokenId is set AND registry_entry.status says so — never "pending" alongside a real tokenId', async () => {
    bindingRow = {
      metadata: {
        external_registry_bindings: [
          {
            status: 'registered',
            network: 'base-sepolia',
            protocol: 'erc-8004',
            registry: 'horizen',
            token_id: '9176',
            registry_alias: '0x23d8',
            agent_identifier: null,
            human_readable_url: null,
            identity_registry_contract: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
          },
        ],
      },
    };
    const json = await fetchCard();

    expect(json.metadata.horizen.tokenId).toBe('9176');
    expect(json.metadata.horizen.status).toBe('registered');
    // The exact contradiction that was live: never "pending" once a real
    // tokenId is confirmed.
    expect(json.registry_entry.status).not.toMatch(/pending/i);
    expect(json.registry_entry.status).toMatch(/9176/);
    expect(json.registry_entry.status_note).not.toMatch(/no on-chain registration broadcast has occurred/i);
    expect(json.registry_entry.status_note).toMatch(/9176/);
  });

  it('a stored binding with a token_id but a NON-"registered" status (a real edge case: submitted-but-unconfirmed) still reports honestly pending, never falsely confirmed', async () => {
    bindingRow = {
      metadata: {
        external_registry_bindings: [
          {
            status: 'submitted',
            network: 'base-sepolia',
            token_id: '4242',
          },
        ],
      },
    };
    const json = await fetchCard();

    expect(json.metadata.horizen.tokenId).toBe('4242');
    expect(json.metadata.horizen.status).toBe('submitted');
    // Not registered yet — registry_entry must not claim confirmation it
    // does not have, even though a tokenId string exists.
    expect(json.registry_entry.status).toMatch(/pending/i);
  });
});
