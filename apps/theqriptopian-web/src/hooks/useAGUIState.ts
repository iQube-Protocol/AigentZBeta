/**
 * useAGUIState Hook
 * 
 * React hook for consuming AG-UI state from Aigent Z platform.
 * Provides reactive state updates and action dispatching.
 */

import { useState, useEffect, useCallback } from 'react';
import { getAGUIClient, SmartTriadState, ActionType } from '../services/aguiClient';

export function useAGUIState() {
  const [state, setState] = useState<SmartTriadState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const client = getAGUIClient();
      
      // Subscribe to state updates
      const unsubscribe = client.subscribe((newState) => {
        setState(newState);
        setConnected(true);
      });

      // Get initial state if available
      const initialState = client.getState();
      if (initialState) {
        setState(initialState);
        setConnected(true);
      }

      return () => {
        unsubscribe();
      };
    } catch (err) {
      setError(err as Error);
    }
  }, []);

  const sendAction = useCallback(async (type: ActionType, payload?: any) => {
    try {
      const client = getAGUIClient();
      await client.sendAction(type, payload);
    } catch (err) {
      setError(err as Error);
    }
  }, []);

  return {
    state,
    connected,
    error,
    sendAction,
    // Convenience accessors
    session: state?.session,
    content: state?.smartTriad.content,
    wallet: state?.smartTriad.wallet,
    menu: state?.smartTriad.menu,
    liquidUI: state?.liquidUI,
  };
}

/**
 * Hook for template-specific state
 */
export function useTemplateState() {
  const { liquidUI, sendAction } = useAGUIState();

  const selectTemplate = useCallback(
    async (templateId: string, bindings?: any) => {
      await sendAction('SELECT_TEMPLATE', { templateId, bindings });
    },
    [sendAction]
  );

  const changeRealm = useCallback(
    async (realm: string) => {
      await sendAction('CHANGE_REALM', { realm });
    },
    [sendAction]
  );

  return {
    selectedTemplateId: liquidUI?.selectedTemplateId,
    templateBindings: liquidUI?.templateBindings,
    copilotState: liquidUI?.copilotState,
    realmContext: liquidUI?.realmContext,
    userIntent: liquidUI?.userIntent,
    selectTemplate,
    changeRealm,
  };
}

/**
 * Hook for wallet state
 */
export function useWalletState() {
  const { wallet, sendAction } = useAGUIState();

  const openWallet = useCallback(
    async (mode: 'narrow' | 'wide' = 'narrow') => {
      await sendAction('OPEN_WALLET', { mode });
    },
    [sendAction]
  );

  const closeWallet = useCallback(async () => {
    await sendAction('CLOSE_WALLET');
  }, [sendAction]);

  const purchaseContent = useCallback(
    async (contentId: string, chain?: string) => {
      await sendAction('PURCHASE_CONTENT', { contentId, chain });
    },
    [sendAction]
  );

  return {
    walletOpen: wallet?.walletOpen || false,
    walletMode: wallet?.walletMode || 'narrow',
    purchaseInProgress: wallet?.purchaseInProgress || false,
    balances: wallet?.balances || {},
    pendingTx: wallet?.pendingTx,
    openWallet,
    closeWallet,
    purchaseContent,
  };
}

/**
 * Hook for content state
 */
export function useContentState() {
  const { content, liquidUI, sendAction } = useAGUIState();

  const selectContent = useCallback(
    async (contentId: string) => {
      await sendAction('SELECT_CONTENT', { contentId });
    },
    [sendAction]
  );

  return {
    currentContentId: content?.currentContentId,
    ownedContentIds: content?.ownedContentIds || [],
    libraryLoading: content?.libraryLoading || false,
    selectedIssueId: content?.selectedIssueId,
    selectedSectionId: content?.selectedSectionId,
    selectedTabId: content?.selectedTabId,
    // Platform-curated content from template bindings
    mounted: liquidUI?.templateBindings?.contentObjects || [],
    selectContent,
  };
}
