/**
 * MoneyPenny Client
 * 
 * Core client implementation extending AgentiQ functionality
 */

import { QueryClient } from '@tanstack/react-query';
import { AgentiQConfig, AgentiQClient } from '@/types/agentiq';

export class MoneyPennyCoreClient implements AgentiQClient {
  private config: AgentiQConfig;
  private queryClient: QueryClient;

  constructor(config: AgentiQConfig, queryClient: QueryClient) {
    this.config = config;
    this.queryClient = queryClient;
  }

  getConfig(): AgentiQConfig {
    return this.config;
  }

  async fetch(url: string, options?: RequestInit): Promise<any> {
    const baseUrl = this.config.apiBaseUrl || 'https://dev-beta.aigentz.me';
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

    const response = await fetch(fullUrl, {
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Class': this.config.agentClass,
        'X-Tenant-ID': this.config.tenantId || 'default',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  async disconnect(): Promise<void> {
    // Cleanup any connections if needed
  }
}

export class MoneyPennyClient extends MoneyPennyCoreClient {
  // Modules will be added here
  public quotes: any;
  public execution: any;
  public x402: any;
  public fio: any;

  constructor(config: AgentiQConfig, queryClient: QueryClient) {
    super(config, queryClient);
    
    // Initialize modules (simplified for now)
    this.quotes = {};
    this.execution = {};
    this.x402 = {};
    this.fio = {};
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'ok' | 'degraded' | 'error';
    services: Record<string, boolean>;
  }> {
    const services: Record<string, boolean> = {
      core: true,
      quotes: false, // Will be implemented
      execution: true,
      x402: false, // Will be implemented
      fio: false, // Will be implemented
    };

    const allOk = Object.values(services).every(v => v);
    const someOk = Object.values(services).some(v => v);

    return {
      status: allOk ? 'ok' : someOk ? 'degraded' : 'error',
      services,
    };
  }
}
