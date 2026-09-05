// @vitest-environment jsdom
/**
 * BankrTokenLaunchCapsule + useBankrTokenLaunch — BEHAVIORAL tests (Factor +
 * Aegis Bankr PRD, Phase 6 frontend half). Renders the real capsule with
 * @testing-library/react against a small fake HTTP backend mirroring the
 * real REST contract (app/api/moneypenny/factor/bankr/*) shapes — proving
 * what actually renders/happens, not source-string canaries. Mirrors
 * tests/moneypenny-candidate-intake-workspace.test.tsx's own fake-backend
 * idiom.
 */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';

const personaFetchMock = vi.fn();
vi.mock('@/utils/personaSpine', () => ({ personaFetch: (...args: unknown[]) => personaFetchMock(...args) }));

import { BankrTokenLaunchCapsule } from '../components/moneypenny/bankr/BankrTokenLaunchCapsule';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function jsonRes(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const AGENT_ID = 'agent-under-test';

class FakeBankrBackend {
  binding: Record<string, unknown> | null = null;
  launch: Record<string, unknown> | null = null;
  bankrConfigured = false;

  readiness() {
    return {
      beneficiaryAgentRuntimeId: AGENT_ID,
      bankrConfigured: this.bankrConfigured,
      bankrMode: this.bankrConfigured ? 'live' : 'fake',
      hasProviderWalletBinding: Boolean(this.binding && this.binding.status === 'active'),
      providerWalletBinding: this.binding,
      ready: Boolean(this.binding && this.binding.status === 'active'),
      blockers: this.binding && this.binding.status === 'active' ? [] : [`No active Bankr provider-wallet binding exists for ${AGENT_ID} — provision one first.`],
    };
  }

  fetch = async (url: string, init?: RequestInit): Promise<Response> => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const body = init?.body ? JSON.parse(init.body as string) : {};
    const path = url.split('?')[0];

    if (path === '/api/moneypenny/factor/bankr/readiness' && method === 'POST') {
      if (body.action === 'provision_binding') {
        this.binding = {
          id: 'binding-1',
          tenant_id: 'default',
          agent_runtime_id: AGENT_ID,
          provider: 'bankr',
          metame_owner_wallet_address: '0xOwner',
          metame_settlement_wallet_address: null,
          provider_org_id: null,
          provider_wallet_address: '0xProviderWallet',
          provider_external_profile_id: null,
          allowed_capabilities: [],
          status: 'active',
          non_secret_credential_ref: null,
          verification_evidence: null,
          created_at: '2026-01-01T00:00:00Z',
          revoked_at: null,
          updated_at: '2026-01-01T00:00:00Z',
        };
        return jsonRes(200, { ok: true, readiness: this.readiness(), binding: this.binding });
      }
      return jsonRes(200, { ok: true, readiness: this.readiness() });
    }

    if (path === '/api/moneypenny/factor/bankr/launches' && method === 'POST') {
      this.launch = {
        id: 'launch-1',
        tenant_id: 'default',
        beneficiary_agent_runtime_id: AGENT_ID,
        requesting_principal_persona_id: 'persona-1',
        preparing_agent_runtime_id: 'aigent-factor',
        provider: 'bankr',
        provider_wallet_binding_id: null,
        state: 'preparing',
        execution_mode: 'dry_run',
        chain: body.chain,
        token_name: body.tokenName,
        token_symbol: body.tokenSymbol,
        description: body.description ?? null,
        utility_claims: [],
        image_url: null,
        metadata_url: null,
        website_url: null,
        social_refs: [],
        fee_recipient: null,
        paired_asset: null,
        vesting_config: null,
        bankr_terms: null,
        bankr_terms_source_url: null,
        bankr_terms_retrieved_at: null,
        bankr_terms_hash: null,
        conflict_disclosures: [],
        risk_disclosures: [],
        aegis_assessment_id: null,
        spec_hash: null,
        approval_hash: null,
        approved_by_persona_id: null,
        approved_at: null,
        idempotency_key: null,
        bankr_job_id: null,
        transaction_hash: null,
        token_address: null,
        pool_address: null,
        explorer_url: null,
        version: 1,
        supersedes_id: null,
        superseded_by: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      return jsonRes(200, { ok: true, launch: this.launch });
    }

    if (path.match(/\/api\/moneypenny\/factor\/bankr\/launches\/launch-1\/action$/) && method === 'POST') {
      if (!this.launch) return jsonRes(404, { ok: false, error: 'launch-not-found' });
      if (body.action === 'preflight') {
        this.launch = { ...this.launch, state: 'preflighted', bankr_terms_hash: 'hash-1' };
        return jsonRes(200, {
          ok: true,
          launch: this.launch,
          bankrTerms: { chain: 'base', feeBps: 100, creatorVestingSupported: true, partnerKeySellsFullSupply: true, pairedAssetOptions: ['WETH'], raw: { simulated: true }, sourceUrl: 'https://bankr.bot/fake', retrievedAt: '2026-01-02T00:00:00Z' },
        });
      }
      if (body.action === 'request_approval') {
        this.launch = { ...this.launch, state: 'approval_pending' };
        return jsonRes(200, { ok: true, launch: this.launch });
      }
      if (body.action === 'submit') {
        if (this.launch.state !== 'approved') return jsonRes(400, { ok: false, error: 'not-approved', detail: `Launch is '${this.launch.state}', not 'approved'.` });
        this.launch = { ...this.launch, state: 'submitting', bankr_job_id: 'job-1' };
        return jsonRes(200, { ok: true, launch: this.launch });
      }
      return jsonRes(400, { ok: false, error: 'unknown-action' });
    }

    if (path.match(/\/api\/moneypenny\/factor\/bankr\/launches\/launch-1\/approve$/) && method === 'POST') {
      if (!this.launch || this.launch.state !== 'approval_pending') {
        return jsonRes(400, { ok: false, error: 'not-approval-pending', detail: `Launch is '${this.launch?.state}', not 'approval_pending'.` });
      }
      this.launch = { ...this.launch, state: 'approved', spec_hash: 'spec-hash-abc', approval_hash: 'approval-hash-xyz' };
      return jsonRes(200, { ok: true, launch: this.launch });
    }

    throw new Error(`Unhandled fake-backend request: ${method} ${path}`);
  };
}

function setupBackend() {
  const backend = new FakeBankrBackend();
  personaFetchMock.mockImplementation(backend.fetch);
  return backend;
}

describe('BankrTokenLaunchCapsule', () => {
  it('shows readiness blockers and offers a provision-binding action when no binding exists', async () => {
    setupBackend();
    render(<BankrTokenLaunchCapsule initialPresentation="panel" hideToggle beneficiaryAgentRuntimeId={AGENT_ID} />);

    await waitFor(() => expect(screen.getByText(/No active Bankr provider-wallet binding/)).toBeInTheDocument());
    expect(screen.getByText('Simulated')).toBeInTheDocument(); // bankrConfigured: false -> simulated mode badge
    expect(screen.getByText('Provision binding')).toBeInTheDocument();
  });

  it('provisioning a binding clears the blocker and shows the active binding', async () => {
    setupBackend();
    render(<BankrTokenLaunchCapsule initialPresentation="panel" hideToggle beneficiaryAgentRuntimeId={AGENT_ID} />);

    await waitFor(() => expect(screen.getByText('Provision binding')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Provision binding'));

    await waitFor(() => expect(screen.getByText('active')).toBeInTheDocument());
    expect(screen.getByText(/0xProviderWallet/)).toBeInTheDocument();
  });

  it('never pre-fills the launch-spec form — every field starts empty', async () => {
    setupBackend();
    render(<BankrTokenLaunchCapsule initialPresentation="panel" hideToggle beneficiaryAgentRuntimeId={AGENT_ID} />);

    await waitFor(() => expect(screen.getByPlaceholderText('e.g. base')).toBeInTheDocument());
    expect((screen.getByPlaceholderText('e.g. base') as HTMLInputElement).value).toBe('');
    expect((screen.getByPlaceholderText('e.g. Example Token') as HTMLInputElement).value).toBe('');
    expect((screen.getByPlaceholderText('e.g. EXTK') as HTMLInputElement).value).toBe('');
    // Prepare is disabled until the required fields are filled.
    expect(screen.getByText('Prepare launch proposal')).toBeDisabled();
  });

  it('preparing a launch, running preflight, requesting approval, approving and submitting move the launch through its real state machine', async () => {
    setupBackend();
    render(<BankrTokenLaunchCapsule initialPresentation="panel" hideToggle beneficiaryAgentRuntimeId={AGENT_ID} />);

    await waitFor(() => expect(screen.getByPlaceholderText('e.g. base')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('e.g. base'), { target: { value: 'base' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Example Token'), { target: { value: 'Test Token' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. EXTK'), { target: { value: 'TTK' } });
    fireEvent.click(screen.getByText('Prepare launch proposal'));

    // Once a launch exists, the spec form is gone and the workflow sections
    // (terms/Aegis/approval/deployment/fee-claims) render instead.
    await waitFor(() => expect(screen.getByText('preparing')).toBeInTheDocument());
    expect(screen.queryByPlaceholderText('e.g. base')).not.toBeInTheDocument();

    // Preflight — quotes and records Bankr's (simulated) terms.
    fireEvent.click(screen.getByText('Run deterministic preflight'));
    await waitFor(() => expect(screen.getByText('preflighted')).toBeInTheDocument());
    expect(screen.getByText(/fee: 100 bps/)).toBeInTheDocument();
    expect(screen.getByText('source')).toBeInTheDocument();

    // Approval is a separate section — "Approve" refuses before
    // approval_pending (state machine truthfulness, not merely disabled UI).
    const approveButton = screen.getByText('Approve (MoneyPenny / human principal only)');
    expect(approveButton).toBeDisabled();

    fireEvent.click(screen.getByText('Request MoneyPenny/human approval'));
    await waitFor(() => expect(screen.getByText('approval_pending')).toBeInTheDocument());
    expect(screen.getByText('Approve (MoneyPenny / human principal only)')).not.toBeDisabled();

    fireEvent.click(screen.getByText('Approve (MoneyPenny / human principal only)'));
    await waitFor(() => expect(screen.getByText('Approved')).toBeInTheDocument());
    expect(screen.getByText(/spec spec-hash-a/)).toBeInTheDocument();
    expect(screen.getByText(/approval approval-hash-x/)).toBeInTheDocument();

    // Submission — becomes available only once approved, and a
    // submitted-but-unconfirmed launch reads as "pending", never as a live
    // token (Phase 7 hard rule).
    fireEvent.click(screen.getByText('Submit approved launch to Bankr'));
    await waitFor(() => expect(screen.getByText('Submitted — pending on-chain confirmation')).toBeInTheDocument());
    expect(screen.queryByText('Confirmed on-chain')).not.toBeInTheDocument();
    expect(screen.getByText(/job job-1/)).toBeInTheDocument();
  });

  it('fee-claims surface reports the honest "not known" limitation rather than inventing a claim amount', async () => {
    setupBackend();
    render(<BankrTokenLaunchCapsule initialPresentation="panel" hideToggle beneficiaryAgentRuntimeId={AGENT_ID} />);

    // Fee claims are only meaningful once a launch exists.
    await waitFor(() => expect(screen.getByPlaceholderText('e.g. base')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('e.g. base'), { target: { value: 'base' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Example Token'), { target: { value: 'Test Token' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. EXTK'), { target: { value: 'TTK' } });
    fireEvent.click(screen.getByText('Prepare launch proposal'));

    await waitFor(() => expect(screen.getByText('Not inspected yet.')).toBeInTheDocument());
    // No token address yet -> the inspect button stays disabled, honestly.
    expect(screen.getByText('Inspect fee claims')).toBeDisabled();
  });

  it('compact presentation shows only a one-line summary with no workflow sections, and expands in place without losing state', async () => {
    setupBackend();
    render(<BankrTokenLaunchCapsule initialPresentation="compact" beneficiaryAgentRuntimeId={AGENT_ID} />);

    await waitFor(() => expect(screen.getByText('No launch open yet.')).toBeInTheDocument());
    expect(screen.queryByText('Bankr connection')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Open Bankr console'));
    await waitFor(() => expect(screen.getByText('Bankr connection')).toBeInTheDocument());
  });
});
