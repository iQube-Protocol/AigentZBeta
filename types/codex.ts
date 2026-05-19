import type { RuntimeTakeoverConfig } from './runtimeTakeover';

/**
 * Multi-Codex System Types
 *
 * Defines the data model for dynamic, configurable codexes that can be
 * created, edited, and managed via API and UI.
 */

export type CodexTabType = 'static' | 'dynamic' | 'liquid-ui';

export interface CodexMetadata {
  description: string;
  icon?: string;
  color?: string;
  category?: string;
  tags?: string[];
}

export interface CodexPermissions {
  view: string[];      // Role/persona IDs that can view, '*' for public
  edit: string[];      // Role/persona IDs that can edit
  admin: string[];     // Role/persona IDs with full admin access
}

export interface CodexLiquidUIConfig {
  enabled: boolean;
  templateId?: string;
  defaultTemplate?: string;
}

export interface CodexTabConfig {
  component?: string;           // React component name for static tabs
  liquidTemplate?: string;      // Liquid UI template ID
  dataSource?: string;          // API endpoint or data source
  filters?: Record<string, any>;
  props?: Record<string, any>;  // Additional props for component
}

export interface CodexTabMetadata {
  icon?: string;
  description?: string;
  badge?: string;
  color?: string;
}

/** Visual group that clusters related tabs under a single top-level header. */
export interface TabGroup {
  id: string;          // Unique within the codex; referenced by CodexTab.group
  label: string;       // Display name shown in the primary tab bar
  icon?: string;       // Optional icon key from iconMap
  adminOnly?: boolean; // Hide the whole group from non-admins
  /**
   * When set, the whole group is visible only when the persona has an
   * `active` row in persona_activations for this activation id. Used by
   * the Activations system to switch entire surfaces (Venture Lab,
   * Marketa, AgentiQ OS, …) on/off from the Activations tab.
   */
  activationId?: string;
  order: number;       // Position in the primary tab bar (interleaved with standalone tabs)
}

export interface CodexTab {
  id: string;
  label: string;
  slug: string;
  enabled: boolean;
  adminOnly?: boolean;     // When true, tab is invisible to non-admin users
  partnerOnly?: boolean;   // When true, tab is only visible to partner users (admins also see it)
  investorOnly?: boolean;  // When true, tab is only visible to verified investors (admins also see it)
  /**
   * When set, tab is visible only when the persona has an `active` row in
   * `persona_activations` for this activation id (catalog id from
   * data/activation-catalog.ts). Admins are not implicitly bypassed — they
   * activate/deactivate just like users. The Admin tab itself stays
   * controlled by `adminOnly: true`, not an activation.
   */
  activationId?: string;
  order: number;
  type: CodexTabType;
  config: CodexTabConfig;
  metadata?: CodexTabMetadata;
  /** If set, this tab is a sub-tab of the named TabGroup (references TabGroup.id). */
  group?: string;
  /**
   * Optional third-tier sub-tabs rendered as an additional nav row inside
   * this tab. Lets a cartridge surface another cartridge's nested tabs
   * without modifying the source. The first enabled subTab is rendered by
   * default; selecting another swaps the rendered TabRenderer target.
   */
  subTabs?: CodexTab[];
}

export interface CodexConfig {
  id: string;                    // Unique identifier (e.g., 'knyt-codex')
  name: string;                  // Display name
  slug: string;                  // URL-friendly identifier
  enabled: boolean;              // API-controlled enable/disable
  version: string;               // Semantic versioning
  owner: string;                 // Tenant/persona ID
  metadata: CodexMetadata;
  tabs: CodexTab[];
  /** Optional tab groups — define top-level headers that cluster sub-tabs. */
  tabGroups?: TabGroup[];
  permissions: CodexPermissions;
  liquidUI?: CodexLiquidUIConfig;
  /**
   * Optional runtime takeover declaration.
   * When present and enabled, this cartridge can own the metaMe Runtime
   * surface for the duration of a user's session.
   */
  runtimeTakeover?: RuntimeTakeoverConfig;
  createdAt: string;
  updatedAt: string;
}

export interface CodexListItem {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  owner: string;
  metadata: CodexMetadata;
  tabCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCodexRequest {
  name: string;
  slug: string;
  owner: string;
  metadata: CodexMetadata;
  tabs?: Omit<CodexTab, 'id'>[];
  permissions?: Partial<CodexPermissions>;
  liquidUI?: CodexLiquidUIConfig;
}

export interface UpdateCodexRequest {
  name?: string;
  slug?: string;
  enabled?: boolean;
  metadata?: Partial<CodexMetadata>;
  permissions?: Partial<CodexPermissions>;
  liquidUI?: Partial<CodexLiquidUIConfig>;
}

export interface CreateTabRequest {
  label: string;
  slug: string;
  type: CodexTabType;
  config: CodexTabConfig;
  metadata?: CodexTabMetadata;
  order?: number;
}

export interface UpdateTabRequest {
  label?: string;
  slug?: string;
  enabled?: boolean;
  type?: CodexTabType;
  config?: Partial<CodexTabConfig>;
  metadata?: Partial<CodexTabMetadata>;
}

export interface ReorderTabsRequest {
  tabOrder: { id: string; order: number }[];
}

export interface CodexRegistryResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
