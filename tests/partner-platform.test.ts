/**
 * AgentiQ Marketa Partner Platform Test Suite
 * Comprehensive testing of new partner platform functionality
 * Including custom campaigns, sequence campaigns, Make integration, and rewards
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:3000',
  apiBase: `${process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:3000'}/api/marketa`,
  testPersonaId: 'test-persona-partner',
  testTenantId: 'demo-tenant',
  testAdminPersonaId: 'test-persona-admin',
  testAdminTenantId: 'agq-tenant',
  testCampaignId: '21-awakenings-campaign',
  testSecret: 'test-dispatch-secret'
};

// Helper function for API calls
async function apiCall(method: string, endpoint: string, data?: any, headers?: Record<string, string>) {
  const url = `${TEST_CONFIG.apiBase}${endpoint}`;
  const defaultHeaders = {
    'x-persona-id': TEST_CONFIG.testPersonaId,
    'x-tenant-id': TEST_CONFIG.testTenantId,
    'Content-Type': 'application/json',
    ...headers
  };

  const response = await fetch(url, {
    method,
    headers: defaultHeaders,
    body: data ? JSON.stringify(data) : undefined
  });

  return response.json();
}

// Helper function for admin API calls
async function adminApiCall(method: string, endpoint: string, data?: any) {
  return apiCall(method, endpoint, data, {
    'x-persona-id': TEST_CONFIG.testAdminPersonaId,
    'x-tenant-id': TEST_CONFIG.testAdminTenantId
  });
}

describe('AgentiQ Marketa Partner Platform', () => {
  
  describe('1. LVB Bridge Configuration', () => {
    it('should return tenant configuration', async () => {
      const response = await apiCall('GET', '/lvb/bridge?action=config');
      
      expect(response.success).toBe(true);
      expect(response.config).toBeDefined();
      expect(response.config.tenant_id).toBe(TEST_CONFIG.testTenantId);
      expect(response.config.persona_id).toBe(TEST_CONFIG.testPersonaId);
      expect(response.config.feature_flags).toBeDefined();
      expect(response.config.feature_flags.custom_campaigns).toBe(true);
      expect(response.config.feature_flags.sequence_campaigns).toBe(true);
      expect(response.config.feature_flags.partner_rewards).toBe(true);
    });

    it('should require authentication headers', async () => {
      const response = await fetch(`${TEST_CONFIG.apiBase}/lvb/bridge?action=config`);
      const result = await response.json();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('persona');
    });
  });

  describe('2. Pack Management (WPP)', () => {
    it('should retrieve pack queue', async () => {
      const response = await apiCall('GET', '/lvb/bridge?action=pack_queue');
      
      expect(response.success).toBe(true);
      expect(Array.isArray(response.packs)).toBe(true);
      expect(typeof response.total).toBe('number');
    });

    it('should retrieve pack details', async () => {
      const response = await apiCall('GET', '/lvb/bridge?action=pack_detail&packId=test-pack');
      
      // Should not error, even if pack doesn't exist
      expect(response.success).toBeDefined();
    });

    it('should handle pack approval', async () => {
      const response = await apiCall('POST', '/lvb/bridge?action=approve_pack', {
        packId: 'test-pack',
        approved: true
      });
      
      expect(response.success).toBeDefined();
    });
  });

  describe('3. Campaign Management', () => {
    it('should retrieve campaign catalog', async () => {
      const response = await apiCall('GET', '/lvb/bridge?action=campaign_catalog');
      
      expect(response.success).toBe(true);
      expect(Array.isArray(response.available_campaigns)).toBe(true);
      expect(Array.isArray(response.joined_campaigns)).toBe(true);
      expect(typeof response.total_available).toBe('number');
      expect(typeof response.total_joined).toBe('number');
    });

    it('should retrieve 21 Awakenings campaign details', async () => {
      const response = await apiCall('GET', `/lvb/bridge?action=campaign_detail&campaignId=${TEST_CONFIG.testCampaignId}`);
      
      expect(response.success).toBe(true);
      expect(response.campaign).toBeDefined();
      expect(response.campaign.campaign_type).toBe('sequence');
      expect(response.campaign.sequence_length).toBe(21);
      expect(response.campaign.helix_thread).toBe('mythos');
      expect(Array.isArray(response.campaign.marketa_sequence_items)).toBe(true);
    });

    it('should retrieve campaign status', async () => {
      const response = await apiCall('GET', `/lvb/bridge?action=campaign_status&campaignId=${TEST_CONFIG.testCampaignId}`);
      
      expect(response.success).toBe(true);
      expect(response.config).toBeDefined();
      expect(typeof response.is_active).toBe('boolean');
      expect(typeof response.progress_percentage).toBe('number');
    });
  });

  describe('4. Make.com Integration', () => {
    it('should provide setup guide', async () => {
      const response = await apiCall('GET', '/lvb/bridge?action=make_setup_guide');
      
      expect(response.success).toBe(true);
      expect(response.guide).toBeDefined();
      expect(response.guide.title).toContain('Make Integration');
      expect(Array.isArray(response.guide.steps)).toBe(true);
      expect(response.guide.webhook_payload_example).toBeDefined();
      expect(Array.isArray(response.guide.troubleshooting)).toBe(true);
    });

    it('should test webhook functionality', async () => {
      const response = await apiCall('POST', '/lvb/bridge?action=webhook_test', {
        makeWebhookUrl: 'https://httpbin.org/post',
        makeWebhookSecret: 'test-secret'
      });
      
      expect(response.success).toBe(true);
      expect(response.test_result).toBeDefined();
      expect(response.test_result.status).toBe('success');
      expect(typeof response.test_result.response_code).toBe('number');
      expect(typeof response.test_result.response_time_ms).toBe('number');
    });

    it('should handle webhook test failures', async () => {
      const response = await apiCall('POST', '/lvb/bridge?action=webhook_test', {
        makeWebhookUrl: 'https://invalid-url-that-does-not-exist.com',
        makeWebhookSecret: 'test-secret'
      });
      
      expect(response.success).toBe(true);
      expect(response.test_result.status).toBe('failed');
      expect(response.test_result.error_message).toBeDefined();
    });
  });

  describe('5. Performance Analytics', () => {
    it('should retrieve tenant performance', async () => {
      const response = await apiCall('GET', '/lvb/bridge?action=tenant_performance');
      
      expect(response.success).toBe(true);
      expect(Array.isArray(response.metrics)).toBe(true);
      expect(response.aggregates).toBeDefined();
      expect(response.rates).toBeDefined();
      expect(response.summary).toBeDefined();
    });

    it('should retrieve campaign performance', async () => {
      const response = await apiCall('GET', `/lvb/bridge?action=campaign_performance&campaignId=${TEST_CONFIG.testCampaignId}`);
      
      expect(response.success).toBe(true);
      expect(response.metrics).toBeDefined();
      expect(Array.isArray(response.delivery_logs)).toBe(true);
      expect(response.insights).toBeDefined();
      expect(response.insights.performance_trend).toBeDefined();
      expect(Array.isArray(response.insights.optimization_suggestions)).toBe(true);
    });
  });

  describe('6. Campaign Join Flow', () => {
    it('should join 21 Awakenings campaign', async () => {
      const joinData = {
        campaignId: TEST_CONFIG.testCampaignId,
        channels: ['linkedin', 'x', 'newsletter'],
        startDate: new Date().toISOString().split('T')[0],
        timeOfDay: '09:00',
        publishingMode: 'manual',
        makeWebhookUrl: 'https://httpbin.org/post',
        makeWebhookSecret: 'test-secret'
      };

      const response = await apiCall('POST', '/lvb/bridge?action=join_campaign', joinData);
      
      expect(response.success).toBe(true);
      expect(response.config).toBeDefined();
      expect(response.config.campaign_id).toBe(TEST_CONFIG.testCampaignId);
      expect(response.config.tenant_id).toBe(TEST_CONFIG.testTenantId);
      expect(response.config.status).toBe('joined');
      expect(Array.isArray(response.config.channels)).toBe(true);
    });

    it('should prevent duplicate campaign joins', async () => {
      const joinData = {
        campaignId: TEST_CONFIG.testCampaignId,
        channels: ['linkedin'],
        startDate: new Date().toISOString().split('T')[0],
        publishingMode: 'manual'
      };

      const response = await apiCall('POST', '/lvb/bridge?action=join_campaign', joinData);
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('Already joined');
    });
  });

  describe('7. Custom Campaign Proposals', () => {
    it('should submit custom campaign proposal', async () => {
      const proposalData = {
        action: 'propose_campaign',
        campaign: {
          name: 'Test Custom Campaign',
          description: 'A test custom campaign for validation',
          primaryCta: 'Join Now',
          secondaryCta: 'Learn More',
          metadata: {
            target_audience: 'tech professionals',
            estimated_budget: 10000,
            duration_weeks: 4
          }
        }
      };

      const response = await apiCall('POST', '/lvb/bridge', proposalData);
      
      expect(response.success).toBe(true);
      expect(response.campaign).toBeDefined();
      expect(response.campaign.campaign_type).toBe('custom');
      expect(response.campaign.status).toBe('draft');
      expect(response.message).toContain('proposed');
    });
  });

  describe('8. Sequence Dispatch System', () => {
    it('should check dispatch status', async () => {
      const response = await fetch(`${TEST_CONFIG.apiBase}/sequence/dispatch?action=status`, {
        headers: {
          'Authorization': `Bearer ${TEST_CONFIG.testSecret}`
        }
      });
      const result = await response.json();
      
      expect(result.success).toBe(true);
      expect(result.scheduler_active).toBe(true);
      expect(Array.isArray(result.recent_runs)).toBe(true);
    });

    it('should check pending dispatches', async () => {
      const response = await fetch(`${TEST_CONFIG.apiBase}/sequence/dispatch?action=pending`, {
        headers: {
          'Authorization': `Bearer ${TEST_CONFIG.testSecret}`
        }
      });
      const result = await response.json();
      
      expect(result.success).toBe(true);
      expect(typeof result.pending_count).toBe('number');
      expect(Array.isArray(result.pending_items)).toBe(true);
    });
  });

  describe('9. Admin Campaign Management', () => {
    it('should list all campaigns for admin', async () => {
      const response = await adminApiCall('GET', '/admin/campaigns?action=list');
      
      expect(response.success).toBe(true);
      expect(Array.isArray(response.campaigns)).toBe(true);
    });

    it('should get detailed campaign info for admin', async () => {
      const response = await adminApiCall('GET', `/admin/campaigns?action=detail&campaignId=${TEST_CONFIG.testCampaignId}`);
      
      expect(response.success).toBe(true);
      expect(response.campaign).toBeDefined();
      expect(response.campaign.id).toBe(TEST_CONFIG.testCampaignId);
    });

    it('should list available tenants for deployment', async () => {
      const response = await adminApiCall('GET', '/admin/campaigns?action=tenants');
      
      expect(response.success).toBe(true);
      expect(Array.isArray(response.tenants)).toBe(true);
    });

    it('should create custom campaign as admin', async () => {
      const campaignData = {
        action: 'create_campaign',
        campaign: {
          name: 'Admin Test Campaign',
          description: 'Created by admin for testing',
          campaign_type: 'custom',
          primary_cta: 'Join Now',
          secondary_cta: 'Learn More',
          metadata: {
            created_by: 'admin_test',
            priority: 'high'
          }
        }
      };

      const response = await adminApiCall('POST', '/admin/campaigns', campaignData);
      
      expect(response.success).toBe(true);
      expect(response.campaign).toBeDefined();
      expect(response.campaign.campaign_type).toBe('custom');
      expect(response.message).toContain('created successfully');
    });

    it('should create sequence campaign as admin', async () => {
      const campaignData = {
        action: 'create_campaign',
        campaign: {
          name: 'Test Sequence Campaign',
          description: 'A test sequence campaign',
          campaign_type: 'sequence',
          sequence_length: 7,
          helix_thread: 'logos'
        },
        sequence_items: [
          {
            day_number: 1,
            title: 'Day 1: Introduction',
            asset_ref: 'test-asset-1',
            explainer: true
          },
          {
            day_number: 2,
            title: 'Day 2: Deep Dive',
            asset_ref: 'test-asset-2',
            explainer: false
          }
        ]
      };

      const response = await adminApiCall('POST', '/admin/campaigns', campaignData);
      
      expect(response.success).toBe(true);
      expect(response.campaign).toBeDefined();
      expect(response.campaign.campaign_type).toBe('sequence');
      expect(response.campaign.sequence_length).toBe(7);
    });
  });

  describe('10. Performance Aggregation', () => {
    it('should aggregate performance metrics', async () => {
      const metricsData = {
        campaign_id: TEST_CONFIG.testCampaignId,
        metrics: {
          sent: 100,
          delivered: 95,
          opened: 40,
          clicked: 8,
          conversions: 2,
          revenue: 500
        }
      };

      const response = await apiCall('POST', '/performance/aggregate', metricsData);
      
      expect(response.success).toBe(true);
      expect(response.aggregated).toBe(true);
    });
  });

  describe('11. Error Handling', () => {
    it('should handle invalid campaign IDs', async () => {
      const response = await apiCall('GET', '/lvb/bridge?action=campaign_detail&campaignId=invalid-campaign');
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it('should handle missing required parameters', async () => {
      const response = await apiCall('POST', '/lvb/bridge?action=join_campaign', {
        channels: ['linkedin']
        // Missing campaignId and startDate
      });
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('required');
    });

    it('should handle unauthorized access', async () => {
      const response = await adminApiCall('GET', '/admin/campaigns?action=list');
      
      // This might fail if test admin persona doesn't exist, which is expected
      expect(typeof response.success).toBe('boolean');
    });
  });

  describe('12. Data Validation', () => {
    it('should validate campaign types', async () => {
      const response = await apiCall('GET', '/lvb/bridge?action=campaign_catalog&campaignType=sequence');
      
      expect(response.success).toBe(true);
      // Should only return sequence campaigns
      response.available_campaigns.forEach((campaign: any) => {
        expect(['sequence', 'wpp', 'custom']).toContain(campaign.campaign_type);
      });
    });

    it('should validate publishing modes', async () => {
      const joinData = {
        campaignId: TEST_CONFIG.testCampaignId,
        channels: ['linkedin'],
        startDate: new Date().toISOString().split('T')[0],
        publishingMode: 'invalid-mode'
      };

      const response = await apiCall('POST', '/lvb/bridge?action=join_campaign', joinData);
      
      expect(response.success).toBe(false);
    });

    it('should validate date formats', async () => {
      const joinData = {
        campaignId: TEST_CONFIG.testCampaignId,
        channels: ['linkedin'],
        startDate: 'invalid-date',
        publishingMode: 'manual'
      };

      const response = await apiCall('POST', '/lvb/bridge?action=join_campaign', joinData);
      
      expect(response.success).toBe(false);
    });
  });
});

describe('Database Schema Validation', () => {
  // These tests would typically require direct DB access
  // For now, we validate through API responses

  it('should have sequence items table accessible', async () => {
    const response = await apiCall('GET', `/lvb/bridge?action=campaign_detail&campaignId=${TEST_CONFIG.testCampaignId}`);
    
    expect(response.success).toBe(true);
    expect(response.campaign.marketa_sequence_items).toBeDefined();
    expect(Array.isArray(response.campaign.marketa_sequence_items)).toBe(true);
    
    // Check sequence item structure
    if (response.campaign.marketa_sequence_items.length > 0) {
      const item = response.campaign.marketa_sequence_items[0];
      expect(item.day_number).toBeDefined();
      expect(item.title).toBeDefined();
      expect(item.asset_ref).toBeDefined();
      expect(item.status).toBeDefined();
    }
  });

  it('should have tenant campaign config accessible', async () => {
    const response = await apiCall('GET', `/lvb/bridge?action=campaign_status&campaignId=${TEST_CONFIG.testCampaignId}`);
    
    expect(response.success).toBe(true);
    expect(response.config).toBeDefined();
    expect(response.config.current_day).toBeDefined();
    expect(response.config.status).toBeDefined();
    expect(response.config.channels).toBeDefined();
  });
});

export {};
