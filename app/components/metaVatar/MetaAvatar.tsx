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
 * IMPORTANT: This component should NEVER be unmounted during app lifecycle.
 * Use the MetaAvatarContext to show/hide via CSS instead.
 */

import { useEffect, useRef } from 'react';
import { useMetaAvatar } from '@/app/contexts/MetaAvatarContext';

// D-ID configuration - extracted from Netlify app
const DID_CLIENT_KEY = process.env.NEXT_PUBLIC_DID_CLIENT_KEY || 'Z29vZ2xlLW9hdXRoMnwxMDcyNjU3ODI2NjQ5ODgyODU4MDk6YkoxSDdROEp5S2Q1Mk1CbEx0ODE2';
const DID_AGENT_ID = process.env.NEXT_PUBLIC_DID_AGENT_ID || 'v2_agt_dY78cKv2';

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

      // Remove any previously injected D-ID artifacts (global cleanup)
      document.querySelectorAll('script[src*="agent.d-id.com"]').forEach((s) => s.remove());
      document.querySelectorAll('[id^="did-avatar-container-"]').forEach((el) => {
        if (el instanceof HTMLElement) el.innerHTML = '';
      });

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
      
      // Cleanup on unmount
      if (scriptRef.current && scriptRef.current.parentNode) {
        scriptRef.current.parentNode.removeChild(scriptRef.current);
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
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
    <div 
      ref={containerRef} 
      className="w-full h-full bg-black rounded-lg overflow-hidden"
    />
  );
}

export default MetaAvatar;
