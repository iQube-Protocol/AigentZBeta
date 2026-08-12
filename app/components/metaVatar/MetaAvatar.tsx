/**
 * MetaAvatar Component
 * 
 * Ported from Netlify app for AgentiQ integration
 * 
 * Persistent D-ID avatar container that is rendered ONCE at the app root level.
 * The D-ID SDK injects an iframe via script tag. This component manages:
 * - Script injection with proper cleanup
 * - Container ID management
 * - Refresh handling
 * 
 * MOUNT LIFECYCLE (corrected 2026-07-27 — the fourth opacity report).
 *
 * The original rule was "never unmount; hide with CSS". That rule assumed the
 * SDK renders ONLY inside our container. It does not: the D-ID v2 SDK in
 * `data-mode="full"` also injects its own nodes at DOCUMENT BODY level. Those
 * nodes live OUTSIDE the host wrapper the layout positions, so hiding the
 * wrapper — by opacity, by visibility, by zero size, and finally by
 * `display:none` — could never reach them. A body-level fixed layer left
 * behind after the avatar is released is what kept killing `backdrop-filter`
 * on the panel beneath it, which the operator sees as "the opacity has
 * disappeared" every time they come back from the avatar.
 *
 * This file already carried the evidence: `init()` sweeps
 * `script[src*="agent.d-id.com"]` and `[id^="did-avatar-container-"]` GLOBALLY
 * before injecting, because the SDK was known to leave artifacts around the
 * document. That sweep just never ran on the way OUT.
 *
 * So: the host now unmounts when no container owns the avatar (see the two
 * layouts), and unmounting sweeps the SDK's body-level artifacts as well as
 * our own container. Re-entering avatar mode re-injects the SDK — a real
 * reload cost of a second or two, accepted deliberately: three attempts at
 * keeping it mounted-but-inert each left the surface beneath it broken.
 */

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useMetaAvatar } from '@/app/contexts/MetaAvatarContext';

// D-ID configuration - extracted from Netlify app
const DID_CLIENT_KEY = process.env.NEXT_PUBLIC_DID_CLIENT_KEY || 'Z29vZ2xlLW9hdXRoMnwxMDcyNjU3ODI2NjQ5ODgyODU4MDk6YkoxSDdROEp5S2Q1Mk1CbEx0ODE2';
const DID_AGENT_ID = process.env.NEXT_PUBLIC_DID_AGENT_ID || 'v2_agt_dY78cKv2';

/**
 * Every DOM signature the D-ID SDK is known to stamp on nodes it owns — its
 * script tag, our target container, and the `did-agent` element family it
 * mounts (named by `data-name="did-agent"` in the script attributes below).
 *
 * Selector-based rather than "anything that appeared after init", so the sweep
 * can never remove a node belonging to another component that happened to
 * mount in the same window. No element in this codebase outside this file
 * carries a `did-` identity.
 */
const DID_ARTIFACT_SELECTOR = [
  // Anything the SDK serves — its module script AND the iframe this file's own
  // header documents it injecting. The iframe is the node most likely to be the
  // stray fixed layer, and `[id^=…]`/`[data-name=…]` alone would never catch it.
  '[src*="d-id.com"]',
  '[id^="did-avatar-container-"]',
  '[data-name="did-agent"]',
  'did-agent',
  '[id*="did-agent"]',
  '[class*="did-agent"]',
  // The SDK's own attribute set, verified absent everywhere else in this
  // codebase — nothing outside this file declares `data-agent-id`.
  '[data-agent-id]',
].join(',');

/**
 * Removes the SDK's nodes wherever they live in the document — including the
 * body-level ones the host wrapper cannot reach. `keepContainer` spares the
 * React-owned container during init (React owns its lifecycle; removing it
 * from under React would desync the tree), while unmount sweeps everything.
 */
export function sweepDidArtifacts(keepContainer?: HTMLElement | null): void {
  if (typeof document === 'undefined') return;
  document.querySelectorAll(DID_ARTIFACT_SELECTOR).forEach((node) => {
    if (keepContainer && node === keepContainer) {
      if (node instanceof HTMLElement) node.innerHTML = '';
      return;
    }
    node.remove();
  });
}

export function MetaAvatar() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const containerIdRef = useRef<string>(`did-avatar-container-${Math.random().toString(36).slice(2)}`);
  const { activeAgent } = useMetaAvatar();
  /**
   * Confirmed 2026-08-11 (targeted correction pass, #98) as a REAL, separate
   * bug from the unrelated "active-persona failed (504)" defect fixed in
   * `services/wallet/personaRepo.ts` the same day — this component's D-ID
   * script `onerror` handler existed but only ever `console.error`d; there
   * was no visible state at all, so a failed SDK load rendered as a
   * permanently blank black box with nothing to tell the operator (or an
   * engineer looking at the live surface) that a load failure — not a
   * persona/auth failure — is what happened. This is an honest surfaced
   * failure state for THIS component's own dependency, not a stand-in for a
   * missing persona/avatar identity, so it does not fall under "do not mask
   * a failed persona read with a placeholder avatar."
   */
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    // The document-level styles the SDK is known to reach for BEFORE it loads.
    // An embedded third-party widget commonly writes `document.body.style`
    // (overflow / position) to manage its own overlay; those writes are not
    // nodes, so no amount of element sweeping undoes them, and they outlive
    // the avatar — a leftover `overflow: hidden` reads as "the panel stopped
    // scrolling", which the operator has also reported.
    //
    // Only these two properties are captured and restored — NOT the whole
    // style attribute. A blanket restore would also wipe anything another
    // component legitimately set while the avatar happened to be open.
    const bodyOverflowBeforeSdk = document.body.style.overflow;
    const bodyPositionBeforeSdk = document.body.style.position;

    const init = () => {
      // Generate unique container ID for this instance
      const containerId = `did-avatar-container-${Math.random().toString(36).slice(2)}`;
      containerIdRef.current = containerId;

      console.log('[MetaAvatar] init', { containerId, agent: activeAgent, ts: new Date().toISOString() });

      // Clear any previous failure state — this init() may be a `reload()`
      // recovering from an earlier failed load.
      setLoadFailed(false);

      // Remove any previously injected D-ID artifacts (global cleanup),
      // including the body-level nodes the host wrapper never contained.
      sweepDidArtifacts(containerRef.current);

      // Ensure container has the unique id
      if (containerRef.current) {
        containerRef.current.id = containerId;
        containerRef.current.innerHTML = '';
      }

      // Create fresh script element for D-ID SDK
      const script = document.createElement('script');
      script.type = 'module';
      /*
       * CACHE-BUSTED SRC — the actual cause of the blank-on-return report.
       *
       * `<script type="module">` is evaluated AT MOST ONCE per exact URL for
       * the life of the page (the browser's module map is keyed by resolved
       * URL, not by how many `<script>` tags request it). The mount effect
       * below correctly re-runs `init()` on every remount — a fresh script
       * element, a fresh container id, a fresh sweep — but re-appending the
       * SAME src silently no-ops on the SECOND and every later mount: the
       * module's top-level init code (the part that reads `data-target-id`
       * and renders into the container) never runs again, so the new,
       * genuinely fresh container sits there with nothing rendered into it —
       * a real container, a real cleanup, an SDK that was never asked to look
       * at either. A trailing query string makes each injection a distinct
       * module URL, so the browser fetches and evaluates it fresh every time,
       * exactly as `init()` already intends.
       */
      script.src = `https://agent.d-id.com/v2/index.js?_r=${Date.now()}`;
      script.setAttribute('data-mode', 'full');
      script.setAttribute('data-client-key', DID_CLIENT_KEY);
      script.setAttribute('data-agent-id', DID_AGENT_ID);
      script.setAttribute('data-name', 'did-agent');
      script.setAttribute('data-monitor', 'true');
      script.setAttribute('data-target-id', containerId);
      
      // Handle script load errors gracefully — visibly, not just to the console.
      script.onerror = () => {
        console.error('[MetaAvatar] Failed to load D-ID SDK');
        setLoadFailed(true);
      };

      document.body.appendChild(script);
      scriptRef.current = script;
    };

    // Initialize on mount
    init();

    const reload = () => {
      // Clean up current script
      if (scriptRef.current && scriptRef.current.parentNode) {
        scriptRef.current.parentNode.removeChild(scriptRef.current);
        scriptRef.current = null;
      }

      // Clear container
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }

      // Re-initialize
      init();
    };

    // Listen for external refresh events
    const handleRefresh = () => {
      console.log('[MetaAvatar] refresh event received');
      reload();
    };

    window.addEventListener('metaAvatarRefresh', handleRefresh);

    /*
     * BROWSER-TAB RETURN (operator report, 2026-08-06: "still blank screen on
     * returning after changing tabs" — persisting after the module-cache-bust
     * fix above, which only covers a React mount/unmount, not this). D-ID's
     * embedded video widget is known to suspend its underlying media/WebRTC
     * pipeline when its tab is backgrounded and NOT reliably resume it when
     * the tab regains visibility — a widget-side lifecycle issue, not
     * something a container/script-tag fix can reach. The one lever this
     * component has is the SAME reload path `metaAvatarRefresh` already uses:
     * fire it automatically when the tab transitions hidden -> visible while
     * this instance is mounted (i.e. while a container actually owns the
     * avatar), so a stalled widget gets a fresh script + container rather
     * than staying blank until the operator finds a manual refresh control.
     */
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        console.log('[MetaAvatar] tab became visible — reloading to recover from a possible suspended widget');
        reload();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('metaAvatarRefresh', handleRefresh);

      // Cleanup on unmount. The container clear + script removal below were
      // always here; the body-level sweep is what was missing, and it is the
      // half that actually frees the surface underneath (see the header note).
      if (scriptRef.current && scriptRef.current.parentNode) {
        scriptRef.current.parentNode.removeChild(scriptRef.current);
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      sweepDidArtifacts(containerRef.current);

      // Put back only what the SDK may have taken (see the capture above).
      if (document.body.style.overflow !== bodyOverflowBeforeSdk) {
        document.body.style.overflow = bodyOverflowBeforeSdk;
      }
      if (document.body.style.position !== bodyPositionBeforeSdk) {
        document.body.style.position = bodyPositionBeforeSdk;
      }
    };
  }, []);

  // Handle agent changes
  useEffect(() => {
    // TODO: When D-ID supports dynamic agent switching, implement here
    // For now, agent changes would require a refresh
    console.log('[MetaAvatar] activeAgent changed:', activeAgent);
  }, [activeAgent]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full bg-black rounded-lg overflow-hidden"
      />
      {loadFailed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-black/90 px-4 text-center">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <p className="text-xs text-slate-300">Avatar unavailable — couldn&apos;t load the D-ID agent.</p>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('metaAvatarRefresh'))}
            className="text-[11px] text-amber-400 underline underline-offset-2 hover:text-amber-300"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

export default MetaAvatar;
