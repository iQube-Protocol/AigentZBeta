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

export interface CodexTab {
  id: string;
  label: string;
  slug: string;
  enabled: boolean;
  order: number;
  type: CodexTabType;
  config: CodexTabConfig;
  metadata?: CodexTabMetadata;
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
  permissions: CodexPermissions;
  liquidUI?: CodexLiquidUIConfig;
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
