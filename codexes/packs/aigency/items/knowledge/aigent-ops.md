# Knowledge — Aigent Operations Guide

Source: `docs/AIGENT_OPERATIONS_GUIDE.md`

Complete reference for agent operations, funding, troubleshooting, and emergency procedures.

---

## Critical Agent Information

### Primary Agents

**Aigent Z (Operations Lead)**
```
Agent ID: aigent-z
Wallet:   0x0e3a4FDbE83F7e206380E6C61CA016F2127FF844
Role:     Primary operational agent for cross-chain transactions
Chains:   Ethereum, Polygon, Arbitrum, Optimism, Base
Status:   Active
```

**Aigent MoneyPenny (Treasury)**
```
Agent ID: aigent-moneypenny
Role:     Treasury and financial operations
Status:   Active
```

**Aigent Kuroda (Trading)**
```
Agent ID: aigent-kuroda
Role:     Trading and market operations
Status:   Active
```

### Chain Configurations

| Chain | Chain ID | RPC Endpoint | Explorer |
|-------|----------|--------------|----------|
| Ethereum Sepolia | 11155111 | https://ethereum-sepolia-rpc.publicnode.com | https://sepolia.etherscan.io |
| Polygon Amoy | 80002 | https://rpc-amoy.polygon.technology | https://amoy.polygonscan.com |
| Arbitrum Sepolia | 421614 | https://sepolia-rollup.arbitrum.io/rpc | https://sepolia.arbiscan.io |
| Optimism Sepolia | 11155420 | https://sepolia.optimism.io | https://sepolia-optimism.etherscan.io |
| Base Sepolia | 84532 | https://sepolia.base.org | https://sepolia.basescan.org |

---

## System Architecture

### Agent Transaction Flow

```
User Request → Agent Selection → Balance Check → Transaction Execution → Confirmation
     ↓              ↓              ↓               ↓                    ↓
  Frontend    AgentKeyService   RPC Calls    Blockchain Tx        Database Log
```

### Critical Components

- **AgentKeyService**: Manages agent private keys and signing (`services/identity/agentKeyService.ts`)
- **A2A Transfer API**: Handles agent-to-agent transactions (`app/api/a2a/signer/transfer/route.ts`)
- **Supabase Database**: Stores agent configurations and transaction logs
- **QubeBase SDK**: Identity and reputation management
- **Ops Dashboard**: Real-time monitoring at `/ops`

---

## Daily Operations Checklist

**Morning Startup** (5 minutes):
1. Check Ops Gas Status card — all green?
2. Verify agent balances above thresholds
3. Check for any failed transactions overnight
4. Verify ICP canister cycles status

### Balance Thresholds

```
CRITICAL (Immediate Action):
- Ethereum/Base/Optimism: < 0.001 ETH
- Arbitrum: < 0.002 ETH
- Polygon: < 0.01 MATIC
- Q¢ Balance: < 100 Q¢

LOW (Action Within 1 Hour):
- Ethereum/Base/Optimism: < 0.003 ETH
- Arbitrum: < 0.005 ETH
- Polygon: < 0.05 MATIC
- Q¢ Balance: < 500 Q¢
```

---

## Agent Funding Procedures

### Emergency Funding (< 2 minutes)

```
1. Navigate to /admin/agents
2. Click "Fund Aigents" button
3. Monitor real-time status updates
4. Verify completion in Ops Gas Status card
5. Check transaction confirmations on explorers
```

### Balance Check API

```bash
# Check agent balance on specific chain
curl "http://localhost:3000/api/admin/debug/check-eth-balance?agentId=aigent-z&chainId=80002"

# Response:
{
  "agentId": "aigent-z",
  "chainId": 80002,
  "chainName": "Polygon Amoy",
  "walletAddress": "0x0e3a4FDbE83F7e206380E6C61CA016F2127FF844",
  "humanEthBalance": "29.930565482485120597",
  "hasGasForTx": true
}

# Check Q¢ operational currency
curl "http://localhost:3000/api/admin/debug/check-qct-balance?agentId=aigent-z"
```

---

## Troubleshooting

### A2A Transaction Failure Diagnosis

**Step 1: Quick Checks**
```bash
# Check sender balance
curl "http://localhost:3000/api/admin/debug/check-eth-balance?agentId=aigent-z&chainId=80002"
```

**Step 2: API Endpoint Testing**
```bash
curl -X POST "http://localhost:3000/api/a2a/signer/transfer" \
  -H "Content-Type: application/json" \
  -d '{
    "fromAgent": "aigent-z",
    "toAgent": "aigent-moneypenny",
    "amount": "0.001",
    "chainId": 80002
  }'

# Success: { "success": true, "txHash": "0x...", ... }
# Error: { "error": "Internal server error", "details": "..." }
```

**Step 3: Supabase Client Conflict Check**

Error patterns to look for:
```
❌ "Multiple Supabase clients initialized"
❌ "Service role key access denied"
❌ "Client initialization conflict"
❌ "Permission denied for agent operations"

Files to investigate:
- app/providers/AgentiQBootstrap.tsx
- services/identity/agentKeyService.ts
- app/api/_lib/supabaseServer.ts
```

**Step 4: Verify Environment Variables**
```bash
echo $SUPABASE_SERVICE_ROLE_KEY  # Should be set
echo $SUPABASE_URL               # Should be set
echo $AGENT_KEY_ENCRYPTION_SECRET  # Must be set for key decryption
```

---

## Known Issues

### Private Key Decryption (RESOLVED — Oct 2025)

Agent private keys are stored encrypted (`evm_private_key_encrypted` with AES-256-CBC). APIs must decrypt using `AGENT_KEY_ENCRYPTION_SECRET`.

**Decryption pattern**:
```typescript
function decrypt(encryptedText: string, encryptionKey: string): string {
  const [ivHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', Buffer.from(encryptionKey.slice(0, 32)), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

**Files fixed**: `app/api/a2a/signer/transfer/route.ts`, `app/api/admin/debug/check-eth-balance/route.ts`

### Supabase Client Architecture Conflict

Two patterns exist in the codebase:
- **AgentKeyService** (payment system): uses `createClient()` from `@supabase/supabase-js`
- **QubeBase SDK** (identity system): uses `initAgentiqClient()` from `@qriptoagentiq/core-client`

These can conflict when `AgentiQBootstrap.tsx` initializes the SDK globally. Solution: universal QubeBase SDK integration.

---

## Emergency Procedures

### A2A System Complete Failure

**Diagnosis order**:
1. Check `AGENT_KEY_ENCRYPTION_SECRET` is set in environment
2. Verify agent has sufficient gas on target chain
3. Check for Supabase client initialization conflicts

**Escalation path**:
```
Level 1: Balance/Network Issues (5 min fix)
├── Fund agents if needed
├── Switch RPC endpoints
└── Retry failed transactions

Level 2: API/Database Issues (30 min fix)
├── Restart services
├── Verify Supabase connectivity + RLS policies
└── Review recent deployments

Level 3: Architecture Issues (2+ hour fix)
└── Resolve Supabase client pattern conflicts
```

### ICP Canister Cycles Depletion

1. Check canister status in Ops Gas Status card (DVN | RQH columns)
2. Navigate to ICP management interface
3. Top up cycles for affected canister
4. Maintain minimum 5T cycles buffer

---

## Environment Variables

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...

NEXT_PUBLIC_RPC_ETHEREUM_SEPOLIA=https://ethereum-sepolia-rpc.publicnode.com
NEXT_PUBLIC_RPC_POLYGON_AMOY=https://rpc-amoy.polygon.technology
NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA=https://sepolia-rollup.arbitrum.io/rpc
NEXT_PUBLIC_RPC_OPTIMISM_SEPOLIA=https://sepolia.optimism.io
NEXT_PUBLIC_RPC_BASE_SEPOLIA=https://sepolia.base.org

AGENT_KEY_ENCRYPTION_SECRET=<32-char AES key>
DFX_IDENTITY_PEM=-----BEGIN EC PRIVATE KEY-----...
DVN_CANISTER_ID=sp5ye-2qaaa-aaaao-qkqla-cai
RQH_CANISTER_ID=zdjf3-2qaaa-aaaas-qck4q-cai
```

---

## Key File Locations

| Purpose | File |
|---------|------|
| Agent management UI | `app/admin/agents/page.tsx` |
| Fund Aigents button | `components/admin/FundAigentsButton.tsx` |
| Agent key management | `services/identity/agentKeyService.ts` |
| Ops Gas Status card | `components/ops/FundingStatusCard.tsx` |
| Balance API | `app/api/admin/debug/check-eth-balance/route.ts` |
| Q¢ balance API | `app/api/admin/debug/check-qct-balance/route.ts` |
| Canister cycles API | `app/api/admin/debug/check-canister-cycles/route.ts` |
| A2A transfer endpoint | `app/api/a2a/signer/transfer/route.ts` |
