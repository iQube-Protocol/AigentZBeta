/**
 * SmartContent Action Hooks
 * Convenience hooks for accessing SmartContentActionContext
 */

import { useSmartContentAction as useBaseSmartContentAction, useSmartContentHandler as useBaseSmartContentHandler } from '@/app/contexts/SmartContentActionContext';
import type { SmartContentItem, ActionType } from '@/packages/smarttriad/src/types';

/**
 * Hook to access the global SmartContent action context
 * Re-exported for convenience
 */
export function useSmartContentAction() {
  return useBaseSmartContentAction();
}

/**
 * Hook that returns a handler for a specific content item
 * Use this in components: onAction={useSmartContentHandler(item)}
 */
export function useSmartContentHandler(item: SmartContentItem, playlist?: SmartContentItem[]) {
  return useBaseSmartContentHandler(item, playlist);
}

/**
 * Hook that returns an action executor for a specific content item
 * Alternative to useSmartContentHandler for more control
 */
export function useSmartContentExecutor(item: SmartContentItem, playlist?: SmartContentItem[]) {
  const { executeAction } = useSmartContentAction();
  
  return (action: ActionType) => executeAction(action, item, playlist);
}
