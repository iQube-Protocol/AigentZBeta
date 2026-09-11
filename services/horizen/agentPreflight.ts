/**
 * Read-only Agent-N preflight — the operator's go/no-go check before
 * recording an Agent-N journey (Horizen Pilot Closure item 7, 2026-08-09).
 *
 * ── CONTRACT ─────────────────────────────────────────────────────────────
 *
 * Every check here is READ-ONLY. Nothing in this module signs, submits,
 * broadcasts, settles a fact, or writes a receipt — it composes the SAME
 * canonical readers the journey state route and the register/verify/ratify
 * routes already use (inv.engineering.036/037), never a second, parallel
 * resolution of the same question. One check's exception is isolated from
 * every other (Constitutional Execution Family — Exception Isolation): a
 * thrown read degrades that ONE line to DEGRADED, never the whole report.
 *
 * Five-valued outcome, per the operator's own vocabulary:
 *   READY            — the precondition is met and ready to be exercised
 *   ALREADY_COMPLETE — the act this line represents has already happened
 *   BLOCKED          — a real, named obstruction; the reason says what
 *   DEGRADED         — this check could not be completed (audit gap), not a negative finding
 *   NOT_REQUIRED     — this line does not apply to the current stage/agent
 */

import type { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveRegistrableAgent, type RegistrableAgentConfig } from './registrableAgents';
import { getAssetRuntimeDescriptor } from '@/services/registry/runtimeDescriptor';
import { HORIZEN_REGISTRY_MCP } from './client';
import { findAgentReceiptRefs } from '@/services/receipts/activityReceiptService';
import { readSettledFact, isSettled } from '@/services/journey/settledFacts';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveAgentAdmissionState } from '@/services/journey/agentAdmissionState';
import { resolveAgentRegistrationState } from '@/services/horizen/agentRegistrationBinding';

export type PreflightOutcome = 'READY' | 'ALREADY_COMPLETE' | 'BLOCKED' | 'DEGRADED' | 'NOT_REQUIRED';

export interface PreflightLine {
  id: string;
  label: string;
  outcome: PreflightOutcome;
  reason: string;
}

export interface PreflightReport {
  agentSlug: string;
  agentDisplayName: string;
  generatedAt: string;
  identity: PreflightLine[];
  authority: PreflightLine[];
  infrastructure: PreflightLine[];
  verification: PreflightLine[];
  consequence: PreflightLine[];
  /** True only when nothing in the report is BLOCKED — DEGRADED/NOT_REQUIRED never block a go/no-go read. */
  goNoGo: 'GO' | 'BLOCKED';
}

async function line(id: string, label: string, run: () => Promise<Omit<PreflightLine, 'id' | 'label'>>): Promise<PreflightLine> {
  try {
    const result = await run();
    return { id, label, ...result };
  } catch (err) {
    return {
      id,
      label,
      outcome: 'DEGRADED',
      reason: `check threw: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Bounded, read-only reachability probe — never throws, never signs, never mutates. DEGRADED (not BLOCKED) on any failure: unreachable is not proof of absence. */
async function probeReachable(url: string, init: RequestInit, timeoutMs = 4000): Promise<{ ok: true } | { ok: false; detail: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      // Any HTTP response (even 4xx/5xx) proves the endpoint is reachable —
      // only a network-level failure or timeout means "could not check".
      return res ? { ok: true } : { ok: false, detail: 'no response object' };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

export async function runAgentPreflight(agentSlug: string, request: NextRequest | null, agentCardBase: string): Promise<PreflightReport> {
  const agent: RegistrableAgentConfig | null = resolveRegistrableAgent(agentSlug);
  if (!agent) {
    return {
      agentSlug,
      agentDisplayName: agentSlug,
      generatedAt: new Date().toISOString(),
      identity: [{ id: 'runtime-agent-id', label: 'Canonical runtimeAgentId', outcome: 'BLOCKED', reason: `"${agentSlug}" is not a registrable agent` }],
      authority: [],
      infrastructure: [],
      verification: [],
      consequence: [],
      goNoGo: 'BLOCKED',
    };
  }

  const supabase = getSupabaseServer();
  const activePersona = request ? await getActivePersona(request).catch(() => null) : null;

  // ── Identity / config ──────────────────────────────────────────────────
  const identity: PreflightLine[] = [
    await line('runtime-agent-id', 'Canonical runtimeAgentId', async () => ({
      outcome: 'ALREADY_COMPLETE',
      reason: `resolves to "${agent.runtimeAgentId}" via services/horizen/registrableAgents.ts`,
    })),
    await line('agent-card', 'Agent Card', async () => {
      const probe = await probeReachable(`${agentCardBase}${agent.agentCardPath}`, { method: 'GET', cache: 'no-store' });
      return probe.ok
        ? { outcome: 'ALREADY_COMPLETE', reason: `served at ${agent.agentCardPath}` }
        : { outcome: 'DEGRADED', reason: `could not reach ${agent.agentCardPath}: ${probe.detail}` };
    }),
    await line('registry-configuration', 'Registry configuration (registry_assets row)', async () => {
      if (!supabase) return { outcome: 'DEGRADED', reason: 'no Supabase admin client available' };
      const { data, error } = await supabase.from('registry_assets').select('asset_id').eq('asset_id', agent.aigentQubeId).maybeSingle();
      if (error) return { outcome: 'DEGRADED', reason: `read failed: ${error.message}` };
      return data
        ? { outcome: 'ALREADY_COMPLETE', reason: `registry_assets row exists for "${agent.aigentQubeId}"` }
        : { outcome: 'BLOCKED', reason: `no registry_assets row for "${agent.aigentQubeId}" — no AigentQube persisted yet (this is a Register prerequisite, distinct from Factory ingestion — see the "deploy-factory-ingestion" line below)` };
    }),
    await line('runtime-endpoint', 'Runtime endpoint descriptor', async () => {
      if (!supabase) return { outcome: 'DEGRADED', reason: 'no Supabase admin client available' };
      const descriptor = await getAssetRuntimeDescriptor(supabase, agent.aigentQubeId);
      return descriptor?.endpoint
        ? { outcome: 'ALREADY_COMPLETE', reason: `metadata.runtime.endpoint = ${descriptor.endpoint}` }
        : {
            outcome: 'BLOCKED',
            reason: `no metadata.runtime.endpoint for "${agent.aigentQubeId}" — required (RegistrableAgentConfig.runtimeHealthPath: ${agent.runtimeHealthPath}); seed via the matching migration (see 20260930002300_moneypenny_runtime_endpoint.sql for the pattern)`,
          };
    }),
  ];

  // ── Authority ───────────────────────────────────────────────────────────
  const admission = supabase ? await resolveAgentAdmissionState(supabase, agent).catch(() => null) : null;
  const authority: PreflightLine[] = [
    await line('operator-persona', 'Operator/persona', async () =>
      activePersona?.personaId
        ? { outcome: 'ALREADY_COMPLETE', reason: 'active persona resolved from the request' }
        : { outcome: 'BLOCKED', reason: 'no active persona could be resolved — the operator must be authenticated' },
    ),
    await line('root-did', 'RootDID (agent_root_identity)', async () =>
      admission?.agentRootId
        ? { outcome: 'ALREADY_COMPLETE', reason: `agent_root_identity row exists (id=${admission.agentRootId})` }
        : { outcome: 'NOT_REQUIRED', reason: 'not yet sponsored — RootDID mints as a consequence of sponsorship, not a precondition of preflight' },
    ),
    await line('principal-wallet', 'Principal wallet', async () => {
      if (!activePersona?.personaId) return { outcome: 'BLOCKED', reason: 'cannot classify a wallet with no resolved persona' };
      const { classifyPersonaWalletCapability } = await import('@/services/identity/personaAddressResolver');
      const capability = await classifyPersonaWalletCapability(activePersona.personaId, 'base');
      if (capability.capability === 'SIGNER_CONFIGURED') return { outcome: 'ALREADY_COMPLETE', reason: capability.detail };
      if (capability.capability === 'UNAVAILABLE') return { outcome: 'DEGRADED', reason: capability.detail };
      return { outcome: 'BLOCKED', reason: `${capability.detail}${capability.remediation ? ` ${capability.remediation}` : ''}` };
    }),
    await line('agent-key', "Agent's own custodied wallet (agent_keys)", async () => {
      const { AgentKeyService } = await import('@/services/identity/agentKeyService');
      const addresses = await new AgentKeyService().getAgentAddresses(agent.runtimeAgentId);
      return addresses?.evmAddress
        ? { outcome: 'ALREADY_COMPLETE', reason: `custodied EVM address on record for "${agent.runtimeAgentId}"` }
        : { outcome: 'BLOCKED', reason: `no agent_keys row for "${agent.runtimeAgentId}" — Register cannot build a transaction without it` };
    }),
    await line('passport', 'Operator Polity Citizen Passport', async () => {
      if (!supabase) return { outcome: 'DEGRADED', reason: 'no Supabase admin client available' };
      const settled = await readSettledFact(supabase, agent.aigentQubeId, 'operator', 'passport_is_issued');
      return isSettled(settled)
        ? { outcome: 'ALREADY_COMPLETE', reason: 'passport_is_issued settled fact present' }
        : { outcome: 'NOT_REQUIRED', reason: 'not yet settled — resolved dynamically at the Passport stage, not a hard preflight precondition' };
    }),
    await line('delegation', 'Delegation (delegation_grants active)', async () =>
      admission?.delegationActive
        ? { outcome: 'ALREADY_COMPLETE', reason: 'an active delegation_grants row exists for this agent' }
        : { outcome: 'NOT_REQUIRED', reason: 'not yet delegated — a later stage, not a precondition of registration' },
    ),
  ];

  // ── Infrastructure ──────────────────────────────────────────────────────
  const infrastructure: PreflightLine[] = [
    await line('receipt-persistence', 'Receipt persistence (Supabase)', async () =>
      supabase
        ? { outcome: 'READY', reason: 'Supabase admin client configured' }
        : { outcome: 'BLOCKED', reason: 'Supabase configuration missing — no receipt can be written' },
    ),
    await line('dvn-submission', 'DVN submission (cross-chain canister)', async () => {
      const canisterId = process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID;
      return canisterId
        ? { outcome: 'READY', reason: 'CROSS_CHAIN_SERVICE_CANISTER_ID configured' }
        : { outcome: 'BLOCKED', reason: 'CROSS_CHAIN_SERVICE_CANISTER_ID not configured — receipts stay local, never dvn_pending' };
    }),
    await line('dvn-finalizer', 'DVN reconciler/finalizer liveness (cron)', async () => {
      const token = process.env.CRON_TRIGGER_TOKEN;
      return token
        ? { outcome: 'READY', reason: 'CRON_TRIGGER_TOKEN configured — activity-receipts-finalizer.yml and horizen-registration-reconciler.yml can authenticate' }
        : { outcome: 'BLOCKED', reason: 'CRON_TRIGGER_TOKEN not configured — the scheduled finalizer/reconciler routes will 503' };
    }),
    await line('horizen-registry-api', "Horizen registry MCP reachability", async () => {
      const probe = await probeReachable(HORIZEN_REGISTRY_MCP, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'ping' }) });
      return probe.ok
        ? { outcome: 'READY', reason: `reached ${HORIZEN_REGISTRY_MCP}` }
        : { outcome: 'DEGRADED', reason: `could not reach ${HORIZEN_REGISTRY_MCP}: ${probe.detail} — this environment may lack outbound network access` };
    }),
    await line('base-sepolia-rpc', 'Base Sepolia RPC reachability', async () => {
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || 'https://sepolia.base.org';
      const probe = await probeReachable(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'eth_chainId', params: [] }) });
      return probe.ok
        ? { outcome: 'READY', reason: `reached ${rpcUrl}` }
        : { outcome: 'DEGRADED', reason: `could not reach ${rpcUrl}: ${probe.detail} — this environment may lack outbound network access` };
    }),
    await line('registration-reconciler', 'Registration reconciler (scheduled)', async () => ({
      outcome: 'READY',
      reason: 'code-complete: app/api/ops/horizen/reconcile-registrations/route.ts + .github/workflows/horizen-registration-reconciler.yml (this line reports code readiness, not a live self-probe)',
    })),
  ];

  // ── Verification ─────────────────────────────────────────────────────────
  const registration = supabase ? await resolveAgentRegistrationState(supabase, agent).catch(() => null) : null;
  const hasReceipt = async (actionType: Parameters<typeof findAgentReceiptRefs>[1][number]): Promise<boolean> => {
    const refs = await findAgentReceiptRefs(agent.runtimeAgentId, [actionType], { limit: 1 });
    return refs.length > 0;
  };
  const verification: PreflightLine[] = [
    await line('constitutional-agreement', 'Constitutional Agreement (Ratify)', async () => {
      const { resolveRatificationRefs } = await import('@/services/journey/ratificationRefs');
      const { getAgreement, agreementOwnerCommitment } = await import('@/services/constitutional/constitutionalAgreement');
      if (!activePersona?.personaId) return { outcome: 'BLOCKED', reason: 'cannot resolve an agreement with no active persona' };
      const refs = resolveRatificationRefs(agent.slug);
      const row = await getAgreement(refs.agreementId);
      const isOwn = row && row.object.ownership.ownerCommitment === agreementOwnerCommitment(activePersona.personaId);
      return isOwn
        ? { outcome: 'ALREADY_COMPLETE', reason: `constitutional_agreements row "${refs.agreementId}" owned by this operator` }
        : { outcome: 'NOT_REQUIRED', reason: 'not yet formed — a later stage, not a registration precondition' };
    }),
    await line('pulse-authorization', 'Horizen Pulse authorization', async () =>
      (await hasReceipt('horizen_pulse_authorized'))
        ? { outcome: 'ALREADY_COMPLETE', reason: 'horizen_pulse_authorized receipt present' }
        : { outcome: 'NOT_REQUIRED', reason: 'not yet authorized — ancillary, never a registration precondition' },
    ),
    await line('pnl-authorization', 'P&L disclosure authorization', async () =>
      (await hasReceipt('horizen_pnl_transparency_enabled'))
        ? { outcome: 'ALREADY_COMPLETE', reason: 'horizen_pnl_transparency_enabled receipt present' }
        : { outcome: 'NOT_REQUIRED', reason: 'not yet authorized — ancillary' },
    ),
    await line('pnl-verification', 'P&L service verification (independent)', async () =>
      (await hasReceipt('pnl_service_verified'))
        ? { outcome: 'ALREADY_COMPLETE', reason: 'pnl_service_verified receipt present — Horizen independently correlated a PnL record' }
        : registration?.registered
          ? { outcome: 'READY', reason: 'registration confirmed — services/horizen/pnlVerificationBoundary.ts will attempt this on the next journey-state read; never gates Ratify/Standing per RES-2026-08-08-PNL-INDEPENDENT-EVIDENCE-001' }
          : { outcome: 'NOT_REQUIRED', reason: 'no confirmed registration yet — nothing to correlate' },
    ),
  ];

  // ── Consequence ──────────────────────────────────────────────────────────
  /*
   * `admission?.factoryPresent` (mere AigentQube/registry-row existence)
   * deliberately excluded (operator correction, 2026-08-09) — it answers
   * "does this agent's AigentQube exist", not "was this agent Factory-
   * ingested". See app/api/journey/moneypenny-horizen/state/route.ts's
   * `stages.deploy.factoryIngested` comment for the full causal chain.
   */
  const factoryIngested = await hasReceipt('capability_registered');
  const standingSeeded = supabase ? isSettled(await readSettledFact(supabase, agent.aigentQubeId, agent.runtimeAgentId, 'registry_standing_seeded')) : false;
  const consequence: PreflightLine[] = [
    await line('deploy-factory-ingestion', 'Deploy / factory-ingestion path', async () =>
      factoryIngested
        ? { outcome: 'ALREADY_COMPLETE', reason: 'capability_registered receipted — factory ingestion observed' }
        : { outcome: 'BLOCKED', reason: 'no capability_registered receipt — this agent has not been Factory-ingested (AigentQube/registry-row presence alone does not count, see the note above)' },
    ),
    await line('standing-seed', 'Registration Standing seed', async () =>
      standingSeeded
        ? { outcome: 'ALREADY_COMPLETE', reason: 'registry_standing_seeded settled — the nominal seed has been awarded' }
        : factoryIngested
          ? { outcome: 'READY', reason: 'factory ingestion observed — services/journey/registrationStandingSeedAward.ts will award the one-time seed on the next journey-state read' }
          : { outcome: 'NOT_REQUIRED', reason: 'not yet eligible — awaiting factory ingestion' },
    ),
  ];

  const allLines = [...identity, ...authority, ...infrastructure, ...verification, ...consequence];
  const goNoGo: PreflightReport['goNoGo'] = allLines.some((l) => l.outcome === 'BLOCKED') ? 'BLOCKED' : 'GO';

  return {
    agentSlug: agent.slug,
    agentDisplayName: agent.displayName,
    generatedAt: new Date().toISOString(),
    identity,
    authority,
    infrastructure,
    verification,
    consequence,
    goNoGo,
  };
}
