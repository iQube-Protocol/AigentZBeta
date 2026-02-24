/**
 * SmartTriad Copilot Inference Rendering System
 * 
 * Global default styling and components for all SmartTriad copilot implementations.
 * Replaces Aigent Nakamoto orange with system Cyan theming.
 */

// Core Components
export { SmartTriadInferenceRenderer } from './SmartTriadInferenceRenderer';
export { SmartTriadCopilotLayer } from './SmartTriadCopilotLayer';

// Types
export type { SmartTriadMessage } from './SmartTriadInferenceRenderer';

// CSS (import this in your application root or layout)
import './styles/smarttriad-copilot.css';

// Version
export const SMARTTRIAD_COPILOT_VERSION = '1.0.0';

// Feature flag helper
export const isSmartTriadCopilotEnabled = () => {
  if (typeof window === 'undefined') return false;
  return process.env.NEXT_PUBLIC_SMARTTRIAD_COPILOT_V2 === 'true' || 
         window.localStorage.getItem('smarttriad_copilot_v2') === 'true';
};

// Tenant configuration helper
export const createTenantConfig = (overrides?: {
  enableModelSelection?: boolean;
  availableAgents?: string[];
  defaultAgent?: string;
  accentColor?: string;
}) => {
  return {
    enableModelSelection: true,
    availableAgents: [],
    defaultAgent: '',
    accentColor: 'hsl(188, 94%, 43%)', // System cyan
    ...overrides,
  };
};

// Default configuration
export const DEFAULT_SMARTTRIAD_CONFIG = {
  enableAdvancedRendering: true,
  showMetadata: true,
  showScores: false, // Disabled by default for cleaner UI
  tenantConfig: createTenantConfig(),
};
