/**
 * useCodex Hook
 * Access CodexQube data from any component
 */

import { useContext } from 'react';
import { CodexContext } from './CodexContext';

export function useCodex() {
  const context = useContext(CodexContext);
  
  if (!context) {
    throw new Error('useCodex must be used within a CodexProvider');
  }
  
  return context;
}
