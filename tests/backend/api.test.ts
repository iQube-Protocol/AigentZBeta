/**
 * Backend API Integration Tests
 * Comprehensive testing of all AgentiQ backend APIs
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const BASE_URL = 'http://localhost:3001';

// Test utilities
async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });
  
  const data = await response.json();
  return { response, data };
}

describe('Backend API Tests', () => {
  let testChannelId: string;
  let testTenantId: string;

  beforeAll(async () => {
    console.log('Starting backend API tests...');
  });

  describe('System Health', () => {
    it('should return healthy system status', async () => {
      const { response, data } = await apiRequest('/api/system/status');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.status).toBe('healthy');
      expect(data.components).toBeDefined();
    });
  });

  describe('Composer APIs', () => {
    it('should list available templates', async () => {
      const { response, data } = await apiRequest('/api/composer/templates');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.templates)).toBe(true);
      expect(data.templates.length).toBeGreaterThan(0);
    });

    it('should create an experience session', async () => {
      const { response, data } = await apiRequest('/api/composer/sessions', {
        method: 'POST',
        body: JSON.stringify({
          template: 'qriptopian_reading_sprint_v0',
          config: { goal: 'agentic_payments' },
          title: 'Test Experience',
          description: 'Test description',
          tenantId: 'agentiq_main',
        }),
      });
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.sessionId).toBeDefined();
    });

    it('should list experiences', async () => {
      const { response, data } = await apiRequest('/api/composer/experiences');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.experiences)).toBe(true);
    });
  });

  describe('QubeTalk APIs', () => {
    it('should create a new channel', async () => {
      const { response, data } = await apiRequest('/api/qubetalk/channels', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: 'agentiq_main',
          participants: ['system_copilot', 'test_agent'],
        }),
      });
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.channel).toBeDefined();
      expect(data.channel.channel_id).toBeDefined();
      
      testChannelId = data.channel.channel_id;
    });

    it('should list channels', async () => {
      const { response, data } = await apiRequest('/api/qubetalk/channels?tenant_id=agentiq_main');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.channels)).toBe(true);
    });

    it('should send a message to channel', async () => {
      const { response, data } = await apiRequest('/api/qubetalk/channels/' + testChannelId + '/messages', {
        method: 'POST',
        body: JSON.stringify({
          from_agent: 'test_agent',
          content: {
            type: 'text',
            text: 'Test message from API tests',
          },
        }),
      });
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBeDefined();
    });

    it('should get messages from channel', async () => {
      const { response, data } = await apiRequest('/api/qubetalk/channels/' + testChannelId + '/messages');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.messages)).toBe(true);
    });
  });

  describe('CRM APIs', () => {
    it('should submit tenant application', async () => {
      const { response, data } = await apiRequest('/api/crm/tenants/apply', {
        method: 'POST',
        body: JSON.stringify({
          organization_name: 'API Test Organization',
          organization_description: 'Test organization for API validation',
          contact_email: 'test@example.com',
          contact_name: 'API Test Contact',
        }),
      });
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.application).toBeDefined();
      expect(data.application.tenant_id).toBeDefined();
      
      testTenantId = data.application.tenant_id;
    });

    it('should list tenants', async () => {
      const { response, data } = await apiRequest('/api/crm/tenants');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  describe('AgentiQ Hierarchy APIs', () => {
    it('should get AgentiQ hierarchy', async () => {
      const { response, data } = await apiRequest('/api/crm/agentiq/hierarchy?includeStats=true');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.hierarchy).toBeDefined();
      expect(data.hierarchy.anchor).toBeDefined();
      expect(data.hierarchy.anchor.slug).toBe('agentiq');
      expect(data.hierarchy.stats).toBeDefined();
    });

    it('should include tenant hierarchy when requested', async () => {
      const { response, data } = await apiRequest('/api/crm/agentiq/hierarchy?includeTenants=true');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.hierarchy.tenants).toBeDefined();
      expect(Array.isArray(data.hierarchy.tenants.allTenants)).toBe(true);
    });
  });

  describe('AA-API QubeTalk Integration', () => {
    const externalHeaders = {
      'X-API-Key': 'demo-external-key',
      'X-Agent-ID': 'test-external-agent',
    };

    it('should create external channel', async () => {
      const { response, data } = await apiRequest('/api/aa/qubetalk/channels', {
        method: 'POST',
        headers: externalHeaders,
        body: JSON.stringify({
          tenant_id: 'agentiq_main',
          channel_name: 'API Test External Channel',
          description: 'Test channel for API validation',
        }),
      });
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.channel).toBeDefined();
      expect(data.channel.participants).toContain('external');
    });

    it('should list external channels', async () => {
      const { response, data } = await apiRequest('/api/aa/qubetalk?tenant_id=agentiq_main', {
        headers: externalHeaders,
      });
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.channels)).toBe(true);
    });

    it('should reject unauthorized requests', async () => {
      const { response, data } = await apiRequest('/api/aa/qubetalk', {
        method: 'POST',
        body: JSON.stringify({
          channel_id: 'test',
          tenant_id: 'agentiq_main',
          message: 'test',
        }),
      });
      
      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent resources', async () => {
      const { response, data } = await apiRequest('/api/composer/experiences/non-existent');
      
      expect(response.status).toBe(404);
    });

    it('should validate required fields', async () => {
      const { response, data } = await apiRequest('/api/crm/tenants/apply', {
        method: 'POST',
        body: JSON.stringify({}), // Missing required fields
      });
      
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should handle malformed JSON', async () => {
      const response = await fetch(`${BASE_URL}/api/composer/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });
      
      expect(response.status).toBe(400);
    });
  });

  afterAll(async () => {
    console.log('Backend API tests completed!');
  });
});

// Performance tests
describe('Performance Tests', () => {
  it('should respond to health check within 1 second', async () => {
    const start = Date.now();
    const { response } = await apiRequest('/api/system/status');
    const duration = Date.now() - start;
    
    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(1000);
  });

  it('should handle concurrent requests', async () => {
    const promises = Array.from({ length: 10 }, () => 
      apiRequest('/api/composer/templates')
    );
    
    const results = await Promise.all(promises);
    
    results.forEach(({ response, data }) => {
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
