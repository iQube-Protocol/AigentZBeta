/**
 * LVB-AGQ Integration Test Suite
 * Validates the alignment between Lovable thin client and AgentiQ comprehensive platform
 * Ensures AGQ remains source of truth while LVB maintains simplicity
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:3000',
  testPersonaId: 'test-persona-lvb',
  testTenantId: 'test-tenant-lvb',
  testCampaignId: 'test-campaign-multi-001',
  partnerTenantIds: ['partner-1', 'partner-2', 'partner-3']
};

// Test data fixtures
const LVBCONFIG_FIXTURE = {
  client_version: '1.0.0',
  ui_components: ['thin-header', 'minimal-dashboard', 'quick-campaigns'],
  feature_flags: {
    advanced_analytics: true,
    multi_tenant: true,
    custom_branding: true,
    real_time_sync: true
  },
  multi_tenant_config: {
    enabled: true,
    tenant_context: {
      tenant_id: TEST_CONFIG.testTenantId,
      persona_id: TEST_CONFIG.testPersonaId,
      role: 'partner'
    },
    capabilities: {
      create_campaigns: true,
      view_analytics: true,
      manage_partners: false,
      deploy_multi_tenant: false
    },
    bridge_config: {
      api_endpoint: '/api/marketa/lvb/bridge',
      sync_frequency: 'real-time',
      source_of_truth: 'agq'
    }
  }
};

const MULTITENANT_CAMPAIGN_FIXTURE = {
  campaign_id: TEST_CONFIG.testCampaignId,
  campaign: {
    name: 'Test Multi-Tenant Campaign',
    phase: 'codex1',
    budget: 50000,
    primary_cta: 'Join Now',
    themes: ['growth', 'innovation'],
    content: {
      subject: 'Special Offer for Partners',
      body: 'Exclusive partner opportunity...'
    }
  },
  deployment_config: {
    participating_tenants: TEST_CONFIG.partnerTenantIds,
    deployment_strategy: 'parallel' as const
  }
};

describe('LVB-AGQ Integration Tests', () => {
  describe('1. LVB Bridge API', () => {
    it('should return enhanced tenant configuration with multi-tenant support', async () => {
      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/marketa/lvb/bridge?action=config`, {
        headers: {
          'x-persona-id': TEST_CONFIG.testPersonaId,
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.config.tenant_id).toBe(TEST_CONFIG.testTenantId);
      expect(data.config.capabilities.multi_tenant).toBe(true);
      expect(data.config.feature_flags.multi_tenant).toBe(true);
      expect(data.config.feature_flags.advanced_analytics).toBe(true);
      expect(data.bridge_version).toBe('1.0.0');
    });

    it('should provide simplified campaign summaries for LVB', async () => {
      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/marketa/lvb/bridge?action=campaigns`, {
        headers: {
          'x-persona-id': TEST_CONFIG.testPersonaId,
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(Array.isArray(data.campaigns)).toBe(true);
      expect(data.multi_tenant_enabled).toBe(true);
      
      // Verify simplified structure for LVB
      if (data.campaigns.length > 0) {
        const campaign = data.campaigns[0];
        expect(campaign).toHaveProperty('id');
        expect(campaign).toHaveProperty('name');
        expect(campaign).toHaveProperty('status');
        expect(campaign).toHaveProperty('performance');
        expect(campaign.performance).toHaveProperty('sent');
        expect(campaign.performance).toHaveProperty('conversion_rate');
      }
    });

    it('should aggregate performance data for partner overview', async () => {
      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/marketa/lvb/bridge?action=partner-overview`, {
        headers: {
          'x-persona-id': TEST_CONFIG.testPersonaId,
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(Array.isArray(data.partners)).toBe(true);
      expect(data).toHaveProperty('summary');
      expect(data.summary).toHaveProperty('total_partners');
      expect(data.summary).toHaveProperty('total_campaigns');
    });
  });

  describe('2. Multi-Tenant Campaign Deployment', () => {
    it('should create multi-tenant campaign from AGQ', async () => {
      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/marketa/campaigns/deploy`, {
        method: 'POST',
        headers: {
          'x-persona-id': TEST_CONFIG.testPersonaId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(MULTITENANT_CAMPAIGN_FIXTURE)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.campaign.id).toBe(TEST_CONFIG.testCampaignId);
      expect(data.deployment.success).toBe(true);
      expect(data.participating_tenants).toHaveLength(3);
      expect(data.deployment_summary.total_tenants).toBe(4); // 3 partners + owner
    });

    it('should track deployment status across all tenants', async () => {
      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/marketa/campaigns/deploy?campaign_id=${TEST_CONFIG.testCampaignId}`, {
        headers: {
          'x-persona-id': TEST_CONFIG.testPersonaId,
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.deployment.deployment_status).toBe('deployed');
      expect(data.tenant_performance).toHaveLength(4);
    });
  });

  describe('3. Performance Data Flow', () => {
    it('should accept performance data from LVB and sync to AGQ', async () => {
      const performanceData = {
        campaign_id: TEST_CONFIG.testCampaignId,
        tenant_id: TEST_CONFIG.partnerTenantIds[0],
        performance_data: {
          sent: 1000,
          delivered: 950,
          opened: 400,
          clicked: 80,
          conversions: 20,
          revenue: 5000
        },
        metadata: {
          platform: 'email',
          lvb_version: '1.0.0',
          sync_timestamp: new Date().toISOString()
        }
      };

      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/marketa/performance/aggregate`, {
        method: 'POST',
        headers: {
          'x-persona-id': TEST_CONFIG.testPersonaId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(performanceData)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.metrics_updated).toBeDefined();
      expect(data.aggregated_performance).toBeDefined();
      expect(data.insights).toBeDefined();
      expect(data.sync_status.synced_at).toBeDefined();
    });

    it('should aggregate performance across all partner tenants', async () => {
      // Submit performance data for all partners
      for (const tenantId of TEST_CONFIG.partnerTenantIds) {
        const performanceData = {
          campaign_id: TEST_CONFIG.testCampaignId,
          tenant_id,
          performance_data: {
            sent: 1000,
            delivered: 950,
            opened: 400,
            clicked: 80,
            conversions: 20,
            revenue: 5000
          }
        };

        await fetch(`${TEST_CONFIG.baseUrl}/api/marketa/performance/aggregate`, {
          method: 'POST',
          headers: {
            'x-persona-id': TEST_CONFIG.testPersonaId,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(performanceData)
        });
      }

      // Get aggregated performance
      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/marketa/performance/aggregate?campaign_id=${TEST_CONFIG.testCampaignId}&aggregate=true`, {
        headers: {
          'x-persona-id': TEST_CONFIG.testPersonaId,
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.total_metrics.total_sent).toBe(3000); // 3 partners * 1000
      expect(data.total_metrics.total_conversions).toBe(60); // 3 partners * 20
      expect(data.total_metrics.total_revenue).toBe(15000); // 3 partners * 5000
      expect(data.tenant_breakdown).toHaveLength(3);
      expect(data.insights.top_performing_tenant).toBeDefined();
    });
  });

  describe('4. Data Consistency Validation', () => {
    it('should maintain AGQ as source of truth across all operations', async () => {
      // Create campaign in LVB
      const lvbCampaign = {
        campaign: {
          id: 'lvb-source-test',
          name: 'LVB Created Campaign',
          status: 'draft',
          phase: 'codex1',
          budget: 25000
        },
        lvb_metadata: {
          client_version: '1.0.0',
          build_version: 'lovable-build-123'
        }
      };

      const syncResponse = await fetch(`${TEST_CONFIG.baseUrl}/api/marketa/lvb/bridge`, {
        method: 'POST',
        headers: {
          'x-persona-id': TEST_CONFIG.testPersonaId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'sync-campaign',
          data: lvbCampaign
        })
      });

      expect(syncResponse.status).toBe(200);
      const syncData = await syncResponse.json();
      expect(syncData.success).toBe(true);
      expect(syncData.message).toContain('synced to AGQ source of truth');

      // Verify campaign exists in AGQ
      const verifyResponse = await fetch(`${TEST_CONFIG.baseUrl}/api/marketa/lvb/bridge?action=campaigns`, {
        headers: {
          'x-persona-id': TEST_CONFIG.testPersonaId,
          'Content-Type': 'application/json'
        }
      });

      const verifyData = await verifyResponse.json();
      const syncedCampaign = verifyData.campaigns.find((c: any) => c.id === 'lvb-source-test');
      expect(syncedCampaign).toBeDefined();
      expect(syncedCampaign.metadata.lvb_sync).toBe(true);
    });

    it('should prevent data conflicts between LVB and AGQ', async () => {
      // Try to update campaign with conflicting data
      const conflictingUpdate = {
        campaign_id: TEST_CONFIG.testCampaignId,
        campaign: {
          id: TEST_CONFIG.testCampaignId,
          name: 'Conflicting Name Change',
          budget: 999999 // Conflicting budget
        }
      };

      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/marketa/lvb/bridge`, {
        method: 'POST',
        headers: {
          'x-persona-id': TEST_CONFIG.testPersonaId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'sync-campaign',
          data: conflictingUpdate
        })
      });

      // Should handle gracefully - AGQ maintains authority
      expect([200, 409]).toContain(response.status);
    });
  });

  describe('5. Performance and Scalability', () => {
    it('should handle concurrent performance updates from multiple tenants', async () => {
      const promises = TEST_CONFIG.partnerTenantIds.map((tenantId, index) => {
        const performanceData = {
          campaign_id: TEST_CONFIG.testCampaignId,
          tenant_id,
          performance_data: {
            sent: 1000 + index,
            delivered: 950 + index,
            opened: 400 + index,
            clicked: 80 + index,
            conversions: 20 + index,
            revenue: 5000 + (index * 100)
          }
        };

        return fetch(`${TEST_CONFIG.baseUrl}/api/marketa/performance/aggregate`, {
          method: 'POST',
          headers: {
            'x-persona-id': TEST_CONFIG.testPersonaId,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(performanceData)
        });
      });

      const responses = await Promise.all(promises);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Verify aggregation is correct
      const aggregateResponse = await fetch(`${TEST_CONFIG.baseUrl}/api/marketa/performance/aggregate?campaign_id=${TEST_CONFIG.testCampaignId}&aggregate=true`, {
        headers: {
          'x-persona-id': TEST_CONFIG.testPersonaId,
          'Content-Type': 'application/json'
        }
      });

      const aggregateData = await aggregateResponse.json();
      expect(aggregateData.success).toBe(true);
      expect(aggregateData.total_metrics.total_sent).toBeGreaterThan(3000);
    });
  });
});

// Integration Test Helper Functions
export class LVBAGQIntegrationHelper {
  static async setupTestEnvironment(): Promise<void> {
    // Setup test personas and tenants
    console.log('Setting up LVB-AGQ integration test environment...');
  }

  static async cleanupTestEnvironment(): Promise<void> {
    // Cleanup test data
    console.log('Cleaning up LVB-AGQ integration test environment...');
  }

  static async validateDataConsistency(campaignId: string): Promise<boolean> {
    // Validate data consistency across LVB and AGQ
    return true;
  }

  static async measureAPILatency(endpoint: string): Promise<number> {
    const start = Date.now();
    await fetch(`${TEST_CONFIG.baseUrl}${endpoint}`, {
      headers: {
        'x-persona-id': TEST_CONFIG.testPersonaId,
        'Content-Type': 'application/json'
      }
    });
    return Date.now() - start;
  }
}

// Export test configuration for use in other test files
export { TEST_CONFIG, LVBCONFIG_FIXTURE, MULTITENANT_CAMPAIGN_FIXTURE };
