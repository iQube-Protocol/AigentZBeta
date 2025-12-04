/**
 * CopilotKit Backend Actions Index
 * 
 * Phase 0: Read-only backend actions for Platform Copilot
 * Phase 1: Write operations with RBAC
 * CRM: AgentiQ CRM operations
 */

// Phase 0: Read-only actions
import { registryActions } from "./registry";
import { walletActions } from "./wallet";
import { identityActions } from "./identity";

// Phase 1: Write actions
import { registryWriteActions } from "./registry-write";
import { walletWriteActions } from "./wallet-write";
import { identityWriteActions } from "./identity-write";
import { smartMenuActions } from "./smartmenu";

// Phase 2: Orchestrated workflows
import { workflowActions } from "./workflows";

// Phase 4: MCP + ToolQube bridge
import { mcpToolQubeActions } from "./mcp-toolqube";

// Phase 5: Governance & Logging
import { governanceActions } from "./governance";

// CRM: AgentiQ CRM operations
import { crmActions } from "./crm";

// Smart Content: Content creation, library, pricing
import { smartContentActions } from "./smartcontent";

// Persona: Persona management and wallet operations
import { personaActions } from "./persona";

// Smart Triad: Orchestrated Content + Wallet + Menu coordination
import { smartTriadActions } from "./smartTriad";

// Smart Menu Content Integration
import { smartMenuContentActions } from "@/services/content/smartMenuIntegration";

/**
 * All backend actions available to the Platform Copilot
 * These are registered with CopilotKit and available for tool calling
 */
export const allActions = [
  // Phase 0: Read-only
  ...registryActions,
  ...walletActions,
  ...identityActions,
  // Phase 1: Write operations
  ...registryWriteActions,
  ...walletWriteActions,
  ...identityWriteActions,
  ...smartMenuActions,
  // Phase 2: Orchestrated workflows
  ...workflowActions,
  // Phase 4: MCP + ToolQube
  ...mcpToolQubeActions,
  // Phase 5: Governance
  ...governanceActions,
  // CRM: AgentiQ CRM
  ...crmActions,
  // Smart Content: NL → SmartContentQube
  ...smartContentActions,
  // Persona: Persona management and wallet operations
  ...personaActions,
  // Smart Triad: Content + Wallet + Menu orchestration
  ...smartTriadActions,
  // Smart Menu Content Integration
  ...smartMenuContentActions,
];

export * from "./registry";
export * from "./wallet";
export * from "./identity";
export * from "./registry-write";
export * from "./wallet-write";
export * from "./identity-write";
export * from "./smartmenu";
export * from "./workflows";
export * from "./mcp-toolqube";
export * from "./governance";
// CRM actions exported separately to avoid naming conflicts
export { crmActions } from "./crm";
// Smart Content actions
export * from "./smartcontent";
// Persona actions
export * from "./persona";
// Smart Triad orchestration actions
export * from "./smartTriad";
