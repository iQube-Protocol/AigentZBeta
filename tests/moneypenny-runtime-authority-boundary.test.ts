/**
 * MoneyPenny Runtime — Principal-Delegate Separation canary (PRD-MPY-001
 * Phase 4, Increments P4-2/P4-3/P4-5/P4-6).
 *
 * MoneyPenny may form and accept her own side of a Constitutional Agreement
 * (see moneyPennyArchitect / the RuntimePanel's Form+Accept buttons), but
 * only a human, acting through the browser, may authorize one.
 *
 * HARDENED 2026-07-26 — this file used to pin that boundary with raw
 * `readFileSync` + `.not.toContain(...)` greps over whole source files. Two
 * failure modes made that a bad instrument for a boundary this important:
 *
 *   • FALSE RED — a route whose own header DOCUMENTS the boundary by naming
 *     the forbidden symbol failed its own canary. That happened here (the
 *     Architect route) and three other times in this repo. A canary that
 *     cries wolf gets ignored, and this one guards money movement.
 *   • WEAK EVIDENCE — a grep for `body.capabilityRef` proves only that one
 *     spelling is absent. It says nothing about what the route actually passes
 *     to the pipeline, which is the property that matters.
 *
 * So the assertions are now graded by strength:
 *
 *   1. BEHAVIOURAL (strongest) — the payload boundary and the domain→
 *      capabilityRef split are proved by DRIVING the route with an adversarial
 *      body and asserting on what `runConstitutionalServicePattern` received.
 *   2. IMPORT AUTHORITY — "never imports authorizeAgreement" is read from a
 *      real TSX AST (`tests/_lib/sourceAuthority`), at BINDING granularity.
 *      Binding, not module, is the correct grain: `constitutionalAgreement.ts`
 *      exports both the forbidden `authorizeAgreement` and the REQUIRED
 *      `requireAuthorizedAgreement`, so a module-level check would flag every
 *      compliant consumer of the 409 gate. Namespace imports and dynamic
 *      `import()`/`require()` of that module count as hits, so the boundary
 *      cannot be laundered through an escape hatch.
 *   3. COMMENT-STRIPPED GREP — kept only for genuinely source-level properties
 *      with no runtime surface (a client component using `personaFetch` rather
 *      than raw `fetch`, a control not being rendered).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readSource, stripComments, forbiddenImportFindings } from './_lib/sourceAuthority';

vi.mock('@/app/api/dev-command-center/_lib/persona', () => ({
  resolvePersonaOrTimeout: vi.fn(),
  PERSONA_TIMEOUT_MESSAGE: 'persona timeout',
}));
vi.mock('@/services/constitutional/constitutionalServicePipeline', () => ({
  runConstitutionalServicePattern: vi.fn(),
}));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: vi.fn(),
}));

import { POST } from '@/app/api/moneypenny/runtime/route';
import { resolvePersonaOrTimeout } from '@/app/api/dev-command-center/_lib/persona';
import { runConstitutionalServicePattern } from '@/services/constitutional/constitutionalServicePipeline';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

const mockedPersona = resolvePersonaOrTimeout as unknown as ReturnType<typeof vi.fn>;
const mockedPipeline = runConstitutionalServicePattern as unknown as ReturnType<typeof vi.fn>;
const mockedReceipt = createActivityReceipt as unknown as ReturnType<typeof vi.fn>;

const ROUTE_PATH = 'app/api/moneypenny/runtime/route.ts';
const ARCHITECT_ROUTE_PATH = 'app/api/moneypenny/architect/route.ts';
const PANEL_PATH = 'app/(shell)/moneypenny/components/RuntimePanel.tsx';
const RECEIPT_SERVICE_PATH = 'services/receipts/activityReceiptService.ts';
const DVN_PIPELINE_PATH = 'services/dvn/activityReceiptDvnPipeline.ts';
const WALLET_RUNTIME_PATH = 'app/components/wallet/MoneyPennyWalletRuntime.tsx';
const WALLET_ARCHITECT_PATH = 'app/components/wallet/MoneyPennyWalletArchitect.tsx';
const WALLET_DRAWER_PATH = 'app/components/content/SmartWalletDrawer.tsx';
const AGREEMENT_SERVICE_PATH = 'services/constitutional/constitutionalAgreement.ts';
const PERSONHOOD_PROOF_PATH = 'services/passport/personhoodProof.ts';

/** Modules that export the forbidden authority bindings — the hints that make
 *  namespace and dynamic-import escape hatches detectable. */
const AUTHORITY_MODULE_HINTS = ['constitutionalAgreement', 'settlementExecutor'];

// ───────────────────────── 1. Behavioural: the payload boundary ─────────────

/** Drive the route with an arbitrary body and return what the pipeline got. */
async function callRoute(body: unknown) {
  mockedPipeline.mockResolvedValue({ executed: false, agreementId: null, execution: null });
  const request = { json: async () => body } as unknown as Parameters<typeof POST>[0];
  const response = await POST(request);
  return { response, pipelineArgs: mockedPipeline.mock.calls.at(-1)?.[0] };
}

describe('MoneyPenny Runtime route — payload boundary (behavioural)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPersona.mockResolvedValue({ status: 'ok', persona: { personaId: 'persona-under-test' } });
    mockedReceipt.mockResolvedValue(undefined);
  });

  it('IGNORES a client-supplied capabilityRef and selectedAgentRef', async () => {
    // The attack this closes: a caller points the 409 gate at an unrelated
    // agreement that was authorized elsewhere WITH settlementTerms attached,
    // while still claiming the read-only domain here. The refs must be the
    // route's own constants no matter what arrives in the body.
    const { pipelineArgs } = await callRoute({
      intent: 'check my balance',
      capabilityRef: 'cap-someone-elses-authorized-settlement-agreement',
      selectedAgentRef: 'agent-attacker',
    });
    expect(pipelineArgs.capabilityRef).toBe('cap-moneypenny-financial-services');
    expect(pipelineArgs.selectedAgentRef).toBe('agent-moneypenny');
  });

  it('P4-6: Investment and Market resolve to a DIFFERENT capabilityRef than Financial Intelligence', async () => {
    // Two risk tiers must be gated by two INDEPENDENT agreement rows. The
    // agreement primitive's authorization lookup is keyed on
    // capabilityRef+selectedAgentRef+persona with no domain awareness of its
    // own, so a shared ref would let an authorized read-only agreement gate
    // open a money-moving call.
    const intel = (await callRoute({ intent: 'x', domain: 'intelligence' })).pipelineArgs;
    const invest = (await callRoute({ intent: 'x', domain: 'investment' })).pipelineArgs;
    const market = (await callRoute({ intent: 'x', domain: 'market' })).pipelineArgs;

    expect(intel.capabilityRef).not.toBe(invest.capabilityRef);
    expect(invest.capabilityRef).toBe(market.capabilityRef);
    // Pinned literals: these key live agreement rows, so a rename silently
    // orphans the human's already-authorized agreement.
    expect(intel.capabilityRef).toBe('cap-moneypenny-financial-services');
    expect(invest.capabilityRef).toBe('cap-moneypenny-financial-services-settlement');
  });

  it('falls back to the READ-ONLY intelligence tier for an unrecognised domain', async () => {
    for (const domain of ['settlement', 'INVESTMENT', '', null, 42, { evil: true }]) {
      const { pipelineArgs } = await callRoute({ intent: 'x', domain });
      expect(pipelineArgs.domain, `domain=${JSON.stringify(domain)}`).toBe('intelligence');
      expect(pipelineArgs.capabilityRef).toBe('cap-moneypenny-financial-services');
    }
  });

  it('P4-5: mode passes straight through — no code-level domain clamp', async () => {
    // Operator-authorised 2026-07-24: the REAL boundary is the pipeline's own
    // step-3 409 gate (plus the World-ID grade), which fails closed with a
    // clear reason. A code clamp here would silently downgrade to shadow and
    // hide the refusal.
    expect((await callRoute({ intent: 'x', domain: 'investment', mode: 'authoritative' })).pipelineArgs.mode)
      .toBe('authoritative');
    expect((await callRoute({ intent: 'x', domain: 'intelligence', mode: 'authoritative' })).pipelineArgs.mode)
      .toBe('authoritative');
  });

  it('defaults to shadow for any mode that is not exactly "authoritative"', async () => {
    for (const mode of ['shadow', 'Authoritative', undefined, true, 'authoritative ']) {
      const { pipelineArgs } = await callRoute({ intent: 'x', mode });
      expect(pipelineArgs.mode, `mode=${JSON.stringify(mode)}`).toBe('shadow');
    }
  });

  it('refuses an empty intent and never reaches the pipeline', async () => {
    const { response, pipelineArgs } = await callRoute({ intent: '   ' });
    expect(response.status).toBe(400);
    expect(pipelineArgs).toBeUndefined();
  });

  it('fails closed on an unauthenticated caller', async () => {
    mockedPersona.mockResolvedValue({ status: 'unauthenticated' });
    const { response, pipelineArgs } = await callRoute({ intent: 'x' });
    expect(response.status).toBe(401);
    expect(pipelineArgs).toBeUndefined();
  });
});

describe('MoneyPenny Runtime route — P4-4 receipt provenance (behavioural)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPersona.mockResolvedValue({ status: 'ok', persona: { personaId: 'persona-under-test' } });
    mockedReceipt.mockResolvedValue(undefined);
  });

  const drive = async (body: unknown, pipelineResult: unknown) => {
    mockedPipeline.mockResolvedValue(pipelineResult);
    await POST({ json: async () => body } as unknown as Parameters<typeof POST>[0]);
    return mockedReceipt.mock.calls.at(-1)?.[0];
  };

  it('emits finance_authoritative_execution ONLY for an authoritative run that executed', async () => {
    const receipt = await drive(
      { intent: 'move it', domain: 'investment', mode: 'authoritative' },
      { executed: true, agreementId: 'agr-1', execution: { evidenceRefs: ['inv.x'] } },
    );
    expect(receipt?.actionType).toBe('finance_authoritative_execution');
    expect(receipt?.policyEnvelopeId).toBe('agr-1');
  });

  it('emits NO receipt for a shadow run, or for an authoritative run that did not execute', async () => {
    await drive({ intent: 'x', mode: 'shadow' }, { executed: true, agreementId: 'agr-2', execution: null });
    expect(mockedReceipt).not.toHaveBeenCalled();
    await drive({ intent: 'x', mode: 'authoritative' }, { executed: false, agreementId: null, execution: null });
    expect(mockedReceipt).not.toHaveBeenCalled();
  });

  it('a receipt failure never fails the call that already executed', async () => {
    mockedReceipt.mockRejectedValue(new Error('receipt store down'));
    mockedPipeline.mockResolvedValue({ executed: true, agreementId: 'agr-3', execution: { evidenceRefs: [] } });
    const response = await POST({
      json: async () => ({ intent: 'x', mode: 'authoritative' }),
    } as unknown as Parameters<typeof POST>[0]);
    expect(response.status).toBe(200);
  });
});

// ───────────────────────── 2. Import authority (AST) ────────────────────────

describe('MoneyPenny Runtime route — authority by import', () => {
  it('never binds authorizeAgreement or settlementExecutor, by any route', () => {
    expect(
      forbiddenImportFindings(
        readSource(ROUTE_PATH),
        ['authorizeAgreement', 'settlementExecutor', 'executeSettlement'],
        AUTHORITY_MODULE_HINTS,
      ),
    ).toEqual([]);
  });
});

describe('MoneyPenny Architect route — proposal-only boundary (regression)', () => {
  it('never binds authorizeAgreement, acceptAgreement, or settlementExecutor', () => {
    // The route's own header names all three symbols to DOCUMENT the boundary.
    // Reading the AST rather than the text is what stops that prose from
    // reading as a violation.
    expect(
      forbiddenImportFindings(
        readSource(ARCHITECT_ROUTE_PATH),
        ['authorizeAgreement', 'acceptAgreement', 'settlementExecutor'],
        AUTHORITY_MODULE_HINTS,
      ),
    ).toEqual([]);
  });
});

describe('MoneyPenny wallet surfaces — authority by import', () => {
  it('MoneyPennyWalletRuntime never binds an agreement-lifecycle or settlement symbol', () => {
    expect(
      forbiddenImportFindings(
        readSource(WALLET_RUNTIME_PATH),
        ['authorizeAgreement', 'acceptAgreement', 'formAgreement', 'settlementExecutor'],
        AUTHORITY_MODULE_HINTS,
      ),
    ).toEqual([]);
  });

  it('MoneyPennyWalletArchitect never binds authorize/accept/settlement', () => {
    expect(
      forbiddenImportFindings(
        readSource(WALLET_ARCHITECT_PATH),
        ['authorizeAgreement', 'acceptAgreement', 'settlementExecutor'],
        AUTHORITY_MODULE_HINTS,
      ),
    ).toEqual([]);
  });
});

// ───────────────────────── 3. Source-level properties ───────────────────────

describe('P4-5 — the money-moving grade gate (graded proof-of-humanity)', () => {
  it('authorizeAgreement enforces the world-id requirement against a persisted, existing signal', () => {
    const code = stripComments(readSource(AGREEMENT_SERVICE_PATH));
    expect(code).toContain("import { PROOF_REQUIREMENT } from '@/services/constitutional/guidedOnboarding';");
    expect(code).toContain("import { hasVerifiedWorldIdPassport } from '@/services/passport/personhoodProof';");
    expect(code).toContain('requirements.includes(PROOF_REQUIREMENT.world_id)');
    expect(code).toContain('hasVerifiedWorldIdPassport(personaId)');
    // Fails CLOSED: an agreement carrying the world-id requirement without a
    // verified passport must refuse, never fall through to authorization.
    expect(code).toMatch(/if\s*\(!verified\)\s*\{\s*return\s*\{\s*ok:\s*false,/);
  });

  it('hasVerifiedWorldIdPassport reads the SAME persisted column the verify-worldid route stamps -- no new verification store', () => {
    const code = stripComments(readSource(PERSONHOOD_PROOF_PATH));
    expect(code).toContain("from('polity_passport_records')");
    expect(code).toContain("'world_id_verified_at'");
    expect(code).toContain("eq('revoked', false)");
  });
});

describe('P4-6 — RuntimePanel forms the settlement-tier agreement with the world-id requirement', () => {
  it('imports PROOF_REQUIREMENT and requires world_id on the settlement agreement', () => {
    const code = stripComments(readSource(PANEL_PATH));
    expect(code).toContain('import { PROOF_REQUIREMENT } from "@/services/constitutional/guidedOnboarding";');
    expect(code).toContain('verificationRequirements: [PROOF_REQUIREMENT.world_id]');
  });

  it('domain buttons are no longer disabled -- Investment/Market are selectable', () => {
    expect(stripComments(readSource(PANEL_PATH))).not.toMatch(/disabled=\{d !== "intelligence"\}/);
  });
});

describe('finance_authoritative_execution is a declared, anchorable action type', () => {
  it('is a declared ActivityActionType', () => {
    expect(stripComments(readSource(RECEIPT_SERVICE_PATH))).toContain("| 'finance_authoritative_execution'");
  });

  it('is DVN-anchorable', () => {
    expect(stripComments(readSource(DVN_PIPELINE_PATH))).toContain("'finance_authoritative_execution'");
  });
});

describe('RuntimePanel — client-side agreement lifecycle', () => {
  it('uses personaFetch, never raw fetch, for the spine-authenticated runtime + agreement calls', () => {
    // Source-level by nature: the rule is about which client transport the
    // component reaches for, and there is no runtime surface that reveals it.
    const code = stripComments(readSource(PANEL_PATH));
    expect(code).not.toMatch(/[^A-Za-z]fetch\(/);
    expect(code).toContain('personaFetch(');
  });

  it('offers form/accept/authorize as three distinct actions (no single "approve-all")', () => {
    const code = stripComments(readSource(PANEL_PATH));
    expect(code).toContain('"form"');
    expect(code).toContain('"accept"');
    expect(code).toContain('"authorize"');
  });
});

describe('MoneyPenny wallet surface (SmartWalletDrawer) — same authority boundary', () => {
  it('MoneyPennyWalletRuntime uses personaFetch, never raw fetch', () => {
    const code = stripComments(readSource(WALLET_RUNTIME_PATH));
    expect(code).not.toMatch(/[^A-Za-z]fetch\(/);
    expect(code).toContain('personaFetch(');
  });

  it('MoneyPennyWalletRuntime renders no Form/Accept/Authorize control', () => {
    const code = stripComments(readSource(WALLET_RUNTIME_PATH));
    expect(code).not.toContain('"form"');
    expect(code).not.toContain('"accept"');
    expect(code).not.toContain('"authorize"');
  });

  it('MoneyPennyWalletRuntime never requests authoritative mode -- always shadow, always Financial Intelligence', () => {
    const code = stripComments(readSource(WALLET_RUNTIME_PATH));
    expect(code).not.toContain("mode: 'authoritative'");
    expect(code).not.toContain('mode: "authoritative"');
    expect(code).toMatch(/domain:\s*["']intelligence["']/);
    expect(code).toMatch(/mode:\s*["']shadow["']/);
  });

  it('MoneyPennyWalletRuntime deep-links to the full cartridge for the Agreement lifecycle instead of duplicating it', () => {
    expect(stripComments(readSource(WALLET_RUNTIME_PATH))).toContain('/moneypenny');
  });

  it('MoneyPennyWalletArchitect uses personaFetch, never raw fetch', () => {
    const code = stripComments(readSource(WALLET_ARCHITECT_PATH));
    expect(code).not.toMatch(/[^A-Za-z]fetch\(/);
    expect(code).toContain('personaFetch(');
  });

  it('SmartWalletDrawer wires both wallet panels into the MoneyPenny tab additively (Chat sub-mode untouched)', () => {
    const code = stripComments(readSource(WALLET_DRAWER_PATH));
    expect(code).toContain('MoneyPennyWalletArchitect');
    expect(code).toContain('MoneyPennyWalletRuntime');
    // The pre-existing Chat/avatar copy must still be present verbatim --
    // this is the additive-only canary for the wallet surface.
    expect(code).toContain('MoneyPenny is ready to help with your wallet, rewards, and Q¢ questions.');
  });
});
