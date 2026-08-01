/**
 * Asking the wallet to open on a particular surface.
 *
 * ── Why a request rather than a second control ─────────────────────────────
 *
 * The boundary the operator set (2026-08-02):
 *
 *   Journey detects and explains the prerequisite
 *   → SmartWallet provisions and proves the wallet
 *   → Journey resumes the consequential act
 *
 * A Journey stage that blocks on a missing principal wallet has to be able to
 * SEND the operator to the ceremony — "do not require the user to discover the
 * wallet setup manually". But it must not mount a wallet of its own, and it
 * must not become a second navigation (MS-1). Those two requirements are only
 * compatible if the stage REQUESTS and the wallet's existing owner DECIDES.
 *
 * MS-2 is the reason this is a request bus and not a shared state atom: a host
 * that supplies `onWalletLaunch` owns wallet surfacing, and the copilot keeps
 * no parallel wallet when it does. A publisher that set wallet state directly
 * would create exactly the two-owners-of-one-surface defect that invariant
 * records — where the hidden owner wins and a stale wallet reappears later.
 * Here the publisher only says what it needs; the owner still routes it.
 *
 * ── The token ─────────────────────────────────────────────────────────────
 *
 * Each request carries a monotonic token so a REPEAT of the same request
 * re-opens the surface, while a re-render of the subscriber does not. Without
 * it, an effect keyed on the surface name alone would either re-fire on every
 * render (fighting a deliberate Back) or never re-fire at all (a second
 * request after a dismissal would be silently dropped).
 */

export type RequestableWalletSurface = 'PRINCIPAL_WALLET_PROVISIONING';

export interface WalletSurfaceRequest {
  /** Monotonic; distinguishes a new request from a re-render. */
  token: number;
  surface: RequestableWalletSurface;
  /**
   * Where to send the operator when the surface's work is done. Optional —
   * the wallet never invents a destination it was not given, and a surface
   * opened from the wallet's own entry row genuinely has nowhere to return to.
   */
  returnTo?: { label: string; onReturn: () => void };
}

type Listener = (request: WalletSurfaceRequest) => void;

const listeners = new Set<Listener>();
let nextToken = 1;

/**
 * Ask whoever owns the wallet to open `surface`.
 *
 * Returns the request's token. A caller with no subscriber gets a token and no
 * effect — deliberately silent rather than throwing: a Journey rendered
 * outside a wallet host is a legitimate arrangement, and a stage should not
 * crash because the operator is looking at it somewhere the wallet does not
 * live. The stage's own explanation of the prerequisite still renders.
 */
export function requestWalletSurface(
  surface: RequestableWalletSurface,
  returnTo?: { label: string; onReturn: () => void },
): number {
  const request: WalletSurfaceRequest = { token: nextToken++, surface, returnTo };
  listeners.forEach((l) => l(request));
  return request.token;
}

/** Subscribe. Returns the unsubscribe function. */
export function subscribeWalletSurfaceRequest(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test seam — resets both the listener set and the token counter. */
export function __resetWalletSurfaceRequests(): void {
  listeners.clear();
  nextToken = 1;
}
