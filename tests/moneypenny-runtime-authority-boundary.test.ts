/**
 * MoneyPenny Runtime — Principal-Delegate Separation canary (PRD-MPY-001
 * Phase 4, Increments P4-2/P4-3/P4-5/P4-6).
 *
 * MoneyPenny may form and accept her own side of a Constitutional Agreement
 * (see moneyPennyArchitect / the RuntimePanel's Form+Accept buttons), but
 * only a human, acting through the browser, may authorize one. This test
 * pins that boundary structurally: the Runtime route must never import or
 * call `authorizeAgreement`; capabilityRef/selectedAgentRef are never read
 * from the request body (a client-supplied ref could otherwise point the
 * 409 gate at an unrelated, settlement-bearing agreement); and — since
 * P4-5/P4-6 — Investment/Market resolve to a DISTINCT capabilityRef from
 * Financial Intelligence, so the two risk tiers are gated by two
 * independent agreements, never one shared 409 lookup.
 *
 * Mirrors the readFileSync source-scan style of
 * tests/irl-run-lifecycle.test.ts's "route never imports X" canaries.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const ROUTE_PATH = join(process.cwd(), 'app/api/moneypenny/runtime/route.ts');
const ARCHITECT_ROUTE_PATH = join(process.cwd(), 'app/api/moneypenny/architect/route.ts');
const PANEL_PATH = join(process.cwd(), 'app/(shell)/moneypenny/components/RuntimePanel.tsx');
const RECEIPT_SERVICE_PATH = join(process.cwd(), 'services/receipts/activityReceiptService.ts');
const DVN_PIPELINE_PATH = join(process.cwd(), 'services/dvn/activityReceiptDvnPipeline.ts');
const WALLET_RUNTIME_PATH = join(process.cwd(), 'app/components/wallet/MoneyPennyWalletRuntime.tsx');
const WALLET_ARCHITECT_PATH = join(process.cwd(), 'app/components/wallet/MoneyPennyWalletArchitect.tsx');
const WALLET_DRAWER_PATH = join(process.cwd(), 'app/components/content/SmartWalletDrawer.tsx');
const AGREEMENT_SERVICE_PATH = join(process.cwd(), 'services/constitutional/constitutionalAgreement.ts');
const PERSONHOOD_PROOF_PATH = join(process.cwd(), 'services/passport/personhoodProof.ts');

describe('MoneyPenny Runtime route — authority boundary', () => {
  it('never imports or calls authorizeAgreement', () => {
    const src = readFileSync(ROUTE_PATH, 'utf8');
    expect(src).not.toContain('authorizeAgreement');
  });

  it('never imports settlementExecutor (no fund movement in this route)', () => {
    const src = readFileSync(ROUTE_PATH, 'utf8');
    expect(src.toLowerCase()).not.toContain('settlementexecutor');
  });

  it('P4-6: resolves a DISTINCT capabilityRef for Investment/Market than Financial Intelligence', () => {
    const src = readFileSync(ROUTE_PATH, 'utf8');
    expect(src).toContain("const MONEYPENNY_SETTLEMENT_CAPABILITY_REF = 'cap-moneypenny-financial-services-settlement';");
    expect(src).toMatch(/capabilityRef\s*=\s*domain\s*===\s*'intelligence'\s*\?\s*MONEYPENNY_CAPABILITY_REF\s*:\s*MONEYPENNY_SETTLEMENT_CAPABILITY_REF/);
  });

  it('P4-5/P4-6: no code-level domain clamp — mode passes straight through, the 409 gate is the boundary', () => {
    const src = readFileSync(ROUTE_PATH, 'utf8');
    expect(src).not.toMatch(/authoritativeAllowed/);
    expect(src).toMatch(/const mode = body\.mode === 'authoritative' \? 'authoritative' : 'shadow';/);
  });

  it('never reads capabilityRef/selectedAgentRef from the request body — always MoneyPenny\'s fixed refs', () => {
    const src = readFileSync(ROUTE_PATH, 'utf8');
    expect(src).not.toContain('body.capabilityRef');
    expect(src).not.toContain('body.selectedAgentRef');
    expect(src).toMatch(/selectedAgentRef\s*=\s*MONEYPENNY_AGENT_REF/);
  });
});

describe('P4-5 — the money-moving grade gate (graded proof-of-humanity)', () => {
  it('authorizeAgreement enforces the world-id requirement against a persisted, existing signal', () => {
    const src = readFileSync(AGREEMENT_SERVICE_PATH, 'utf8');
    expect(src).toContain("import { PROOF_REQUIREMENT } from '@/services/constitutional/guidedOnboarding';");
    expect(src).toContain("import { hasVerifiedWorldIdPassport } from '@/services/passport/personhoodProof';");
    expect(src).toContain('requirements.includes(PROOF_REQUIREMENT.world_id)');
    expect(src).toContain('hasVerifiedWorldIdPassport(personaId)');
    // Fails CLOSED: an agreement carrying the world-id requirement without a
    // verified passport must refuse, never fall through to authorization.
    expect(src).toMatch(/if\s*\(!verified\)\s*\{\s*return\s*\{\s*ok:\s*false,/);
  });

  it('hasVerifiedWorldIdPassport reads the SAME persisted column the verify-worldid route stamps -- no new verification store', () => {
    const src = readFileSync(PERSONHOOD_PROOF_PATH, 'utf8');
    expect(src).toContain("from('polity_passport_records')");
    expect(src).toContain("'world_id_verified_at'");
    expect(src).toContain("eq('revoked', false)");
  });
});

describe('P4-6 — RuntimePanel forms the settlement-tier agreement with the world-id requirement', () => {
  it('imports PROOF_REQUIREMENT and requires world_id on the settlement agreement, never on the intelligence one', () => {
    const src = readFileSync(PANEL_PATH, 'utf8');
    expect(src).toContain('import { PROOF_REQUIREMENT } from "@/services/constitutional/guidedOnboarding";');
    expect(src).toContain('verificationRequirements: [PROOF_REQUIREMENT.world_id]');
  });

  it('domain buttons are no longer disabled -- Investment/Market are selectable', () => {
    const src = readFileSync(PANEL_PATH, 'utf8');
    expect(src).not.toMatch(/disabled=\{d !== "intelligence"\}/);
  });
});

describe('MoneyPenny Runtime route — P4-4 receipt + DVN provenance', () => {
  it('emits a finance_authoritative_execution receipt only for authoritative+executed runs', () => {
    const src = readFileSync(ROUTE_PATH, 'utf8');
    expect(src).toContain("actionType: 'finance_authoritative_execution'");
    expect(src).toMatch(/mode === 'authoritative' && result\.executed/);
  });

  it('finance_authoritative_execution is a declared ActivityActionType', () => {
    const src = readFileSync(RECEIPT_SERVICE_PATH, 'utf8');
    expect(src).toContain("| 'finance_authoritative_execution'");
  });

  it('finance_authoritative_execution is DVN-anchorable', () => {
    const src = readFileSync(DVN_PIPELINE_PATH, 'utf8');
    expect(src).toContain("'finance_authoritative_execution'");
  });
});

describe('MoneyPenny Architect route — proposal-only boundary (regression)', () => {
  it('never imports authorizeAgreement, acceptAgreement, or settlementExecutor', () => {
    const src = readFileSync(ARCHITECT_ROUTE_PATH, 'utf8');
    expect(src).not.toContain('authorizeAgreement');
    expect(src).not.toContain('acceptAgreement');
    expect(src.toLowerCase()).not.toContain('settlementexecutor');
  });
});

describe('RuntimePanel — client-side agreement lifecycle', () => {
  it('uses personaFetch, never raw fetch, for the spine-authenticated runtime + agreement calls', () => {
    const src = readFileSync(PANEL_PATH, 'utf8');
    // no raw global fetch( -- personaFetch only (its lowercase never matches "Fetch(")
    expect(src).not.toMatch(/[^A-Za-z]fetch\(/);
    expect(src).toContain('personaFetch(');
  });

  it('offers form/accept/authorize as three distinct actions (no single "approve-all")', () => {
    const src = readFileSync(PANEL_PATH, 'utf8');
    expect(src).toContain('"form"');
    expect(src).toContain('"accept"');
    expect(src).toContain('"authorize"');
  });
});

describe('MoneyPenny wallet surface (SmartWalletDrawer) — Architect/Runtime, same authority boundary', () => {
  it('MoneyPennyWalletRuntime uses personaFetch, never raw fetch, for the spine-authenticated runtime call', () => {
    const src = readFileSync(WALLET_RUNTIME_PATH, 'utf8');
    // no raw global fetch( -- personaFetch only (its lowercase never matches "Fetch(")
    expect(src).not.toMatch(/[^A-Za-z]fetch\(/);
    expect(src).toContain('personaFetch(');
  });

  it('MoneyPennyWalletRuntime never imports or calls authorizeAgreement, and never renders a Form/Accept/Authorize control', () => {
    const src = readFileSync(WALLET_RUNTIME_PATH, 'utf8');
    expect(src).not.toContain('authorizeAgreement');
    expect(src).not.toContain('acceptAgreement');
    expect(src).not.toContain('"form"');
    expect(src).not.toContain('"accept"');
    expect(src).not.toContain('"authorize"');
  });

  it('MoneyPennyWalletRuntime never requests authoritative mode -- always shadow, always Financial Intelligence', () => {
    const src = readFileSync(WALLET_RUNTIME_PATH, 'utf8');
    expect(src).not.toContain("mode: 'authoritative'");
    expect(src).not.toContain('mode: "authoritative"');
    expect(src).toMatch(/domain:\s*["']intelligence["']/);
    expect(src).toMatch(/mode:\s*["']shadow["']/);
  });

  it('MoneyPennyWalletRuntime deep-links to the full cartridge for the Agreement lifecycle instead of duplicating it', () => {
    const src = readFileSync(WALLET_RUNTIME_PATH, 'utf8');
    expect(src).toContain('/moneypenny');
  });

  it('MoneyPennyWalletArchitect uses personaFetch, never raw fetch, and never imports settlement/authorize/accept', () => {
    const src = readFileSync(WALLET_ARCHITECT_PATH, 'utf8');
    expect(src).not.toMatch(/[^A-Za-z]fetch\(/);
    expect(src).toContain('personaFetch(');
    expect(src).not.toContain('authorizeAgreement');
    expect(src).not.toContain('acceptAgreement');
    expect(src.toLowerCase()).not.toContain('settlementexecutor');
  });

  it('SmartWalletDrawer wires both wallet panels into the MoneyPenny tab additively (Chat sub-mode untouched)', () => {
    const src = readFileSync(WALLET_DRAWER_PATH, 'utf8');
    expect(src).toContain('MoneyPennyWalletArchitect');
    expect(src).toContain('MoneyPennyWalletRuntime');
    // The pre-existing Chat/avatar copy must still be present verbatim --
    // this is the additive-only canary for the wallet surface.
    expect(src).toContain('MoneyPenny is ready to help with your wallet, rewards, and Q¢ questions.');
  });
});
