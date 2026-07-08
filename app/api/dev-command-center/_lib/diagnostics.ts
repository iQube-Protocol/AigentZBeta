/**
 * Diagnostics composition for the Dev Command Center tool viewports (CFS-020
 * CDE) — the Terminal `status` / `env-check` / `canisters` / `receipts`
 * commands and the DevTools instrument cluster both read from here.
 *
 * This module COMPOSES existing admin probes — it does not fork their logic:
 *   - Canister health: `getCanisterHealth()` from services/ops/icpService (the
 *     existing callable probe fn; the same one /api/ops/canisters/health uses).
 *   - Receipts pipeline: `listActivityReceiptsForPersona()` from the canonical
 *     activity-receipt READ path (listing only — creation is never touched).
 *   - Env presence: presence booleans over the same env-var names the
 *     check-env diagnostic reads — names + present/absent ONLY, never values.
 *
 * Tier discipline: nothing here emits an env VALUE or a T0 identifier. Receipt
 * listings are filtered to T2-safe fields (id, actionType, status, createdAt).
 */

import { getCanisterHealth } from '@/services/ops/icpService';
import { getDVNStatus } from '@/services/ops/dvnService';
import { listActivityReceiptsForPersona } from '@/services/receipts/activityReceiptService';
import type { ReceiptStatus } from '@/services/receipts/activityReceiptService';
import type { EnvPresence } from '@/services/devCommandCenter/terminalCommands';

// ─── Probe timeboxing (CDE viewport hang fix, 2026-07-08) ───────────────────
//
// EVERY external probe below (IC canister health, DVN canister status, the
// receipt read) is raced against a hard deadline: a diagnostics surface must
// DEGRADE HONESTLY, never hang. A slow/unreachable canister previously left the
// bare `await` pending forever, hanging the DevTools/Terminal viewports (the
// operator-reported regression). On timeout the probe resolves to an honest
// "unavailable" fallback so the route returns promptly and the UI shows the
// degraded state instead of spinning. The probe implementations themselves are
// untouched (they live in the protected ops/receipts layer) — the deadline is
// applied here, at the composition boundary the CDE owns.

/** Hard deadline for a single external probe, in ms. */
export const PROBE_TIMEOUT_MS = 6000;

/**
 * Race `p` against a deadline; on timeout resolve to `fallback` (never reject,
 * never hang). Pure aside from the timer, which is always cleared.
 */
export function withTimeout<T>(p: Promise<T>, fallback: T, ms = PROBE_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(fallback);
    }, ms);
    p.then(
      (v) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        // A probe that REJECTS is also honest degradation, not a hang.
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

// ─── Environment presence (names + booleans only — NEVER values) ────────────

/**
 * Presence of the env vars the platform reads, checked with the SAME
 * server-or-NEXT_PUBLIC fallback the codebase uses elsewhere. Returns only
 * `{ name, present }` — a value can never leak through this shape.
 */
export function computeEnvPresence(): EnvPresence[] {
  const has = (...v: (string | undefined)[]) => v.some((x) => Boolean(x && x.length > 0));
  return [
    { name: 'NEXT_PUBLIC_SUPABASE_URL', present: has(process.env.NEXT_PUBLIC_SUPABASE_URL) },
    {
      name: 'SUPABASE_SERVICE_ROLE_KEY',
      present: has(process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY),
    },
    { name: 'DFX_IDENTITY_PEM', present: has(process.env.DFX_IDENTITY_PEM, process.env.NEXT_PUBLIC_DFX_IDENTITY_PEM) },
    {
      name: 'CROSS_CHAIN_SERVICE_CANISTER_ID',
      present: has(process.env.CROSS_CHAIN_SERVICE_CANISTER_ID, process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID),
    },
    {
      name: 'PROOF_OF_STATE_CANISTER_ID',
      present: has(process.env.PROOF_OF_STATE_CANISTER_ID, process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID),
    },
    { name: 'EVM_RPC_CANISTER_ID', present: has(process.env.EVM_RPC_CANISTER_ID, process.env.NEXT_PUBLIC_EVM_RPC_CANISTER_ID) },
    { name: 'RQH_CANISTER_ID', present: has(process.env.RQH_CANISTER_ID, process.env.NEXT_PUBLIC_RQH_CANISTER_ID) },
    { name: 'REWARD_HUB_CANISTER_ID', present: has(process.env.REWARD_HUB_CANISTER_ID, process.env.NEXT_PUBLIC_REWARD_HUB_CANISTER_ID) },
    { name: 'ANTHROPIC_API_KEY', present: has(process.env.ANTHROPIC_API_KEY) },
    { name: 'OPENAI_API_KEY', present: has(process.env.OPENAI_API_KEY) },
    { name: 'GITHUB_TOKEN', present: has(process.env.GITHUB_TOKEN) },
    { name: 'LINEAR_API_KEY', present: has(process.env.LINEAR_API_KEY) },
  ];
}

export interface EnvSummary {
  present: number;
  total: number;
  missing: string[];
}

export function summariseEnv(presence: EnvPresence[]): EnvSummary {
  const missing = presence.filter((p) => !p.present).map((p) => p.name);
  return { present: presence.length - missing.length, total: presence.length, missing };
}

// ─── Canister health (composed from the existing probe fn) ──────────────────

export interface CanisterSummary {
  ok: boolean;
  items: Array<{ name: string; ok: boolean; details: string }>;
}

export async function getCanisterSummary(): Promise<CanisterSummary> {
  const health = await withTimeout(getCanisterHealth(), {
    ok: false,
    items: [{ name: 'canister health', ok: false, details: `probe timed out after ${PROBE_TIMEOUT_MS}ms — unavailable` }],
  });
  return {
    ok: health.ok,
    items: health.items.map((i) => ({ name: i.name, ok: i.ok, details: i.details ?? '' })),
  };
}

// ─── Receipts pipeline state (T2-safe listing only) ─────────────────────────

export interface T2SafeReceipt {
  id: string;
  actionType: string;
  status: ReceiptStatus;
  createdAt: string;
}

export interface ReceiptPipelineState {
  total: number;
  byStatus: Record<ReceiptStatus, number>;
  /** Newest-first, filtered to T2-safe fields only. */
  recent: T2SafeReceipt[];
}

const EMPTY_STATUS: Record<ReceiptStatus, number> = {
  local: 0,
  dvn_pending: 0,
  dvn_recorded: 0,
  dvn_failed: 0,
};

/**
 * Read the caller's recent activity receipts and reduce to pipeline-state
 * counts + a T2-safe recent list. The DVN pipeline state (local → dvn_pending
 * → dvn_recorded / dvn_failed) is reflected in each receipt's `receiptStatus`;
 * we surface the counts (dvn_failed highlighted by the UI) without touching the
 * pipeline itself.
 */
export async function getReceiptPipelineState(
  personaId: string,
  limit = 25,
): Promise<ReceiptPipelineState> {
  const receipts = await withTimeout(listActivityReceiptsForPersona(personaId, { limit }), []);
  const byStatus = { ...EMPTY_STATUS };
  for (const r of receipts) {
    byStatus[r.receiptStatus] = (byStatus[r.receiptStatus] ?? 0) + 1;
  }
  return {
    total: receipts.length,
    byStatus,
    recent: receipts.map((r) => ({
      id: r.id,
      actionType: r.actionType,
      status: r.receiptStatus,
      createdAt: r.createdAt,
    })),
  };
}

// ─── Platform telemetry — the server↔canister↔DVN "Network" view ────────────

/** The honest retry pointer for a dvn_failed receipt (DVN escalation contract). */
export const DVN_RETRY_ROUTE = '/api/assistant/receipts/[receiptId]/retry-dvn';

export interface DvnTelemetry {
  ok: boolean;
  /** pending + ready messages on the DVN canister. */
  pendingMessages: number;
  validatorsOnline: number;
  /** Canister id + pending/ready split — a T2 public-network detail, never a T0 id. */
  details: string;
  at: string;
}

/**
 * DVN pipeline telemetry — composed from the SAME `getDVNStatus()` probe the
 * /api/ops/dvn/* routes reduce from (get_pending_messages + get_ready_messages
 * on the cross-chain canister). We do not fork the actor call; we reuse the
 * service fn and surface its T2-safe summary.
 */
export async function getDvnTelemetry(): Promise<DvnTelemetry> {
  const s = await withTimeout(getDVNStatus(), {
    ok: false,
    pendingMessages: 0,
    validatorsOnline: 0,
    details: `DVN probe timed out after ${PROBE_TIMEOUT_MS}ms — unavailable`,
    at: new Date().toISOString(),
  });
  return {
    ok: s.ok,
    pendingMessages: s.pendingMessages,
    validatorsOnline: s.validatorsOnline ?? 0,
    details: s.details ?? '',
    at: s.at,
  };
}

// ─── Escalation / platform log stream (DB-durable — NOT a raw server log tail) ─

export interface EscalationEntry {
  id: string;
  actionType: string;
  status: ReceiptStatus;
  createdAt: string;
}

export interface EscalationLog {
  /** Honest provenance: these are durable DB records, not a CloudWatch tail. */
  source: 'db-durable';
  /** Newest-first dvn_failed (and any failed-state) receipts. */
  entries: EscalationEntry[];
  retryRoute: string;
  note: string;
}

/**
 * The platform escalation log — the DURABLE record of DVN failures surfaced
 * read-only, newest first. Sourced from the receipt pipeline (dvn_failed rows
 * per the DVN escalation contract), NOT from a live server log tail. Composes
 * the existing receipt read path; never fabricates a line.
 */
export function buildEscalationLog(pipeline: ReceiptPipelineState): EscalationLog {
  const entries = pipeline.recent
    .filter((r) => r.status === 'dvn_failed')
    .map((r) => ({ id: r.id, actionType: r.actionType, status: r.status, createdAt: r.createdAt }));
  return {
    source: 'db-durable',
    entries,
    retryRoute: DVN_RETRY_ROUTE,
    note:
      'platform escalation log (DB-durable) — not a raw server log tail; a CloudWatch tail is a follow-on gated on the AWS SDK.',
  };
}
