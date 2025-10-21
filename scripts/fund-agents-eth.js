#!/usr/bin/env node

/**
 * Fund all agents with ETH from testnet faucets
 */

const agents = [
  { name: 'Aigent MoneyPenny', address: '0x8D286CcECf7B838172A45c26a11F019C4303E742' },
  { name: 'Aigent Nakamoto', address: '0x24BBB9C7aAcB33556D1429a3e1B33f05fAf7D4B9' },
  { name: 'Aigent Kn0w1', address: '0x875E825E0341b330065152ddaE37CBb843FC8D84' }
];

const faucets = [
  {
    name: 'Base Sepolia',
    chainId: 84532,
    url: 'https://api.coinbase.com/v2/faucet',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    getBody: (address) => JSON.stringify({ address, network: 'base-sepolia' })
  },
  {
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    url: 'https://faucet.sepolia.dev/api/claim',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    getBody: (address) => JSON.stringify({ address })
  },
  {
    name: 'Arbitrum Sepolia',
    chainId: 421614,
    url: 'https://faucet.arbitrum.io/api/claim',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    getBody: (address) => JSON.stringify({ address, network: 'arbitrum-sepolia' })
  },
  {
    name: 'Optimism Sepolia',
    chainId: 11155420,
    url: 'https://faucet.optimism.io/api/claim',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    getBody: (address) => JSON.stringify({ address, network: 'optimism-sepolia' })
  },
  {
    name: 'Polygon Amoy',
    chainId: 80002,
    url: 'https://faucet.polygon.technology/api/claim',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    getBody: (address) => JSON.stringify({ address, network: 'amoy' })
  }
];

async function fundAgent(agent, faucet) {
  try {
    console.log(`🚰 Funding ${agent.name} on ${faucet.name}...`);
    
    const response = await fetch(faucet.url, {
      method: faucet.method,
      headers: faucet.headers,
      body: faucet.getBody(agent.address)
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ ${agent.name} funded on ${faucet.name}:`, result.txHash || result.hash || 'Success');
      return { success: true, result };
    } else {
      const error = await response.text();
      console.log(`❌ ${agent.name} funding failed on ${faucet.name}:`, response.status, error);
      return { success: false, error: `${response.status}: ${error}` };
    }
  } catch (error) {
    console.log(`❌ ${agent.name} funding error on ${faucet.name}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function fundAllAgents() {
  console.log('🎯 Starting ETH funding for all agents...\n');
  
  const results = [];
  
  for (const agent of agents) {
    console.log(`\n💰 Funding ${agent.name} (${agent.address}):`);
    
    for (const faucet of faucets) {
      const result = await fundAgent(agent, faucet);
      results.push({
        agent: agent.name,
        faucet: faucet.name,
        ...result
      });
      
      // Wait 2 seconds between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n📊 Summary:');
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed requests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.agent} on ${r.faucet}: ${r.error}`);
    });
  }
  
  console.log('\n🔍 You can verify balances by running:');
  agents.forEach(agent => {
    console.log(`curl -s "http://localhost:3000/api/admin/debug/check-eth-balance?agentId=${agent.name.toLowerCase().replace(' ', '-')}&chainId=84532"`);
  });
}

// Run the funding
fundAllAgents().catch(console.error);
