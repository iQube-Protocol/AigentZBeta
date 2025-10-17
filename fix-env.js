#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read both files
const backupPath = '.env.local.backup';
const currentPath = '.env.local';

console.log('🔧 Fixing .env.local automatically...');

try {
  const backup = fs.readFileSync(backupPath, 'utf8');
  const current = fs.readFileSync(currentPath, 'utf8');

  // Parse backup into key-value pairs
  const backupVars = {};
  backup.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key) backupVars[key.trim()] = valueParts.join('=');
    }
  });

  // Parse current file, removing duplicates and placeholders
  const cleanedLines = [];
  const seenKeys = new Set();
  
  current.split('\n').forEach(line => {
    const trimmed = line.trim();
    
    // Skip empty lines and comments at the start
    if (!trimmed || trimmed.startsWith('#')) {
      cleanedLines.push(line);
      return;
    }
    
    const [key] = line.split('=');
    if (!key) return;
    
    const cleanKey = key.trim();
    
    // Skip if we've seen this key already
    if (seenKeys.has(cleanKey)) {
      console.log(`  ❌ Removing duplicate: ${cleanKey}`);
      return;
    }
    
    // Skip placeholder values
    if (line.includes('YOUR_') || line.includes('your_') || line.includes('_KEY_HERE')) {
      console.log(`  ❌ Removing placeholder: ${cleanKey}`);
      return;
    }
    
    seenKeys.add(cleanKey);
    cleanedLines.push(line);
  });

  // Add missing critical vars from backup
  const criticalVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY', 
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DEV_USER_ID'
  ];

  criticalVars.forEach(key => {
    if (!seenKeys.has(key) && backupVars[key]) {
      console.log(`  ✅ Adding back: ${key}`);
      cleanedLines.push(`${key}=${backupVars[key]}`);
    }
  });

  // Write the cleaned file
  const cleaned = cleanedLines.join('\n');
  
  // Backup current messy version first
  fs.writeFileSync('.env.local.messy', current);
  console.log('  💾 Backed up messy version to .env.local.messy');
  
  // Write cleaned version
  fs.writeFileSync('.env.local', cleaned);
  console.log('  ✨ Created clean .env.local');
  
  console.log('\n🎉 Done! Your .env.local is now clean.');
  console.log('   - Removed duplicates and placeholders');
  console.log('   - Added back critical Supabase config');
  console.log('   - Kept all your recent A2A/ICP work');
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
