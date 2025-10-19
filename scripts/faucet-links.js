#!/usr/bin/env node

/**
 * Generate faucet links for all agents
 */

const agents = [
  { name: 'Aigent MoneyPenny', address: '0x8D286CcECf7B838172A45c26a11F019C4303E742' },
  { name: 'Aigent Nakamoto', address: '0x24BBB9C7aAcB33556D1429a3e1B33f05fAf7D4B9' },
  { name: 'Aigent Kn0w1', address: '0x875E825E0341b330065152ddaE37CBb843FC8D84' }
];

const faucets = [
  {
    name: 'Base Sepolia',
    url: 'https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet',
    note: 'Enter address manually'
  },
  {
    name: 'Ethereum Sepolia',
    url: 'https://sepoliafaucet.com/',
    note: 'Enter address manually'
  },
  {
    name: 'Arbitrum Sepolia', 
    url: 'https://faucet.arbitrum.io/',
    note: 'Enter address manually'
  },
  {
    name: 'Optimism Sepolia',
    url: 'https://faucet.optimism.io/',
    note: 'Enter address manually'
  },
  {
    name: 'Polygon Amoy',
    url: 'https://faucet.polygon.technology/',
    note: 'Enter address manually'
  }
];

console.log('🚰 FAUCET FUNDING GUIDE\n');
console.log('Copy and paste these addresses into the respective faucets:\n');

agents.forEach((agent, i) => {
  console.log(`${i + 1}. ${agent.name}: ${agent.address}`);
});

console.log('\n📋 FAUCET LINKS:\n');

faucets.forEach((faucet, i) => {
  console.log(`${i + 1}. ${faucet.name}: ${faucet.url}`);
});

console.log('\n🎯 FUNDING ORDER:');
console.log('1. Open each faucet link above');
console.log('2. For each agent address, request ETH from all 5 faucets');
console.log('3. Wait for transactions to confirm');
console.log('4. Verify balances using the commands below\n');

console.log('🔍 VERIFICATION COMMANDS:\n');
agents.forEach(agent => {
  const agentId = agent.name.toLowerCase().replace(' ', '-');
  console.log(`# ${agent.name}`);
  faucets.forEach(faucet => {
    const chainId = getChainId(faucet.name);
    console.log(`curl -s "http://localhost:3000/api/admin/debug/check-eth-balance?agentId=${agentId}&chainId=${chainId}"`);
  });
  console.log('');
});

function getChainId(faucetName) {
  switch (faucetName) {
    case 'Base Sepolia': return 84532;
    case 'Ethereum Sepolia': return 11155111;
    case 'Arbitrum Sepolia': return 421614;
    case 'Optimism Sepolia': return 11155420;
    case 'Polygon Amoy': return 80002;
    default: return 0;
  }
}
