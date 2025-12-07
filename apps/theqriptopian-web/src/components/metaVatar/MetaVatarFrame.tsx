/**
 * MetaVatarFrame Component
 * Persistent iframe for metaVatar agent interface
 * 
 * metaVatar is a specific avatar primitive: iQube and Aigent protocol enabled
 * Compliant with contentQube and AigentQube primitives
 * 
 * This component will be extracted to @agentiq/avatar-host package
 */

import { useEffect, useRef, useState } from 'react';
import { Loader2, Maximize2, Minimize2 } from 'lucide-react';

interface MetaVatarFrameProps {
  agentId: 'nakamoto' | 'know1' | 'moneypenny';
  isVisible: boolean;
  onMinimize?: () => void;
}

interface MetaVatarMessage {
  type: 'agent:loaded' | 'agent:message' | 'agent:action' | 'agent:error';
  payload?: any;
}

export function MetaVatarFrame({ agentId, isVisible, onMinimize }: MetaVatarFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  // Handle messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent<MetaVatarMessage>) => {
      // TODO: Verify origin in production
      // if (event.origin !== 'https://avatar.aigentz.com') return;

      const message = event.data;

      switch (message.type) {
        case 'agent:loaded':
          setIsLoading(false);
          console.log(`[MetaVatarFrame] Agent ${agentId} loaded`);
          break;
        
        case 'agent:message':
          console.log(`[MetaVatarFrame] Message from ${agentId}:`, message.payload);
          break;
        
        case 'agent:action':
          console.log(`[MetaVatarFrame] Action from ${agentId}:`, message.payload);
          break;
        
        case 'agent:error':
          console.error(`[MetaVatarFrame] Error from ${agentId}:`, message.payload);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [agentId]);

  // Send agent context to iframe when agent changes
  useEffect(() => {
    if (!iframeRef.current || isLoading) return;

    const message = {
      type: 'app:agent-context',
      payload: {
        agentId,
        timestamp: Date.now(),
      },
    };

    iframeRef.current.contentWindow?.postMessage(message, '*');
    console.log(`[MetaVatarFrame] Sent context for agent: ${agentId}`);
  }, [agentId, isLoading]);

  const handleLoad = () => {
    setIsLoading(false);
    console.log(`[MetaVatarFrame] Iframe loaded for agent: ${agentId}`);
  };

  // For now, we're using a placeholder URL
  // TODO: Replace with actual metaVatar service URL
  // metaVatar is our specific avatar primitive for persistent agent interfaces
  const metaVatarUrl = `/metaVatar.html?agent=${agentId}`;

  if (!isVisible) return null;

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-cyan-400" />
            <p className="text-sm text-muted-foreground">
              Loading metaVatar for {agentId}...
            </p>
          </div>
        </div>
      )}

      {/* Iframe Container */}
      <div className={`relative w-full h-full ${isExpanded ? 'max-w-none' : 'max-w-4xl'} transition-all duration-300`}>
        <iframe
          ref={iframeRef}
          src={metaVatarUrl}
          onLoad={handleLoad}
          className="w-full h-full border-2 border-border/30 rounded-lg bg-background/20"
          title={`metaVatar - ${agentId}`}
          sandbox="allow-scripts allow-same-origin allow-forms"
          allow="microphone; camera"
        />

        {/* Controls Overlay */}
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 bg-background/80 backdrop-blur-sm border border-border/30 rounded-md hover:bg-background/90 transition-colors"
            title={isExpanded ? 'Normal view' : 'Expand'}
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4 text-foreground" />
            ) : (
              <Maximize2 className="h-4 w-4 text-foreground" />
            )}
          </button>

          {onMinimize && (
            <button
              onClick={onMinimize}
              className="p-2 bg-background/80 backdrop-blur-sm border border-border/30 rounded-md hover:bg-background/90 transition-colors"
              title="Minimize to chat mode"
            >
              <span className="text-sm font-medium text-foreground">💬</span>
            </button>
          )}
        </div>

        {/* Agent Indicator */}
        <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-background/80 backdrop-blur-sm border border-border/30 rounded-md">
          <p className="text-xs font-medium text-foreground">
            Active: <span className="text-cyan-400">{agentId.toUpperCase()}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
