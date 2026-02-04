/**
 * AG-UI Services Barrel Export
 * 
 * Centralized export point for AG-UI services to simplify imports
 * and avoid webpack resolution issues.
 */

export { SmartTriadStateManager, getStateManager } from './SmartTriadStateManager';
export type { SmartTriadState, StateEvent, StateDelta } from './SmartTriadStateManager';

export { TemplateRegistry } from './TemplateRegistry';
export type { TemplateDefinition } from './TemplateRegistry';
