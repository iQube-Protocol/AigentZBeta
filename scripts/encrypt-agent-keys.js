/**
 * Encrypt Agent Keys for Database Storage
 * 
 * This script encrypts plain text private keys using the same AES-256-CBC
 * encryption that AgentKeyService uses, then outputs SQL UPDATE statements.
 * 
 * Run: node scripts/encrypt-agent-keys.js
 */

const crypto = require('crypto');

// Get encryption key from environment or use default (CHANGE IN PRODUCTION!)
const ENCRYPTION_KEY = process.env.AGENT_KEY_ENCRYPTION_SECRET || 'default-insecure-key-change-in-production-32bytes';

// Agent data (plain text keys)
const agents = [
  {
    agent_id: 'aigent-z',
    agent_name: 'Aigent Z',
    evm_private_key: '0x21a7c43349c06743bed56e47d2376335eb1c931b025279837cc9bf16c63cc233',
    evm_address: '0x0e3a4FDbE83F7e206380E6C61CA016F2127FF844'
  },
  {
    agent_id: 'aigent-moneypenny',
    agent_name: 'Aigent MoneyPenny',
    evm_private_key: '0xa7e4c2d8f9b3e6a1c5d8f2b9e6a3c7d0f4b8e1a5c9d2f6b0e3a7c4d8f1b5e9a2',
    evm_address: '0x8D286CcECf7B838172A45c26a11F019C4303E742'
  },
  {
    agent_id: 'aigent-nakamoto',
    agent_name: 'Aigent Nakamoto',
    evm_private_key: '0xb8f5d3e0a2c6f9b4e7a0d3f6c9b2e5a8d1f4c7b0e3a6d9f2c5b8e1a4d7f0c3b6',
    evm_address: '0x24BBB9C7aAcB33556D1429a3e1B33f05fAf7D4B9'
  },
  {
    agent_id: 'aigent-kn0w1',
    agent_name: 'Aigent Kn0w1',
    evm_private_key: '0xc9a6e4f1b3d7a0c4f7b0e3d6a9c2f5b8e1d4a7c0f3b6e9d2a5c8f1b4e7a0d3c6',
    evm_address: '0x875E825E0341b330065152ddaE37CBb843FC8D84'
  }
];

/**
 * Encrypt using AES-256-CBC (same as AgentKeyService)
 */
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32));
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

console.log('-- ========================================');
console.log('-- ENCRYPTED AGENT KEYS UPDATE SCRIPT');
console.log('-- Run this in Supabase SQL Editor');
console.log('-- Generated:', new Date().toISOString());
console.log('-- Encryption Key:', ENCRYPTION_KEY.slice(0, 10) + '...');
console.log('-- ========================================\n');

// Generate SQL UPDATE statements
agents.forEach(agent => {
  const encryptedKey = encrypt(agent.evm_private_key);
  
  console.log(`-- Update ${agent.agent_name}`);
  console.log(`UPDATE public.agent_keys SET`);
  console.log(`  evm_private_key_encrypted = '${encryptedKey}',`);
  console.log(`  updated_at = NOW()`);
  console.log(`WHERE agent_id = '${agent.agent_id}';`);
  console.log('');
});

console.log('-- Verification: Check that all keys are encrypted');
console.log(`SELECT agent_id, agent_name, evm_address,`);
console.log(`  CASE`);
console.log(`    WHEN evm_private_key_encrypted LIKE '%:%' THEN 'Encrypted'`);
console.log(`    ELSE 'Plain Text'`);
console.log(`  END as key_status,`);
console.log(`  LENGTH(evm_private_key_encrypted) as key_length`);
console.log(`FROM public.agent_keys`);
console.log(`ORDER BY agent_id;`);
console.log('\n-- ========================================');
console.log('-- IMPORTANT: Save this encryption key!');
console.log('-- AGENT_KEY_ENCRYPTION_SECRET=' + ENCRYPTION_KEY);
console.log('-- Add this to ALL environments (.env.local, Amplify, etc.)');
console.log('-- ========================================');
