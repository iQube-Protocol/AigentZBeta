/**
 * Asking the wallet to open on a surface — across hosts, not across a module.
 *
 * ── Why this was rewritten (operator browser run, 2026-08-02) ──────────────
 *
 * The first version was a module-level `Set` of listeners. It passed every
 * canary and was dead in the browser, because the two ends do not share a
 * module instance:
 *
 *   Multi-Cartridge Viewer (parent document)
 *     └── <iframe src="/triad/embed/codex/…">      ← RegisterAgentPanel lives here
 *   SmartWalletDrawer / copilot                     ← lives in the PARENT
 *
 * A publisher inside the iframe and a subscriber in the parent are two
 * separate JavaScript realms. The `Set` in the iframe's copy of the module has
 * no subscriber, so `requestWalletSurface` did exactly what it was documented
 * to do — deliver to nobody, silently — and the button looked broken.
 *
 * The operator named the fix precisely:
 *
 *   > "Do not depend on an in-memory module bus or function callback crossing
 *   >  cartridge/iframe boundaries. Use a shell-owned, serializable request."
 *
 * So the request is a plain serializable object, delivered by `postMessage` to
 * every ancestor window AND dispatched on the local document. Two channels
 * because there are two real arrangements: an embedded Journey (needs the
 * parent) and a same-document one (needs the local dispatch). Neither is a
 * fallback for the other — both are the normal case for some host.
 *
 * ── Why no function callback survives ──────────────────────────────────────
 *
 * The old shape carried `returnTo: { label, onReturn }`. A function cannot be
 * structured-cloned, so `postMessage` would throw on it. That is not a
 * limitation to work around — a callback is the wrong model here: it binds the
 * requester's closure to the wallet's lifetime across a boundary either side
 * may reload independently. `returnTarget` is an identifier the requester can
 * recognise when the COMPLETION event comes back, which survives a reload of
 * either side.
 */

export type RequestableWalletSurface = 'PRINCIPAL_WALLET_PROVISIONING' | 'PENDING_ACTIONS';

export const WALLET_SURFACE_REQUEST_TYPE = 'metame:wallet-surface-request:v1';
export const WALLET_SURFACE_COMPLETION_TYPE = 'metame:wallet-surface-completion:v1';
/**
 * A host saying "I heard that, and I am opening the wallet."
 *
 * ── Why an acknowledgement exists (operator, 2026-08-02, fourth round) ─────
 *
 * Three rounds were spent guessing WHICH component hears a request — module
 * bus, then an unmounted drawer, then a mounted-but-closed copilot — and every
 * round produced the same operator report: "nothing in console either when
 * clicked". That report was accurate and carried no information, because
 * delivery was unobservable by construction: `requestWalletSurface` returns a
 * token and is documented as best-effort, so a request reaching nobody looks
 * exactly like a request reaching somebody who then failed to render.
 *
 * Guessing again would be the fourth guess. Instead the channel now reports
 * itself: a host that honours a request ACKs it, and a requester that gets no
 * ACK knows — and can SAY — that no wallet in this host answered. That is the
 * difference between a dead button and a stated refusal, and it is the same
 * discipline every other surface here follows: "could not reach" is a fact to
 * report, never a blank.
 */
export const WALLET_SURFACE_ACK_TYPE = 'metame:wallet-surface-ack:v1';

/** Fully serializable. No functions, no class instances, no DOM nodes. */
export interface WalletSurfaceRequest {
  type: typeof WALLET_SURFACE_REQUEST_TYPE;
  /** Monotonic within a realm; distinguishes a new request from a re-render. */
  token: number;
  surface: RequestableWalletSurface;
  /** Which surface asked. Lets a host present "returning to …" honestly. */
  origin: string;
  /** The agent the originating act concerns, when there is one. */
  subjectAgentId?: string;
  /**
   * An identifier the requester will recognise on completion — NOT a callback.
   * e.g. `journey:horizen:register:aigent-nakamoto`.
   */
  returnTarget?: string;
  /** Human-readable label for the wallet's "Continue to …" button. */
  returnLabel?: string;
}

export interface WalletSurfaceCompletion {
  type: typeof WALLET_SURFACE_COMPLETION_TYPE;
  surface: RequestableWalletSurface;
  /**
   * What actually happened, in the vocabulary of the surface that happened it.
   *
   * Provisioning outcomes: `CONTROL_PROVEN` is the only one that lets the
   * consequential act resume — "a provisioning write is not completion;
   * authoritative control proof is completion". Signing outcomes:
   * `ACTION_COMPLETED` / `ACTION_REFUSED`. Kept distinct rather than collapsed
   * into "done": a listener that treated a signed mandate as a proven wallet
   * would be reasoning from the wrong fact.
   */
  outcome:
    | 'CONTROL_PROVEN'
    | 'SIGNER_CONFIGURED_AWAITING_PROOF'
    | 'ACTION_COMPLETED'
    | 'ACTION_REFUSED'
    | 'DISMISSED'
    | 'REFUSED';
  returnTarget?: string;
  refusal?: string;
  /**
   * Serializable facts the completing act produced, for the requester to act
   * on — e.g. the broadcast txHash the Register stage needs to poll Horizen.
   *
   * Without this the txHash existed only in the wallet's approve response,
   * while the one surface that needs it (Register, to drive the confirmation
   * poll that writes the binding receipt) never learned it — so the ceremony
   * completed in the wallet and could never reach COMPLETE in the Journey.
   * Plain JSON only: this crosses the same postMessage boundary as the rest.
   */
  result?: Record<string, string | number | boolean | null>;
}

/** Sent back by whichever host is actually going to open the wallet. */
export interface WalletSurfaceAck {
  type: typeof WALLET_SURFACE_ACK_TYPE;
  /** The token of the request being acknowledged. */
  token: number;
  /** Which host answered — named so a duplicate ACK is diagnosable, not anonymous. */
  host: string;
}

type RequestListener = (request: WalletSurfaceRequest) => void;
type CompletionListener = (completion: WalletSurfaceCompletion) => void;
type AckListener = (ack: WalletSurfaceAck) => void;

let nextToken = 1;

/** Same-document channel, for hosts where requester and wallet share a realm. */
const LOCAL_EVENT = 'metame-wallet-surface';
const LOCAL_COMPLETION_EVENT = 'metame-wallet-surface-completion';
const LOCAL_ACK_EVENT = 'metame-wallet-surface-ack';

/**
 * One line per hop, so "nothing in console" becomes evidence instead of a
 * dead end. Publish and ACK are logged with the same token: seeing the publish
 * without an ACK localises the fault to the receiving side in one glance, and
 * seeing neither localises it to the click.
 */
function trace(stage: string, detail: Record<string, unknown>): void {
  if (typeof console === 'undefined') return;
  console.info(`[wallet-surface] ${stage}`, detail);
}

function isRequest(v: unknown): v is WalletSurfaceRequest {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as { type?: unknown }).type === WALLET_SURFACE_REQUEST_TYPE &&
    typeof (v as { surface?: unknown }).surface === 'string'
  );
}

function isCompletion(v: unknown): v is WalletSurfaceCompletion {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as { type?: unknown }).type === WALLET_SURFACE_COMPLETION_TYPE &&
    typeof (v as { outcome?: unknown }).outcome === 'string'
  );
}

/**
 * Post to every ancestor window, and to this one.
 *
 * Every ancestor rather than just `parent`: the Multi-Cartridge Viewer can nest
 * an embed inside an embed, and a request that only climbs one level dies in
 * the middle frame. Climbing to `top` costs nothing — a window with no listener
 * ignores it — and a request that reaches nobody is the exact failure being
 * fixed.
 *
 * `targetOrigin` is '*' deliberately and safely: the payload carries no secret
 * (a surface name and a return identifier), and pinning an origin would break
 * the legitimate cross-origin embed hosts this exists to serve. The RECEIVER
 * validates shape, and acts only on surfaces it recognises.
 */
function broadcast(message: WalletSurfaceRequest | WalletSurfaceCompletion | WalletSurfaceAck): void {
  if (typeof window === 'undefined') return;

  const localName =
    message.type === WALLET_SURFACE_REQUEST_TYPE
      ? LOCAL_EVENT
      : message.type === WALLET_SURFACE_ACK_TYPE
        ? LOCAL_ACK_EVENT
        : LOCAL_COMPLETION_EVENT;
  try {
    window.dispatchEvent(new CustomEvent(localName, { detail: message }));
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
 * Ask whoever owns the wallet to open `surface`.
 *
 * Returns the token. Delivery is best-effort by design: a Journey rendered in
 * a host with no wallet is a legitimate arrangement, and the stage's own
 * explanation of the prerequisite still stands.
 */
export function requestWalletSurface(input: {
  surface: RequestableWalletSurface;
  origin: string;
  subjectAgentId?: string;
  returnTarget?: string;
  returnLabel?: string;
}): number {
  const request: WalletSurfaceRequest = {
    type: WALLET_SURFACE_REQUEST_TYPE,
    token: nextToken++,
    surface: input.surface,
    origin: input.origin,
    ...(input.subjectAgentId ? { subjectAgentId: input.subjectAgentId } : {}),
    ...(input.returnTarget ? { returnTarget: input.returnTarget } : {}),
    ...(input.returnLabel ? { returnLabel: input.returnLabel } : {}),
  };
  trace('published', { token: request.token, surface: request.surface, origin: request.origin });
  broadcast(request);
  return request.token;
}

/**
 * A host declaring it heard a request and is opening the wallet for it.
 *
 * Called by the host at the moment it acts, never on mere receipt — an ACK
 * from a listener that then renders nothing would restore exactly the
 * ambiguity this removes.
 */
export function acknowledgeWalletSurfaceRequest(token: number, host: string): void {
  trace('acknowledged', { token, host });
  broadcast({ type: WALLET_SURFACE_ACK_TYPE, token, host });
}

/** Subscribe to acknowledgements (the requester). Returns the unsubscribe function. */
export function subscribeWalletSurfaceAck(listener: AckListener): () => void {
  if (typeof window === 'undefined') return () => {};
  const isAck = (v: unknown): v is WalletSurfaceAck =>
    typeof v === 'object' &&
    v !== null &&
    (v as { type?: unknown }).type === WALLET_SURFACE_ACK_TYPE &&
    typeof (v as { token?: unknown }).token === 'number';
  const onMessage = (e: MessageEvent) => {
    if (isAck(e.data)) listener(e.data);
  };
  const onLocal = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (isAck(detail)) listener(detail);
  };
  window.addEventListener('message', onMessage);
  window.addEventListener(LOCAL_ACK_EVENT, onLocal as EventListener);
  return () => {
    window.removeEventListener('message', onMessage);
    window.removeEventListener(LOCAL_ACK_EVENT, onLocal as EventListener);
  };
}

/** The wallet says what happened. Serializable, so it crosses the same boundaries. */
export function announceWalletSurfaceCompletion(completion: Omit<WalletSurfaceCompletion, 'type'>): void {
  broadcast({ type: WALLET_SURFACE_COMPLETION_TYPE, ...completion });
}

/** Subscribe to requests (the shell). Returns the unsubscribe function. */
export function subscribeWalletSurfaceRequest(listener: RequestListener): () => void {
  if (typeof window === 'undefined') return () => {};
  const onMessage = (e: MessageEvent) => {
    if (isRequest(e.data)) listener(e.data);
  };
  const onLocal = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (isRequest(detail)) listener(detail);
  };
  window.addEventListener('message', onMessage);
  window.addEventListener(LOCAL_EVENT, onLocal as EventListener);
  return () => {
    window.removeEventListener('message', onMessage);
    window.removeEventListener(LOCAL_EVENT, onLocal as EventListener);
  };
}

/** Subscribe to completions (the requester, e.g. Register). */
export function subscribeWalletSurfaceCompletion(listener: CompletionListener): () => void {
  if (typeof window === 'undefined') return () => {};
  const onMessage = (e: MessageEvent) => {
    if (isCompletion(e.data)) listener(e.data);
  };
  const onLocal = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (isCompletion(detail)) listener(detail);
  };
  window.addEventListener('message', onMessage);
  window.addEventListener(LOCAL_COMPLETION_EVENT, onLocal as EventListener);
  return () => {
    window.removeEventListener('message', onMessage);
    window.removeEventListener(LOCAL_COMPLETION_EVENT, onLocal as EventListener);
  };
}

/** Test seam — resets the token counter. Listeners are per-window, not held here. */
export function __resetWalletSurfaceRequests(): void {
  nextToken = 1;
}
