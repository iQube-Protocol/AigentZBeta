/**
 * Register FIO Domains on Testnet
 * 
 * This script registers custom domains (@knyt, @aigent, @qripto) on FIO testnet
 * so users can create handles like alice@knyt, bob@aigent, etc.
 * 
 * Usage: npx tsx scripts/register-fio-domains.ts
 */

import { FIOSDK } from '@fioprotocol/fiosdk';
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// @ts-ignore
global.fetch = fetch;

const TESTNET_ENDPOINT = 'https://testnet.fioprotocol.io/v1/';
const TESTNET_CHAIN_ID = 'b20901380af44ef59c5918439a1f9a41d83669020319a80574b804a5f95cbd7e';

// System account (has FIO tokens)
const SYSTEM_PRIVATE_KEY = process.env.FIO_SYSTEM_PRIVATE_KEY!;
const SYSTEM_PUBLIC_KEY = process.env.FIO_SYSTEM_PUBLIC_KEY!;

// Domains to register
const DOMAINS = ['knyt', 'aigent', 'qripto'];

async function registerDomain(sdk: FIOSDK, domain: string): Promise<void> {
  console.log(`\n🔄 Registering domain: @${domain}`);
  
  try {
    // Check if domain is already registered
    console.log(`   Checking availability...`);
    const availResponse = await fetch(`${TESTNET_ENDPOINT}chain/avail_check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fio_name: domain })
    });
    
    const availData = await availResponse.json();
    
    if (availData.is_registered === 1) {
      console.log(`   ⚠️  Domain @${domain} is already registered`);
      return;
    }
    
    console.log(`   ✅ Domain available`);
    
    // Get registration fee
    console.log(`   Getting registration fee...`);
    // Use a default fee for domain registration (typically 800 FIO on testnet)
    const fee = 800000000000; // 800 FIO in SUFs
    console.log(`   Fee: ${fee / 1000000000} FIO`);
    
    // Register domain
    console.log(`   Registering on blockchain...`);
    // registerFioDomain(fioDomain: string, maxFee: number, technologyProviderId?: string)
    // Use dele@fiotestnet as TPID (Technology Provider ID)
    const result = await sdk.registerFioDomain(domain, fee, 'dele@fiotestnet');
    
    console.log(`   ✅ SUCCESS!`);
    console.log(`   Transaction ID: ${result.transaction_id}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Explorer: https://fio-test.bloks.io/transaction/${result.transaction_id}`);
    
  } catch (error: any) {
    console.error(`   ❌ ERROR: ${error.message}`);
    if (error.json) {
      console.error(`   Details:`, JSON.stringify(error.json, null, 2));
    }
    if (error.errorCode) {
      console.error(`   Error Code:`, error.errorCode);
    }
    if (error.list) {
      console.error(`   Error List:`, error.list);
    }
  }
}

async function main() {
  console.log('🚀 FIO Domain Registration Script');
  console.log('==================================\n');
  
  // Validate environment variables
  if (!SYSTEM_PRIVATE_KEY || !SYSTEM_PUBLIC_KEY) {
    console.error('❌ Missing FIO_SYSTEM_PRIVATE_KEY or FIO_SYSTEM_PUBLIC_KEY');
    console.error('   Add them to your .env.local file');
    process.exit(1);
  }
  
  console.log('📋 Configuration:');
  console.log(`   Endpoint: ${TESTNET_ENDPOINT}`);
  console.log(`   Chain ID: ${TESTNET_CHAIN_ID}`);
  console.log(`   Public Key: ${SYSTEM_PUBLIC_KEY.substring(0, 20)}...`);
  console.log(`   Domains: ${DOMAINS.map(d => '@' + d).join(', ')}`);
  
  // Check account balance
  console.log('\n💰 Checking account balance...');
  const balanceResponse = await fetch(`${TESTNET_ENDPOINT}chain/get_fio_balance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fio_public_key: SYSTEM_PUBLIC_KEY })
  });
  
  const balanceData = await balanceResponse.json();
  const balance = balanceData.balance / 1000000000;
  console.log(`   Balance: ${balance} FIO`);
  
  if (balance < 3000) {
    console.warn(`   ⚠️  Low balance! Domain registration costs ~800 FIO each`);
    console.warn(`   You need ~${DOMAINS.length * 800} FIO for all domains`);
    console.warn(`   Get testnet tokens: https://faucet.fioprotocol.io/?publickey=${SYSTEM_PUBLIC_KEY}`);
  }
  
  // Initialize SDK
  console.log('\n🔧 Initializing FIO SDK...');
  const sdk = new FIOSDK(
    SYSTEM_PRIVATE_KEY,
    SYSTEM_PUBLIC_KEY,
    TESTNET_ENDPOINT,
    fetch,
    undefined,
    TESTNET_CHAIN_ID
  );
  console.log('   ✅ SDK initialized');
  
  // Register each domain
  for (const domain of DOMAINS) {
    await registerDomain(sdk, domain);
    // Wait a bit between registrations
    if (DOMAINS.indexOf(domain) < DOMAINS.length - 1) {
      console.log('\n   ⏳ Waiting 3 seconds before next registration...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log('\n✅ Domain registration complete!');
  console.log('\n📋 Summary:');
  console.log(`   Attempted: ${DOMAINS.length} domains`);
  console.log(`   Domains: ${DOMAINS.map(d => '@' + d).join(', ')}`);
  console.log('\n🔍 Verify on explorer:');
  DOMAINS.forEach(d => {
    console.log(`   https://fio-test.bloks.io/account/${d}`);
  });
  
  console.log('\n💡 Next steps:');
  console.log('   1. Wait ~30 seconds for blockchain confirmation');
  console.log('   2. Update FIOHandleInput.tsx to include new domains');
  console.log('   3. Users can now register handles like alice@knyt');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
