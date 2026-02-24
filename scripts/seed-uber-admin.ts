/**
 * Seed Uber Admin Script
 * 
 * Creates the initial uber admin for dele@qripto
 * Run with: npx ts-node scripts/seed-uber-admin.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedUberAdmin() {
  const rootDid = 'did:root:dele@qripto';
  
  console.log(`Creating uber admin for: ${rootDid}`);
  
  // Check if already exists
  const { data: existing } = await supabase
    .from('crm_admin_roles')
    .select('*')
    .eq('kybe_did', rootDid)
    .eq('role_type', 'uber_admin')
    .single();
  
  if (existing) {
    console.log('Uber admin already exists:', existing.id);
    return existing;
  }
  
  // Create uber admin with full permissions
  const { data, error } = await supabase
    .from('crm_admin_roles')
    .insert({
      kybe_did: rootDid, // Using kybe_did field but storing Root DID per DiDQube policy
      role_type: 'uber_admin',
      permissions: {
        read: true,
        write: true,
        delete: true,
        manage_users: true,
        manage_admins: true,
        manage_settings: true,
        view_audit_logs: true,
        export_data: true,
        code_commit: true,
        pr_create: true,
        pr_review: true,
        deploy_staging: true,
        deploy_production: true,
      },
      is_active: true,
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating uber admin:', error);
    process.exit(1);
  }
  
  console.log('✅ Uber admin created successfully!');
  console.log('ID:', data.id);
  console.log('Root DID:', data.kybe_did);
  console.log('Role Type:', data.role_type);
  console.log('Permissions:', JSON.stringify(data.permissions, null, 2));
  
  return data;
}

seedUberAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed:', err);
    process.exit(1);
  });
