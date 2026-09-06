"use client";

/**
 * useBankrTokenLaunch — the ONE client controller for Factor's Bankr
 * token-launch surfaces (Factor + Aegis Bankr PRD, Phase 6 frontend half).
 * Every atomic surface component in components/moneypenny/bankr/ reads from
 * this hook's returned state and calls its functions — no component here
 * calls `fetch`/`personaFetch` directly, and no component re-derives the
 * request/response shapes for itself (mirrors services/moneypenny/
 * marketSessionController.ts's role for the market-console surfaces).
 *
 * Every mutation goes through the real HTTP routes under
 * app/api/moneypenny/factor/bankr/* — never a parallel call into
 * services/factor/bankrCapabilityHandlers.ts from the client (that file is
 * server-side only) and never Bankr's own API directly.
 *
 * `approve` is a SEPARATE function hitting the SEPARATE, MoneyPenny/human-
 * owned .../approve route — never folded into `runAction`, so no caller can
 * accidentally treat approval as one of Factor's own actions (Phase 5/9:
 * Factor never approves its own or anyone's token).
 *
 * One hook instance owns exactly one (beneficiaryAgentRuntimeId, tenantId,
 * launchId) triple. A host that needs presentation-depth switching (compact
 * / expanded / panel) calls this hook ONCE and only toggles local depth
 * state around it — see BankrTokenLaunchCapsule.tsx.
 */

import { useCallback, useRef, useState } from "react";
import { personaFetch } from "@/utils/personaSpine";
import type { TokenLaunchRow, CreateDraftInput } from "@/services/factor/tokenLaunchService";
import type {
  BankrIssuerReadiness,
  PreflightResult,
  FeeClaimInspection,
} from "@/services/factor/bankrCapabilityHandlers";
import type { BankrTokenLaunchTerms } from "@/services/financialServices/providers/bankr/bankrTypes";
import type { ProviderWalletBindingRow } from "@/services/financialServices/providers/providerWalletBinding";

export type LaunchSpecInput = Omit<
  CreateDraftInput,
  "tenantId" | "beneficiaryAgentRuntimeId" | "preparingAgentRuntimeId" | "requestingPrincipalPersonaId" | "providerWalletBindingId"
>;

interface ApiOutcome<T> {
  ok: boolean;
  data: T | null;
  code: string | null;
  detail: string;
}

async function callApi<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<ApiOutcome<T>> {
  try {
    const res = await personaFetch(url, init);
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || (json as Record<string, unknown>).ok === false) {
      const code = json && typeof (json as Record<string, unknown>).error === "string" ? ((json as Record<string, unknown>).error as string) : null;
      const detail =
        json && typeof (json as Record<string, unknown>).detail === "string"
          ? ((json as Record<string, unknown>).detail as string)
          : (code ?? `Request failed (HTTP ${res.status}).`);
      return { ok: false, data: null, code, detail };
    }
    return { ok: true, data: json as T, code: null, detail: "" };
  } catch (err) {
    return { ok: false, data: null, code: null, detail: err instanceof Error ? err.message : String(err) };
  }
}

export interface UseBankrTokenLaunchOptions {
  /** Who the launch/readiness is FOR — required to assess readiness or
   *  prepare a launch. May be supplied later via `setBeneficiaryAgentRuntimeId`
   *  if not yet known when the surface first mounts. */
  beneficiaryAgentRuntimeId?: string;
  /** Who is PREPARING the launch — defaults to 'aigent-factor' (Factor
   *  itself), overridable when a different preparing agent is genuinely in
   *  play (never guessed silently — callers that need a different value
   *  must pass it explicitly). */
  preparingAgentRuntimeId?: string;
  tenantId?: string;
  /** Resume an existing launch by id instead of starting from readiness. */
  launchId?: string;
}

export interface BankrActionState {
  busy: boolean;
  error: string | null;
  code: string | null;
}

const IDLE_ACTION: BankrActionState = { busy: false, error: null, code: null };

export function useBankrTokenLaunch(options: UseBankrTokenLaunchOptions = {}) {
  const [beneficiaryAgentRuntimeId, setBeneficiaryAgentRuntimeId] = useState<string | undefined>(options.beneficiaryAgentRuntimeId);
  const tenantId = options.tenantId ?? "default";
  const preparingAgentRuntimeId = options.preparingAgentRuntimeId ?? "aigent-factor";

  const [readiness, setReadiness] = useState<BankrIssuerReadiness | null>(null);
  const [binding, setBinding] = useState<ProviderWalletBindingRow | null>(null);
  const [readinessState, setReadinessState] = useState<BankrActionState>(IDLE_ACTION);

  const [launch, setLaunch] = useState<TokenLaunchRow | null>(null);
  const [launchState, setLaunchState] = useState<BankrActionState>(IDLE_ACTION);

  const [bankrTerms, setBankrTerms] = useState<BankrTokenLaunchTerms | null>(null);
  const [feeClaims, setFeeClaims] = useState<FeeClaimInspection | null>(null);

  // Per-action busy/error, keyed by a stable action name — mirrors
  // FactorPanel.tsx's own actionBusy/actionOutcome shape so this hook's
  // consumers read the same idiom every other Factor surface already uses.
  const [actions, setActions] = useState<Record<string, BankrActionState>>({});
  const idempotencyKeyRef = useRef<string | null>(null);

  const setActionState = useCallback((id: string, state: BankrActionState) => {
    setActions((s) => ({ ...s, [id]: state }));
  }, []);

  const runTracked = useCallback(
    async <T,>(actionId: string, request: () => Promise<ApiOutcome<T>>): Promise<ApiOutcome<T>> => {
      setActionState(actionId, { busy: true, error: null, code: null });
      const result = await request();
      setActionState(actionId, { busy: false, error: result.ok ? null : result.detail, code: result.code });
      return result;
    },
    [setActionState],
  );

  const refreshReadiness = useCallback(
    async (agentRuntimeId?: string) => {
      const id = agentRuntimeId ?? beneficiaryAgentRuntimeId;
      if (!id) {
        setReadinessState({ busy: false, error: "No beneficiary agent runtime id bound — nothing to assess.", code: "missing-agent-ref" });
        return;
      }
      setReadinessState({ busy: true, error: null, code: null });
      const result = await callApi<{ readiness: BankrIssuerReadiness; binding?: ProviderWalletBindingRow }>(
        "/api/moneypenny/factor/bankr/readiness",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ beneficiaryAgentRuntimeId: id, tenantId }),
        },
      );
      if (!result.ok) {
        setReadinessState({ busy: false, error: result.detail, code: result.code });
        return;
      }
      setReadiness(result.data!.readiness);
      if (result.data!.binding) setBinding(result.data!.binding);
      else setBinding(result.data!.readiness.providerWalletBinding);
      setReadinessState(IDLE_ACTION);
    },
    [beneficiaryAgentRuntimeId, tenantId],
  );

  const provisionBinding = useCallback(async () => {
    const id = beneficiaryAgentRuntimeId;
    if (!id) {
      setReadinessState({ busy: false, error: "No beneficiary agent runtime id bound — nothing to provision.", code: "missing-agent-ref" });
      return;
    }
    setReadinessState({ busy: true, error: null, code: null });
    const result = await callApi<{ readiness: BankrIssuerReadiness; binding: ProviderWalletBindingRow }>(
      "/api/moneypenny/factor/bankr/readiness",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beneficiaryAgentRuntimeId: id, tenantId, action: "provision_binding" }),
      },
    );
    if (!result.ok) {
      setReadinessState({ busy: false, error: result.detail, code: result.code });
      return;
    }
    setReadiness(result.data!.readiness);
    setBinding(result.data!.binding);
    setReadinessState(IDLE_ACTION);
  }, [beneficiaryAgentRuntimeId, tenantId]);

  const loadLaunch = useCallback(
    async (launchId: string) => {
      setLaunchState({ busy: true, error: null, code: null });
      const result = await callApi<{ launch: TokenLaunchRow }>(`/api/moneypenny/factor/bankr/launches/${launchId}?tenantId=${encodeURIComponent(tenantId)}`);
      if (!result.ok) {
        setLaunchState({ busy: false, error: result.detail, code: result.code });
        return;
      }
      setLaunch(result.data!.launch);
      setLaunchState(IDLE_ACTION);
    },
    [tenantId],
  );

  /** "Prepare launch proposal" — every field here is exactly what the
   *  operator typed into LaunchSpecForm; this hook never fills in a default
   *  token name/symbol/etc (Phase 5's own constraint, carried through to the
   *  client). */
  const prepareLaunch = useCallback(
    async (spec: LaunchSpecInput): Promise<boolean> => {
      const id = beneficiaryAgentRuntimeId;
      if (!id) {
        setLaunchState({ busy: false, error: "No beneficiary agent runtime id bound — cannot prepare a launch.", code: "missing-agent-ref" });
        return false;
      }
      setLaunchState({ busy: true, error: null, code: null });
      const result = await callApi<{ launch: TokenLaunchRow }>("/api/moneypenny/factor/bankr/launches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          beneficiaryAgentRuntimeId: id,
          preparingAgentRuntimeId,
          ...spec,
        }),
      });
      if (!result.ok) {
        setLaunchState({ busy: false, error: result.detail, code: result.code });
        return false;
      }
      setLaunch(result.data!.launch);
      setLaunchState(IDLE_ACTION);
      return true;
    },
    [beneficiaryAgentRuntimeId, tenantId, preparingAgentRuntimeId],
  );

  const runLaunchAction = useCallback(
    async (actionId: string, body: Record<string, unknown>): Promise<boolean> => {
      if (!launch) {
        setActionState(actionId, { busy: false, error: "No launch is open — prepare a launch proposal first.", code: "no-launch" });
        return false;
      }
      const result = await runTracked<{ launch: TokenLaunchRow; bankrTerms?: BankrTokenLaunchTerms; feeClaims?: FeeClaimInspection }>(actionId, () =>
        callApi(`/api/moneypenny/factor/bankr/launches/${launch.id}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, ...body }),
        }),
      );
      if (!result.ok) return false;
      if (result.data!.launch) setLaunch(result.data!.launch);
      if (result.data!.bankrTerms) setBankrTerms(result.data!.bankrTerms);
      if (result.data!.feeClaims) setFeeClaims(result.data!.feeClaims);
      return true;
    },
    [launch, tenantId, runTracked, setActionState],
  );

  const preflight = useCallback(() => runLaunchAction("preflight", { action: "preflight" }), [runLaunchAction]);

  const requestAegis = useCallback(
    (input: { policyVersion: string; evidenceSnapshot: Record<string, unknown>; requestedByAgentRef: string }) =>
      runLaunchAction("request_aegis", { action: "request_aegis", ...input }),
    [runLaunchAction],
  );

  const requestApproval = useCallback(() => runLaunchAction("request_approval", { action: "request_approval" }), [runLaunchAction]);

  const submit = useCallback(() => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    return runLaunchAction("submit", { action: "submit", idempotencyKey: idempotencyKeyRef.current });
  }, [runLaunchAction]);

  const inspectStatus = useCallback(() => runLaunchAction("inspect_status", { action: "inspect_status" }), [runLaunchAction]);

  const inspectFeeClaims = useCallback(() => runLaunchAction("fee_claims", { action: "fee_claims" }), [runLaunchAction]);

  /** The SOLE path to 'approved' — a separate function against a separate
   *  route. Never merged with runLaunchAction/the action dispatcher above. */
  const approve = useCallback(async (): Promise<boolean> => {
    if (!launch) {
      setActionState("approve", { busy: false, error: "No launch is open — nothing to approve.", code: "no-launch" });
      return false;
    }
    const result = await runTracked<{ launch: TokenLaunchRow }>("approve", () =>
      callApi(`/api/moneypenny/factor/bankr/launches/${launch.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      }),
    );
    if (!result.ok) return false;
    setLaunch(result.data!.launch);
    return true;
  }, [launch, tenantId, runTracked, setActionState]);

  return {
    beneficiaryAgentRuntimeId,
    setBeneficiaryAgentRuntimeId,
    tenantId,
    preparingAgentRuntimeId,

    readiness,
    binding,
    readinessState,
    refreshReadiness,
    provisionBinding,

    launch,
    launchState,
    loadLaunch,
    prepareLaunch,

    bankrTerms,
    feeClaims,

    actions,
    preflight,
    requestAegis,
    requestApproval,
    submit,
    inspectStatus,
    inspectFeeClaims,
    approve,
  };
}

export type BankrTokenLaunchController = ReturnType<typeof useBankrTokenLaunch>;
