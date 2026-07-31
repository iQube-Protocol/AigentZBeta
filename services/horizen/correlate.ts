/**
 * Horizen reference-agent correlation — the end-to-end read path.
 *
 * Source of truth: "Horizen Agentic Services — Partner Integration Brief"
 * (2026-07-28), §3 ("Representative Agent Package") and §3.1 ("The linking
 * identifiers").
 *
 * ── WHAT THIS PRODUCES ─────────────────────────────────────────────────────
 *
 * ONE normalized internal object joining: network, ERC-8004 tokenId, registry
 * identity, Pulse record, validation proof, and the transaction/attestation
 * identifiers — suitable for storage or display in the Horizen Partner
 * Workspace (`services/venture/partnerWorkspace.ts`, pilot
 * `horizen-pilot-series-001`, whose charter already names Horizen as the agent
 * registry provider behind the provider-agnostic seam).
 *
 * ── THE JOIN, AND WHY IT IS NOT A STRING COMPARE ───────────────────────────
 *
 * §3.1: one number joins all four resources —
 *
 *     ERC-8004 tokenId 7866 (decimal)
 *       == registry agentId 0x1eba   (hex-rendered)
 *       == Pulse agentId    7866     (decimal, UNIQUE PER NETWORK)
 *       == the agentId public signal inside the SLA proof
 *
 * Every join here goes through `normalizeAgentIdentity`/`sameAgent` (BigInt),
 * never string equality, and every join is network-scoped.
 *
 * ── PARTIAL IS NORMAL, NOT DEGRADED ────────────────────────────────────────
 *
 * §9: "Stages 4a/4b are OPTIONAL and INDEPENDENT. A perfectly valid registry
 * agent has neither, and most on-chain agents today have neither. Do not treat
 * their absence as malformed." §7 adds identity-only PnL cards with no
 * services and no pricing.
 *
 * So the result models Pulse, validations and PnL as ABSENT-OR-PRESENT, each
 * with a reason when absent. A missing Pulse record is a fact about the agent,
 * not a failure of the read — and the two are never conflated, because an
 * operator deciding whether to trust an agent needs to know which one it was.
 */

import {
  normalizeAgentIdentity,
  sameAgent,
  type HorizenAgentIdentity,
  type HorizenNetwork,
} from './identity';
import { parseAgentUri, type AgentCardResult } from './agentCard';
import {
  fetchRegistryAgent,
  fetchRegistryPulseStatus,
  fetchPulseStatus,
  fetchPnlCorrelation,
  type HorizenClientOptions,
  type HorizenReadFailure,
} from './client';

/** §3.1 secondary join keys — the identifiers that tie a proof to a chain tx. */
export interface SlaProofRef {
  periodStart: string | null;
  periodEnd: string | null;
  uptimePercent: number | null;
  merkleRoot: string | null;
  /** The zkVerify aggregation id (§3.4). */
  zkverifyAttestationId: string | null;
  /** The Base transaction that recorded it (§3.4). */
  adapterTxHash: string | null;
}

/** A registry validation receipt (§3.3), reduced to what correlation needs. */
export interface ValidationRef {
  id: string | null;
  status: string | null;
  /** `pulse-sla`, `verifiable-pnl`, `proof-of-reserves`, … (§3.3, §7). */
  tag: string | null;
  timestamp: string | null;
  /**
   * §3.3: the ValidationGatewayV2 proxy — "i.e. the receipt came through the
   * gateway, not from a self-report". Preserved because that distinction is
   * the difference between an attested and a claimed receipt.
   */
  validatorAddress: string | null;
  /** zkVerify-side tx/block (§3.3 `zkDetails`). */
  zkTxHash: string | null;
  zkBlockHash: string | null;
  allAssertionsPassed: boolean | null;
}

/** Present, or absent WITH a reason. Never silently empty. */
export type Correlated<T> =
  | { present: true; value: T }
  | { present: false; reason: 'not-enrolled' | 'not-found' | 'read-failed' | 'not-attempted'; detail: string };

export interface HorizenAgentRecord {
  identity: HorizenAgentIdentity;
  /** Registry profile fields (§3.3). */
  registry: {
    name: string | null;
    owner: string | null;
    active: boolean | null;
    validationsCount: number | null;
    /** §3.3 `agentStats.allPassed`. */
    allValidationsPassed: boolean | null;
    /** The card as parsed from `agentURI` — or why it wasn't. */
    card: AgentCardResult;
  };
  pulse: Correlated<{
    enrolled: boolean;
    /** §3.3 — what lets SLA proofs finalise at all. */
    commitmentRecorded: boolean | null;
    slaTarget: number | null;
    uptimeCurrent: number | null;
    totalChallenges: number | null;
    slaProofs: SlaProofRef[];
  }>;
  validations: Correlated<ValidationRef[]>;
  pnl: Correlated<{ uuid: string; erc8004Chain: string | null; status: string | null }>;
  /**
   * Correlation integrity. `true` only when every surface that RETURNED data
   * agreed on the identity. A mismatch is recorded, never silently dropped —
   * §4.4 makes cross-network confusion the highest-consequence error here.
   */
  correlationVerified: boolean;
  correlationNotes: string[];
  /** §5.1 — false means at least one read said the cache was warming. */
  ready: boolean;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}
function bool(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}
function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function failureDetail(f: HorizenReadFailure): string {
  return f.detail;
}

/** §3.3 → ValidationRef[]. Tolerant: any malformed row is skipped, never fatal. */
export function extractValidations(raw: unknown): ValidationRef[] {
  if (!Array.isArray(raw)) return [];
  const out: ValidationRef[] = [];
  for (const entry of raw) {
    const v = obj(entry);
    if (!v) continue;
    const zk = obj(v.zkDetails);
    out.push({
      id: str(v.id),
      status: str(v.status),
      tag: str(v.tag),
      timestamp: str(v.timestamp),
      validatorAddress: str(v.validatorAddress),
      zkTxHash: zk ? str(zk.txHash) : null,
      zkBlockHash: zk ? str(zk.blockHash) : null,
      allAssertionsPassed: zk ? bool(zk.allAssertionsPassed) : null,
    });
  }
  return out;
}

/** §3.4 `slaProofs[]` → SlaProofRef[]. Capped at 5 by Pulse itself. */
export function extractSlaProofs(raw: unknown): SlaProofRef[] {
  if (!Array.isArray(raw)) return [];
  const out: SlaProofRef[] = [];
  for (const entry of raw) {
    const p = obj(entry);
    if (!p) continue;
    out.push({
      periodStart: str(p.periodStart),
      periodEnd: str(p.periodEnd),
      uptimePercent: num(p.uptimePercent),
      merkleRoot: str(p.merkleRoot),
      zkverifyAttestationId: str(p.zkverifyAttestationId),
      adapterTxHash: str(p.adapterTxHash),
    });
  }
  return out;
}

/**
 * THE END-TO-END READ. Registry → normalize → Pulse → validations → PnL → one
 * object.
 *
 * `registryAlias` is the HEX rendering the registry itself uses (§3).
 * `network` is required — see §4.4.
 */
export async function correlateAgent(
  registryAlias: string,
  network: HorizenNetwork,
  options: HorizenClientOptions = {},
): Promise<{ ok: true; record: HorizenAgentRecord } | { ok: false; reason: string; detail: string }> {
  const notes: string[] = [];
  let ready = true;

  // 1. Registry identity.
  const reg = await fetchRegistryAgent(registryAlias, network, options);
  if (!reg.ok) {
    return { ok: false, reason: reg.reason, detail: failureDetail(reg) };
  }
  ready = ready && reg.ready;

  const body = reg.value;
  const agent = obj(body.agent);
  if (!agent) return { ok: false, reason: 'shape', detail: 'registry response has no `agent` object' };

  // 2. Normalize hex → canonical decimal tokenId (§2.4.1).
  const idResult = normalizeAgentIdentity({
    agentId: str(agent.agentId) ?? registryAlias,
    network,
    source: str(agent.source),
  });
  if (!idResult.ok) {
    return { ok: false, reason: idResult.reason, detail: idResult.detail };
  }
  const identity = idResult.identity;

  // §2.4.2/§2.4.3 — say so plainly when this is not a chain identity.
  if (identity.identityClass !== 'on-chain') {
    notes.push(
      `identityClass='${identity.identityClass}' — NOT confirmed as an ERC-8004 token; ` +
      `treat on-chain claims as unverified unless checked directly on chain (brief §2.4.2/§2.4.3)`,
    );
  }

  // 3. The Agent Card. Unresolved is not invalid (§2.3(g)).
  const uri = str(agent.agentURI);
  const card: AgentCardResult = uri
    ? parseAgentUri(uri)
    : { status: 'unresolved', scheme: 'unknown', reason: 'registry row carries no agentURI' };

  // 4. Pulse — enrollment first (cheap), then full status only if enrolled.
  let pulse: HorizenAgentRecord['pulse'];
  const enrollment = await fetchRegistryPulseStatus(registryAlias, network, options);
  if (!enrollment.ok) {
    pulse = { present: false, reason: 'read-failed', detail: failureDetail(enrollment) };
  } else {
    const enrolled = bool(enrollment.value.enrolled) === true;
    if (!enrolled) {
      // §9: absence of Pulse is a valid agent state, not a defect.
      pulse = { present: false, reason: 'not-enrolled', detail: 'agent is not enrolled in Pulse (optional capability, brief §9)' };
    } else {
      const status = await fetchPulseStatus(identity.pulseAlias, network, options);
      if (!status.ok) {
        pulse = { present: false, reason: status.reason === 'not-found' ? 'not-found' : 'read-failed', detail: failureDetail(status) };
      } else {
        const pAgent = obj(status.value.agent);
        const uptime = obj(status.value.uptime);
        // §3.1 — the Pulse record must name the SAME agent. Verified by value,
        // not by trusting that we asked for the right one.
        const pulseId = pAgent ? pAgent.agentId : null;
        if (pulseId !== null && pulseId !== undefined) {
          const matches = sameAgent(
            { agentId: pulseId as string | number, network },
            { agentId: identity.tokenId, network },
          );
          if (!matches) {
            notes.push(`Pulse returned agentId '${String(pulseId)}' which does not correlate with tokenId ${identity.tokenId}`);
          }
        }
        pulse = {
          present: true,
          value: {
            enrolled: true,
            commitmentRecorded: bool(enrollment.value.commitmentRecorded),
            slaTarget: pAgent ? num(pAgent.slaTarget) : null,
            uptimeCurrent: uptime ? num(uptime.current) : null,
            totalChallenges: uptime ? num(uptime.totalChallenges) : null,
            slaProofs: extractSlaProofs(status.value.slaProofs),
          },
        };
      }
    }
  }

  // 5. Validations — already on the registry profile (§3.3), no extra call.
  const vals = extractValidations(body.validations);
  const validations: HorizenAgentRecord['validations'] =
    vals.length > 0
      ? { present: true, value: vals }
      : { present: false, reason: 'not-found', detail: 'no validation receipts recorded for this agent' };

  // 6. PnL correlation (§3.5). A 404 is an ordinary absence.
  let pnl: HorizenAgentRecord['pnl'];
  const pnlRead = await fetchPnlCorrelation(identity.tokenId, options);
  if (pnlRead.ok) {
    const uuid = str(pnlRead.value.agentId);
    pnl = uuid
      ? { present: true, value: { uuid, erc8004Chain: str(pnlRead.value.erc8004Chain), status: str(pnlRead.value.status) } }
      : { present: false, reason: 'not-found', detail: 'PnL correlation returned no agentId UUID' };
    // §3.5 flags a real cross-chain subtlety: the correlation endpoint reports
    // its own `erc8004Chain`, which need not equal the network we queried.
    const pnlChain = str(pnlRead.value.erc8004Chain);
    if (pnlChain && pnlChain !== identity.network) {
      notes.push(`PnL correlation reports erc8004Chain='${pnlChain}' but this identity was read on '${identity.network}'`);
    }
  } else if (pnlRead.reason === 'not-found') {
    pnl = { present: false, reason: 'not-found', detail: 'no Verifiable-PnL agent for this tokenId (brief §3.5: 404 means none)' };
  } else {
    pnl = { present: false, reason: 'read-failed', detail: failureDetail(pnlRead) };
  }

  return {
    ok: true,
    record: {
      identity: { ...identity, pnlUuid: pnl.present ? pnl.value.uuid : null },
      registry: {
        name: str(agent.name),
        owner: str(agent.owner),
        active: bool(agent.active),
        validationsCount: num(body.validationsCount),
        allValidationsPassed: (() => {
          const stats = obj(body.agentStats);
          return stats ? bool(stats.allPassed) : null;
        })(),
        card,
      },
      pulse,
      validations,
      pnl,
      correlationVerified: notes.length === 0,
      correlationNotes: notes,
      ready,
    },
  };
}
