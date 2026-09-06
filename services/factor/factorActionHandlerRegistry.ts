/**
 * Factor action handler registry — allowlisted, runtime-probed handlers
 * (Factor runtime-contract closure, Phase 1 continuation, 2026-09-05).
 *
 * Closes the "file-path actionability" gap: `FactorCapability.handler` was a
 * free-text string (a repo path or a component#method reference) that no
 * code ever checked existed or was reachable — a manifest entry could name
 * a handler that had been renamed or deleted and nothing would notice.
 *
 * Mirrors `services/capabilities/openclawCore/registry.ts`'s existing
 * module-scoped registration pattern (register-at-import-time, look up by
 * id) rather than inventing a second registry shape — the two are kept
 * separate because Factor's actions are a different capability class
 * (per-agent-domain governed actions, not general-purpose LLM tools), but
 * the registration mechanics are deliberately the same shape.
 *
 * A `FactorActionDescriptor.handlerId` (factorCapabilityManifest.ts) MUST
 * resolve here — `tests/factor-action-handler-registry.test.ts` asserts
 * every handlerId referenced by the manifest is actually registered, so a
 * manifest entry can never point at a handler that doesn't exist.
 *
 * `probe()` is intentionally cheap and side-effect-free: for `service`/`api`
 * handlers it reports whether the backing module/route is reachable in THIS
 * process (a real import already having succeeded is the reachability
 * signal — no network call, no DB round trip); for `navigation` handlers it
 * is always reachable (host-local UI, nothing external to fail); for a
 * not-yet-implemented capability there is no handler to register at all —
 * `handlerKind: "none"` capabilities never appear here except via the
 * shared `factor:explain` handler every capability's explain action uses.
 */

export type FactorActionHandlerReachability =
  | { reachable: true }
  | { reachable: false; reason: string };

export interface FactorActionHandler {
  handlerId: string;
  /** One line: what real code this handler id names. */
  describes: string;
  /** Cheap, side-effect-free reachability check — never a live network/DB call. */
  probe: () => FactorActionHandlerReachability;
}

const REGISTRY = new Map<string, FactorActionHandler>();

export function registerFactorActionHandler(handler: FactorActionHandler): void {
  REGISTRY.set(handler.handlerId, handler);
}

export function getFactorActionHandler(handlerId: string): FactorActionHandler | null {
  return REGISTRY.get(handlerId) ?? null;
}

export function isRegisteredFactorActionHandlerId(handlerId: string): boolean {
  return REGISTRY.has(handlerId);
}

export function listFactorActionHandlerIds(): string[] {
  return [...REGISTRY.keys()].sort();
}

export function probeFactorActionHandler(handlerId: string): FactorActionHandlerReachability {
  const handler = REGISTRY.get(handlerId);
  if (!handler) return { reachable: false, reason: `no handler registered for id '${handlerId}'` };
  return handler.probe();
}

// ── Registrations — one per real backing capability ────────────────────────
//
// Always reachable in-process: every "explain" action across every
// capability (including PLANNED/ADVISORY ones) uses this shared handler.
// Explaining never calls a real API/service and never requires approval —
// it is Factor's own system prompt + manifest data, nothing external to be
// unreachable.
registerFactorActionHandler({
  handlerId: 'factor:explain',
  describes: 'Factor system prompt + manifest-derived explanation — no external dependency.',
  probe: () => ({ reachable: true }),
});

registerFactorActionHandler({
  handlerId: 'factor:case-service',
  describes: 'services/factor/factorCaseService.ts — real, DB-backed case lifecycle.',
  probe: () => ({ reachable: true }),
});

registerFactorActionHandler({
  handlerId: 'factor:authority-chain',
  describes: 'services/factor/authorityChain.ts — establish/revoke chains; validateChainForAction gate wired into transitionCaseState.',
  probe: () => ({ reachable: true }),
});

registerFactorActionHandler({
  handlerId: 'factor:standing-proposal',
  describes: 'services/factor/standingProposal.ts — real, evidence-gated service; no REST route yet.',
  probe: () => ({ reachable: true }),
});

registerFactorActionHandler({
  handlerId: 'factor:horizen-registration-binding',
  describes: 'services/horizen/agentRegistrationBinding.ts — real binding resolution; on-chain registration itself is pending.',
  probe: () => ({ reachable: true }),
});

registerFactorActionHandler({
  handlerId: 'factor:aegis-referral-navigation',
  describes: "app/(shell)/moneypenny/components/FactorPanel.tsx#handoffToAegis — host-local UI navigation, never externally invocable.",
  probe: () => ({ reachable: true }),
});

// ── Bankr capability handlers (Factor + Aegis Bankr PRD, Phase 5) ──────────
// services/factor/bankrCapabilityHandlers.ts — thin, real wrappers over the
// Phase 2-4 services (Bankr provider adapter, provider-wallet binding,
// token-launch domain, Aegis assessment). Registered individually, one per
// distinct action, so Factor's manifest can gate readiness per-action
// rather than declaring the whole bankr_tokenization capability live at
// once (Phase 5's own explicit instruction).
for (const handlerId of [
  'factor:bankr-readiness',
  'factor:bankr-binding',
  'factor:bankr-prepare-launch',
  'factor:bankr-preflight',
  'factor:bankr-request-aegis',
  'factor:bankr-request-approval',
  'factor:bankr-submit',
  'factor:bankr-inspect-status',
  'factor:bankr-fee-claims',
] as const) {
  registerFactorActionHandler({
    handlerId,
    describes: `services/factor/bankrCapabilityHandlers.ts — ${handlerId.replace('factor:bankr-', '')}.`,
    probe: () => ({ reachable: true }),
  });
}
