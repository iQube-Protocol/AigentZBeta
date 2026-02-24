#!/usr/bin/env node

/**
 * Check if Marketa tables exist and run migrations if needed
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_DB_PASSWORD) {
  console.error('❌ Missing required environment variables:');
  console.error('   - SUPABASE_URL');
  console.error('   - SUPABASE_DB_PASSWORD');
  process.exit(1);
}

async function checkTableExists() {
  console.log('🔍 Checking if marketa_campaigns table exists...');
  
  try {
    const { execSync } = await import('node:child_process');
    
    // Use psql to check if table exists
    const checkQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'marketa' 
        AND table_name = 'marketa_campaigns'
      );
    `;
    
    const result = execSync(
      `psql "${SUPABASE_URL}" -c "${checkQuery}"`,
      { encoding: 'utf8', stdio: 'pipe' }
    );
    
    const exists = result.includes('t');
    
    if (exists) {
      console.log('✅ marketa_campaigns table exists');
      return true;
    } else {
      console.log('❌ marketa_campaigns table does not exist');
      return false;
    }
  } catch (error) {
    console.error('❌ Error checking table:', error.message);
    return false;
  }
}

async function runMigrations() {
  console.log('🚀 Running Marketa migrations...');
  
  try {
    const migrationFiles = [
      '20250116_marketa_qubetalk_integration.sql',
      '20250116_marketa_rbac_schema.sql',
      '20250116_marketa_rbac_test.sql',
      '20250117_marketa_partner_platform.sql',
      '20260116_marketa_agent_personas.sql',
      '20250117_asset_reference_functions.sql'
    ];
    
    for (const file of migrationFiles) {
      console.log(`📄 Running migration: ${file}`);
      
      const migrationPath = join(process.cwd(), 'supabase/migrations', file);
      const migrationSQL = readFileSync(migrationPath, 'utf8');
      
      execSync(
        `psql "${SUPABASE_URL}" -f "${migrationPath}"`,
        { encoding: 'utf8', stdio: 'inherit' }
      );
      
      console.log(`✅ Completed: ${file}`);
    }
    
    console.log('🎉 All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Error running migrations:', error.message);
    process.exit(1);
  }
}

async function main() {
  console.log('🔧 Marketa Database Setup');
  console.log('========================');
  
  const tableExists = await checkTableExists();
  
  if (!tableExists) {
    console.log('📋 Running database migrations...');
    await runMigrations();
    
    // Verify table was created
    const nowExists = await checkTableExists();
    if (nowExists) {
      console.log('🎉 Setup complete! You can now seed the 21 Awakenings campaign.');
    } else {
      console.error('❌ Setup failed - table still doesn\'t exist');
      process.exit(1);
    }
  } else {
    console.log('✅ Database is already set up and ready to use!');
  }
}

main().catch(console.error);
