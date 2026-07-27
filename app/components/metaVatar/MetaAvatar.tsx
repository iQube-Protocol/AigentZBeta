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

import { useEffect, useRef } from 'react';
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
  'script[src*="agent.d-id.com"]',
  '[id^="did-avatar-container-"]',
  '[data-name="did-agent"]',
  'did-agent',
  '[id*="did-agent"]',
  '[class*="did-agent"]',
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

  useEffect(() => {
    const init = () => {
      // Generate unique container ID for this instance
      const containerId = `did-avatar-container-${Math.random().toString(36).slice(2)}`;
      containerIdRef.current = containerId;

      console.log('[MetaAvatar] init', { containerId, agent: activeAgent, ts: new Date().toISOString() });

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
      script.src = 'https://agent.d-id.com/v2/index.js';
      script.setAttribute('data-mode', 'full');
      script.setAttribute('data-client-key', DID_CLIENT_KEY);
      script.setAttribute('data-agent-id', DID_AGENT_ID);
      script.setAttribute('data-name', 'did-agent');
      script.setAttribute('data-monitor', 'true');
      script.setAttribute('data-target-id', containerId);
      
      // Handle script load errors gracefully
      script.onerror = () => {
        console.error('[MetaAvatar] Failed to load D-ID SDK');
      };

      document.body.appendChild(script);
      scriptRef.current = script;
    };

    // Initialize on mount
    init();

    // Listen for external refresh events
    const handleRefresh = () => {
      console.log('[MetaAvatar] refresh event received');
      
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

    window.addEventListener('metaAvatarRefresh', handleRefresh);

    return () => {
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
    };
  }, []);

  // Handle agent changes
  useEffect(() => {
    // TODO: When D-ID supports dynamic agent switching, implement here
    // For now, agent changes would require a refresh
    console.log('[MetaAvatar] activeAgent changed:', activeAgent);
  }, [activeAgent]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full bg-black rounded-lg overflow-hidden"
    />
  );
}

export default MetaAvatar;
