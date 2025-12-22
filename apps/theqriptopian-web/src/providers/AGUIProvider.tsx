/**
 * AG-UI Provider for Qriptopian Web App (Thin Client)
 * 
 * This is a THIN CLIENT provider - it only manages AG-UI SSE connection
 * to the Aigent Z platform. It does NOT use CopilotKit client-side.
 * 
 * CopilotKit runs ONLY on the Aigent Z platform (server-side).
 * This client consumes state via AG-UI hooks (useTemplateState, useWalletState, etc.)
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { initializeAGUIClient, AGUIClient } from '@/services/aguiClient';

interface AGUIProviderProps {
  children: ReactNode;
  platformUrl?: string;
}

interface AGUIContextValue {
  client: AGUIClient | null;
  isConnected: boolean;
}

const AGUIContext = createContext<AGUIContextValue>({
  client: null,
  isConnected: false,
});

export const useAGUI = () => useContext(AGUIContext);

/**
 * Pure AG-UI Provider - NO CopilotKit on client side
 * The thin client only consumes state from the platform via SSE
 */
export const AGUIProvider = ({ 
  children, 
  platformUrl = process.env.NEXT_PUBLIC_AIGENT_Z_URL || 'http://localhost:3000' 
}: AGUIProviderProps) => {
  const [client, setClient] = useState<AGUIClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    console.log('[AGUIProvider] Initializing thin client connection to:', platformUrl);
    
    // Initialize AG-UI client (SSE connection only)
    const aguiClient = initializeAGUIClient({
      platformUrl,
      personaId: 'default', // Will be updated when user authenticates
      device: typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop',
    });

    setClient(aguiClient);

    // Connect to AG-UI stream
    aguiClient.connect();
    setIsConnected(true);

    console.log('[AGUIProvider] Thin client connected - consuming state via AG-UI hooks');

    // Cleanup on unmount
    return () => {
      console.log('[AGUIProvider] Disconnecting thin client');
      aguiClient.disconnect();
      setIsConnected(false);
    };
  }, [platformUrl]);

  return (
    <AGUIContext.Provider value={{ client, isConnected }}>
      {children}
    </AGUIContext.Provider>
  );
};
