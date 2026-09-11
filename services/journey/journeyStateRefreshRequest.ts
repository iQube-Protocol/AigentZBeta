/**
 * journeyStateRefreshRequest — an EMBEDDED surface's "please re-read
 * canonical Journey state now" signal, across the iframe boundary.
 *
 * ── Why this exists (Factor Operate blocker, 2026-09-06) ────────────────────
 *
 * The `aigentme` stage's surface (`aigentme-welcome`, journeySurfaceRegistry.ts)
 * is `kind: 'embed'` — AigentMeWelcomeSplitTab runs in its OWN iframe
 * (/triad/embed/codex/metame-codex?tab=aigent-me), not as a child React
 * component JourneyRunSurface can hand a `requestStateRefresh` prop to
 * in-process (the mechanism Register/Ratify use — RegisterAgentPanel.tsx,
 * AgreementRatifyPanel.tsx). A plain callback cannot survive that boundary,
 * so once the principal records their focus disposition inside the embed
 * (the ONE act that writes both `aigentme_activated` and
 * `experienceqube_focus_disposition_recorded` — the aigentme stage's own
 * completionEvidence), the journey's stage stepper had no way to learn this
 * happened until the whole JourneyRunSurface remounted (leave/re-enter).
 *
 * Mirrors `services/wallet/walletSurfaceRequest.ts`'s exact shape and
 * reasoning (a plain serializable message, broadcast to every ancestor
 * window AND dispatched locally, `targetOrigin: '*'` since the payload
 * carries no secret — just a reason string and an optional agent scope) —
 * never a second cross-frame convention. The receiver (JourneyRunSurface)
 * validates message shape only and re-invokes its OWN existing `refresh()`,
 * the SAME one mount/manual-refresh/personaSpine-transition already use —
 * never a second observer or a second refresh mechanism.
 *
 * Read-only by construction: this can only ever trigger a re-read of
 * server-confirmed state. It asserts nothing, completes nothing, and grants
 * nothing — a spoofed or misdirected message costs, at most, one wasted
 * fetch.
 */

export const JOURNEY_STATE_REFRESH_REQUEST_TYPE = 'metame:journey-state-refresh-request:v1';

const LOCAL_EVENT = '__journeyStateRefreshRequestLocal';

export interface JourneyStateRefreshRequest {
  type: typeof JOURNEY_STATE_REFRESH_REQUEST_TYPE;
  /** Diagnostic only — surfaced in logRuntimeEvent, never branched on. */
  reason: string;
  /** Which agent this refresh concerns, if known — informational only; the
   *  receiver re-reads its OWN currently-selected agent's state regardless. */
  agentSlug?: string;
}

function isJourneyStateRefreshRequest(v: unknown): v is JourneyStateRefreshRequest {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as { type?: unknown }).type === JOURNEY_STATE_REFRESH_REQUEST_TYPE &&
    typeof (v as { reason?: unknown }).reason === 'string'
  );
}

/**
 * Post to every ancestor window, and to this one — same reasoning as
 * walletSurfaceRequest.ts's own `broadcast()`: a Journey can be nested
 * (embed inside embed), and a request that only climbs one level dies in
 * the middle frame. A window with no listener ignores it.
 */
function broadcast(message: JourneyStateRefreshRequest): void {
  if (typeof window === 'undefined') return;

  try {
    window.dispatchEvent(new CustomEvent(LOCAL_EVENT, { detail: message }));
  } catch {
    /* a realm without CustomEvent still gets the postMessage path */
  }

  const seen = new Set<Window>();
  let w: Window | null = window;
  for (let hops = 0; w && hops < 10; hops += 1) {
    if (!seen.has(w)) {
      seen.add(w);
      try {
        w.postMessage(message, '*');
      } catch {
        /* a cross-origin ancestor that refuses is not a reason to stop climbing */
      }
    }
    const next: Window | null = w.parent === w ? null : w.parent;
    w = next;
  }
}

/**
 * Ask whoever owns the Journey observer to re-read canonical state now.
 * Delivery is best-effort: a surface rendered outside any Journey (e.g.
 * metame-codex reached directly, not through a Guided Journey Runtime
 * viewport) is a legitimate arrangement with nobody listening.
 */
export function requestJourneyStateRefresh(reason: string, agentSlug?: string): void {
  broadcast({
    type: JOURNEY_STATE_REFRESH_REQUEST_TYPE,
    reason,
    ...(agentSlug ? { agentSlug } : {}),
  });
}

/** Subscribed by JourneyRunSurface. Returns the unsubscribe function. */
export function subscribeJourneyStateRefreshRequest(
  listener: (request: JourneyStateRefreshRequest) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};

  const onLocal = (e: Event) => {
    const detail = (e as CustomEvent<JourneyStateRefreshRequest>).detail;
    if (isJourneyStateRefreshRequest(detail)) listener(detail);
  };
  const onMessage = (e: MessageEvent) => {
    if (isJourneyStateRefreshRequest(e.data)) listener(e.data);
  };

  window.addEventListener(LOCAL_EVENT, onLocal);
  window.addEventListener('message', onMessage);
  return () => {
    window.removeEventListener(LOCAL_EVENT, onLocal);
    window.removeEventListener('message', onMessage);
  };
}
