/**
 * Universal iQube Ecosystem Service
 * 
 * Unified Supabase access layer designed for the entire iQube ecosystem:
 * - A2A Payment System
 * - Identity & Reputation Management
 * - iQube Registry Integration
 * - Universal Menu & Cross-Agent Navigation
 * - Multi-Tenant Agent Applications
 * 
 * This service provides a single, robust, and flexible foundation for all
 * iQube services to access the QubeBase database via the QubeBase SDK.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AgentiqCoreClient, initAgentiqClient } from '@qriptoagentiq/core-client';

export interface QubeServiceConfig {
  // Core Supabase Configuration
  supabaseUrl: string;
  supabaseServiceRoleKey?: string;
  supabaseAnonKey?: string;
  
  // Multi-Tenant Configuration
  defaultTenantId?: string;
  agentId?: string;
  
  // Service-Specific Configuration
  serviceType: 'payment' | 'identity' | 'reputation' | 'registry' | 'navigation' | 'admin' | 'generic';
  requiresServiceRole?: boolean;
  
  // QubeBase SDK Configuration
  enableQubeSDK?: boolean;
  qubeSDKConfig?: {
    supabaseUrl: string;
    supabaseAnonKey: string;
  };
}

export interface TenantContext {
  agentId: string;
  tenantId?: string;
  permissions: string[];
  serviceAccess: string[];
}

/**
 * Universal Service Factory for iQube Ecosystem
 */
export class UniversalQubeService {
  private static instance: UniversalQubeService;
  private serviceRoleClient?: SupabaseClient;
  private anonClient?: SupabaseClient;
  private qubeSDKClient?: AgentiqCoreClient;
  private tenantClients: Map<string, SupabaseClient> = new Map();
  
  private config: QubeServiceConfig;

  private constructor(config: QubeServiceConfig) {
    this.config = config;
    this.initializeClients();
  }

  /**
   * Initialize Universal Service (Singleton Pattern)
   */
  public static initialize(config: QubeServiceConfig): UniversalQubeService {
    if (!UniversalQubeService.instance) {
      UniversalQubeService.instance = new UniversalQubeService(config);
    }
    return UniversalQubeService.instance;
  }

  /**
   * Get Universal Service Instance
   */
  public static getInstance(): UniversalQubeService {
    if (!UniversalQubeService.instance) {
      throw new Error('UniversalQubeService not initialized. Call initialize() first.');
    }
    return UniversalQubeService.instance;
  }

  /**
   * Initialize all client types
   */
  private async initializeClients() {
    try {
      // Initialize Service Role Client (for sensitive operations)
      if (this.config.supabaseServiceRoleKey) {
        this.serviceRoleClient = createClient(
          this.config.supabaseUrl,
          this.config.supabaseServiceRoleKey,
          {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { 'x-service-type': this.config.serviceType } }
          }
        );
      }

      // Initialize Anonymous Client (for public operations)
      if (this.config.supabaseAnonKey) {
        this.anonClient = createClient(
          this.config.supabaseUrl,
          this.config.supabaseAnonKey,
          {
            auth: { persistSession: true, autoRefreshToken: true },
            global: { headers: { 'x-service-type': this.config.serviceType } }
          }
        );
      }

      // Initialize QubeBase SDK Client (for iQube ecosystem integration)
      if (this.config.enableQubeSDK && this.config.qubeSDKConfig) {
        this.qubeSDKClient = initAgentiqClient({
          supabaseUrl: this.config.qubeSDKConfig.supabaseUrl,
          supabaseAnonKey: this.config.qubeSDKConfig.supabaseAnonKey
        });
      }

      console.log(`[UniversalQubeService] Initialized for service: ${this.config.serviceType}`);
    } catch (error) {
      console.error('[UniversalQubeService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get Service Role Client (for sensitive operations like agent keys, admin functions)
   */
  public getServiceRoleClient(): SupabaseClient {
    if (!this.serviceRoleClient) {
      throw new Error('Service role client not available. Check SUPABASE_SERVICE_ROLE_KEY.');
    }
    return this.serviceRoleClient;
  }

  /**
   * Get Anonymous Client (for public operations like identity, reputation)
   */
  public getAnonClient(): SupabaseClient {
    if (!this.anonClient) {
      throw new Error('Anonymous client not available. Check SUPABASE_ANON_KEY.');
    }
    return this.anonClient;
  }

  /**
   * Get QubeBase SDK Client (for iQube ecosystem integration)
   */
  public getQubeSDKClient(): AgentiqCoreClient {
    if (!this.qubeSDKClient) {
      throw new Error('QubeBase SDK client not available. Enable QubeBase SDK in config.');
    }
    return this.qubeSDKClient;
  }

  /**
   * Get Tenant-Aware Client (for multi-agent scenarios)
   */
  public getTenantClient(tenantContext: TenantContext): SupabaseClient {
    const tenantKey = `${tenantContext.agentId}_${tenantContext.tenantId || 'default'}`;
    
    if (!this.tenantClients.has(tenantKey)) {
      // Determine which base client to use based on required permissions
      const needsServiceRole = tenantContext.permissions.some(p => 
        ['admin', 'agent_keys', 'sensitive_data'].includes(p)
      );
      
      const baseClient = needsServiceRole ? this.getServiceRoleClient() : this.getAnonClient();
      
      // Create tenant-specific client with RLS context
      const tenantClient = createClient(
        this.config.supabaseUrl,
        needsServiceRole ? this.config.supabaseServiceRoleKey! : this.config.supabaseAnonKey!,
        {
          auth: { persistSession: !needsServiceRole, autoRefreshToken: !needsServiceRole },
          global: { 
            headers: { 
              'x-agent-id': tenantContext.agentId,
              'x-tenant-id': tenantContext.tenantId || 'default',
              'x-service-type': this.config.serviceType
            } 
          }
        }
      );
      
      this.tenantClients.set(tenantKey, tenantClient);
    }
    
    return this.tenantClients.get(tenantKey)!;
  }

  /**
   * Get Client Based on Service Type (Smart Selection)
   */
  public getClientForService(serviceType?: string): SupabaseClient {
    const service = serviceType || this.config.serviceType;
    
    switch (service) {
      case 'payment':
      case 'admin':
        return this.getServiceRoleClient();
      
      case 'identity':
      case 'reputation':
      case 'registry':
      case 'navigation':
        return this.getAnonClient();
      
      default:
        return this.config.requiresServiceRole ? this.getServiceRoleClient() : this.getAnonClient();
    }
  }

  /**
   * Execute Query with Automatic Client Selection
   */
  public async executeQuery<T>(
    query: (client: SupabaseClient) => Promise<T>,
    options: {
      serviceType?: string;
      tenantContext?: TenantContext;
      useQubeSDK?: boolean;
    } = {}
  ): Promise<T> {
    try {
      let client: SupabaseClient;
      
      if (options.useQubeSDK) {
        client = this.getQubeSDKClient().supabase;
      } else if (options.tenantContext) {
        client = this.getTenantClient(options.tenantContext);
      } else {
        client = this.getClientForService(options.serviceType);
      }
      
      return await query(client);
    } catch (error) {
      console.error('[UniversalQubeService] Query execution failed:', error);
      throw error;
    }
  }

  /**
   * Health Check for All Clients
   */
  public async healthCheck(): Promise<{
    serviceRole: boolean;
    anon: boolean;
    qubeSDK: boolean;
    tenantClients: number;
  }> {
    const health = {
      serviceRole: false,
      anon: false,
      qubeSDK: false,
      tenantClients: this.tenantClients.size
    };

    try {
      if (this.serviceRoleClient) {
        const { error } = await this.serviceRoleClient.from('agent_keys').select('count').limit(1);
        health.serviceRole = !error;
      }
    } catch (e) {
      console.warn('[UniversalQubeService] Service role health check failed:', e);
    }

    try {
      if (this.anonClient) {
        const { error } = await this.anonClient.from('persona').select('count').limit(1);
        health.anon = !error;
      }
    } catch (e) {
      console.warn('[UniversalQubeService] Anon client health check failed:', e);
    }

    try {
      if (this.qubeSDKClient) {
        const { error } = await this.qubeSDKClient.supabase.from('persona').select('count').limit(1);
        health.qubeSDK = !error;
      }
    } catch (e) {
      console.warn('[UniversalQubeService] QubeBase SDK health check failed:', e);
    }

    return health;
  }

  /**
   * Clear All Clients (for testing/reset)
   */
  public clearClients() {
    this.tenantClients.clear();
    this.serviceRoleClient = undefined;
    this.anonClient = undefined;
    this.qubeSDKClient = undefined;
  }
}

/**
 * Service Factory Functions for Different iQube Services
 */

/**
 * Payment Service Factory (A2A Transactions, Agent Keys)
 */
export function createPaymentService(): UniversalQubeService {
  return UniversalQubeService.initialize({
    supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    serviceType: 'payment',
    requiresServiceRole: true
  });
}

/**
 * Identity Service Factory (Personas, FIO Registration)
 */
export function createIdentityService(): UniversalQubeService {
  return UniversalQubeService.initialize({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!,
    serviceType: 'identity',
    enableQubeSDK: true,
    qubeSDKConfig: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!
    }
  });
}

/**
 * Registry Service Factory (iQube Registry Integration)
 */
export function createRegistryService(): UniversalQubeService {
  return UniversalQubeService.initialize({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!,
    serviceType: 'registry',
    enableQubeSDK: true,
    qubeSDKConfig: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!
    }
  });
}

/**
 * Navigation Service Factory (Universal Menu, Cross-Agent Navigation)
 */
export function createNavigationService(): UniversalQubeService {
  return UniversalQubeService.initialize({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!,
    serviceType: 'navigation',
    enableQubeSDK: true,
    qubeSDKConfig: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!
    }
  });
}

/**
 * Multi-Tenant Service Factory (for applications serving multiple agents)
 */
export function createMultiTenantService(defaultAgentId: string): UniversalQubeService {
  return UniversalQubeService.initialize({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!,
    serviceType: 'generic',
    defaultTenantId: defaultAgentId,
    enableQubeSDK: true,
    qubeSDKConfig: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!
    }
  });
}
