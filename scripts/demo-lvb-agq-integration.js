/**
 * LVB-AGQ Integration Demo
 * Creates test data and demonstrates the full integration workflow
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupDemoData() {
  console.log('🎬 Setting up LVB-AGQ Integration Demo...\n');

  try {
    // 1. Create demo tenant
    console.log('1. Creating demo tenant...');
    const { data: tenant, error: tenantError } = await supabase
      .from('crm_tenants')
      .upsert({
        id: 'demo-lvb-tenant',
        name: 'LVB Demo Partner',
        type: 'partner',
        settings: {
          theme: 'minimal',
          primary_color: '#3b82f6',
          custom_branding: true
        }
      })
      .select()
      .single();

    if (tenantError) throw tenantError;
    console.log('✅ Demo tenant created:', tenant.name);

    // 2. Create demo persona
    console.log('2. Creating demo persona...');
    const { data: persona, error: personaError } = await supabase
      .from('crm_personas')
      .upsert({
        tenant_id: 'demo-lvb-tenant',
        display_name: 'LVB Demo User',
        email: 'demo@lvb.com',
        external_user_id: 'lvb-demo-user',
        persona_state: 'pseudonymous'
      })
      .select()
      .single();

    if (personaError) throw personaError;
    console.log('✅ Demo persona created:', persona.display_name);

    // 3. Create demo campaign
    console.log('3. Creating demo campaign...');
    const { data: campaign, error: campaignError } = await supabase
      .from('marketa_campaigns')
      .insert({
        id: 'demo-lvb-campaign-001',
        tenant_id: 'demo-lvb-tenant',
        name: 'LVB Demo Campaign',
        status: 'active',
        phase: 'codex1',
        budget: 25000,
        primary_cta: 'Try LVB Now',
        themes: ['growth', 'innovation'],
        metadata: {
          demo: true,
          created_for: 'LVB-AGQ Integration Demo'
        }
      })
      .select()
      .single();

    if (campaignError) throw campaignError;
    console.log('✅ Demo campaign created:', campaign.name);

    // 4. Create multi-tenant deployment
    console.log('4. Creating multi-tenant deployment...');
    const { data: deployment, error: deploymentError } = await supabase
      .from('marketa_multi_tenant_campaigns')
      .insert({
        campaign_id: campaign.id,
        owner_tenant_id: 'demo-lvb-tenant',
        is_multi_tenant: true,
        tenant_count: 2,
        participating_tenants: ['demo-lvb-tenant', 'demo-agq-tenant'],
        deployment_status: 'deployed'
      })
      .select()
      .single();

    if (deploymentError) throw deploymentError;
    console.log('✅ Multi-tenant deployment created');

    // 5. Initialize performance metrics
    console.log('5. Initializing performance metrics...');
    const { error: metricsError } = await supabase
      .from('marketa_campaign_metrics')
      .insert({
        campaign_id: campaign.id,
        tenant_id: 'demo-lvb-tenant',
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        conversions: 0,
        revenue: 0
      });

    if (metricsError) throw metricsError;
    console.log('✅ Performance metrics initialized');

    // 6. Test LVB sync tracking
    console.log('6. Testing LVB sync tracking...');
    const { data: sync, error: syncError } = await supabase
      .from('marketa_lvb_sync_tracking')
      .insert({
        tenant_id: 'demo-lvb-tenant',
        sync_type: 'campaign',
        source_id: campaign.id,
        sync_direction: 'lvb_to_agq',
        data_payload: campaign,
        lvb_version: '1.0.0',
        sync_status: 'success'
      })
      .select()
      .single();

    if (syncError) throw syncError;
    console.log('✅ LVB sync tracking created');

    console.log('\n🎉 Demo setup complete!');
    console.log('========================');
    console.log('\n📋 Demo Data Created:');
    console.log(`• Tenant: ${tenant.name} (${tenant.id})`);
    console.log(`• Persona: ${persona.display_name} (${persona.id})`);
    console.log(`• Campaign: ${campaign.name} (${campaign.id})`);
    console.log(`• Deployment: Multi-tenant with ${deployment.tenant_count} tenants`);
    console.log('\n🧪 Test the integration with:');
    console.log(`curl -H "x-persona-id: ${persona.id}" \\`);
    console.log('     "http://localhost:3000/api/marketa/lvb/bridge?action=config"');
    console.log('\n🚀 LVB-AGQ Integration is ready for testing!');

  } catch (error) {
    console.error('❌ Demo setup failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check Supabase credentials in .env');
    console.log('2. Ensure database migration completed');
    console.log('3. Verify user has proper permissions');
  }
}

// Run the demo setup
setupDemoData();
