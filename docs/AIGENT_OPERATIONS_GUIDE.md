# 🤖 Aigent Operations Guide - Complete Troubleshooting & Management

## 📋 Table of Contents
1. [Critical Agent Information](#critical-agent-information)
2. [System Architecture Overview](#system-architecture-overview)
3. [Major Issues & Solutions](#major-issues--solutions)
4. [Operational Procedures](#operational-procedures)
5. [Troubleshooting Workflows](#troubleshooting-workflows)
6. [Monitoring & Alerting](#monitoring--alerting)
7. [Emergency Procedures](#emergency-procedures)

---

## 🔑 Critical Agent Information

### Agent Roster — Two Layers

#### Layer 1: AI Orchestration Aigents (canonical alpha set)

These Aigents hold charters in `.claude/agents/` and govern intelligence, routing, and experience.

| Aigent | ID | Cartridge | Role |
|--------|----|-----------|------|
| Aigent Z | `aigent-z` | AgentiQ | Platform governance, orchestration, routing |
| Aigent C | `aigent-c` | AgentiQ OS | Builder onboarding, contribution guidance |
| Kn0w1 | `kn0w1` | KNYT | In-world guide, $KNYT economy |
| Marketa | `marketa` | Cross-cutting | Activation, launch, growth |
| metaMe Guardian | `metame-guardian` | metaMe | Sovereignty, policy veto, progression |

#### Layer 2: Infrastructure Wallet Agents (EVM ops)

**Aigent Z (EVM Operations)**
```
Agent ID: aigent-z
Wallet: 0x0e3a4FDbE83F7e206380E6C61CA016F2127FF844
Role: Primary operational agent for cross-chain transactions
Chains: Ethereum, Polygon, Arbitrum, Optimism, Base
Status: Active - Primary funding and operations
```

**Aigent MoneyPenny (Treasury)**
```
Agent ID: aigent-moneypenny
Role: Treasury and financial operations
Chains: Multi-chain treasury management
Status: Active - Financial operations
```

> **Aigent Kuroda** (formerly listed as Trading) — no active implementation or wallet record.
> Legacy placeholder only. Do not reference or route to this agent.

### Chain Configurations

| Chain | Chain ID | RPC Endpoint | Explorer |
|-------|----------|--------------|----------|
| Ethereum Sepolia | 11155111 | https://ethereum-sepolia-rpc.publicnode.com | https://sepolia.etherscan.io |
| Polygon Amoy | 80002 | https://rpc-amoy.polygon.technology | https://amoy.polygonscan.com |
| Arbitrum Sepolia | 421614 | https://sepolia-rollup.arbitrum.io/rpc | https://sepolia.arbiscan.io |
| Optimism Sepolia | 11155420 | https://sepolia.optimism.io | https://sepolia-optimism.etherscan.io |
| Base Sepolia | 84532 | https://sepolia.base.org | https://sepolia.basescan.org |

---

## 🏗️ System Architecture Overview

### Agent Transaction Flow
```
User Request → Agent Selection → Balance Check → Transaction Execution → Confirmation
     ↓              ↓              ↓               ↓                    ↓
  Frontend    AgentKeyService   RPC Calls    Blockchain Tx        Database Log
```

### Critical Components
- **AgentKeyService**: Manages agent private keys and signing
- **A2A Transfer API**: Handles agent-to-agent transactions
- **Supabase Database**: Stores agent configurations and transaction logs
- **QubeBase SDK**: Identity and reputation management
- **Ops Dashboard**: Real-time monitoring and management

---

## 🚨 Major Issues & Solutions

### Issue #1: Production Private Key Decryption Crisis (RESOLVED - October 19, 2025)

**Severity**: 🔴 CRITICAL - All production agent operations broken

**Symptoms**:
- A2A transfers returning 500 errors: "transfer failed: 500"
- Balance checking APIs showing "Error" status for all chains
- Ops Gas Status card completely broken (all chains showing "Error")
- Agent wallet drawer transactions non-functional
- EVM end-to-end tests failing

**Root Cause**: Private Key Encryption/Decryption Mismatch
```
Database Reality vs API Expectations:
├── Database Storage: evm_private_key_encrypted (AES-256-CBC encrypted)
├── API Expectation: evm_private_key (plain text)
├── Missing Component: Decryption logic in production APIs
└── Environment: AGENT_KEY_ENCRYPTION_SECRET required but not used
```

**Critical APIs Affected**:
```
🔴 BROKEN:
- /api/a2a/signer/transfer (A2A transfers - 500 errors)
- /api/admin/debug/check-eth-balance (Balance checking - Error status)
- All agent operations requiring private key access

⚠️ IMPACT:
- Ops Gas Status card showing "Error" for all chains
- Agent-to-agent transactions completely broken
- Fund Signer operations failing
- Cross-chain operations non-functional
```

**Solution Implemented**: Direct Supabase Client with Decryption
```typescript
// Critical decryption function added to production APIs
function decrypt(encryptedText: string, encryptionKey: string): string {
  const [ivHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', Buffer.from(encryptionKey.slice(0, 32)), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Key retrieval with proper decryption
const { data: agentKeys, error } = await supabase
  .from('agent_keys')
  .select('*')
  .eq('agent_id', agentId)
  .single();

if (agentKeys?.evm_private_key_encrypted && encryptionKey) {
  privateKey = decrypt(agentKeys.evm_private_key_encrypted, encryptionKey);
}
```

**Files Fixed**:
- `app/api/a2a/signer/transfer/route.ts` - Added decryption for A2A transfers
- `app/api/admin/debug/check-eth-balance/route.ts` - Added decryption for balance checking

**Resolution Status**: ✅ RESOLVED - Commit `ac1608d` deployed to production

### Issue #2: A2A Payment System Complete Failure

**Severity**: 🔴 CRITICAL - All agent transactions broken

**Symptoms**:
- All A2A payments return 500 errors
- Agent Wallet Drawer non-functional
- Fund Signer operations failing
- A2A Test Card completely broken

**Root Cause**: Supabase Client Architecture Conflict
```
Conflict between two patterns:
├── Pattern 1: AgentKeyService (Payment System)
│   ├── Uses: createClient() from @supabase/supabase-js
│   ├── Expects: SUPABASE_SERVICE_ROLE_KEY access
│   └── Status: BROKEN due to conflicts
└── Pattern 2: QubeBase SDK (Identity System)
    ├── Uses: initAgentiqClient() from @qriptoagentiq/core-client
    ├── Uses: Different env var resolution
    └── Status: WORKING but conflicts with Pattern 1
```

**Critical Files Affected**:
```
🔴 BROKEN:
- services/identity/agentKeyService.ts (payment system)
- app/api/a2a/signer/transfer/route.ts (A2A endpoint)

⚠️ CONFLICT SOURCE:
- app/providers/AgentiQBootstrap.tsx (global SDK init)
- app/api/_lib/supabaseServer.ts (new pattern)

✅ WORKING:
- services/identity/personaService.ts (identity system)
```

**Solution Required**: Universal QubeBase SDK Integration
- Implement unified client pattern
- Support multi-tenant scenarios
- Handle both service role and anon key access
- Maintain backward compatibility

### Issue #2: Agent Funding Visibility Crisis

**Severity**: 🟡 HIGH - Operational risk

**Problems**:
- No centralized funding status visibility
- Manual balance checking across 5 chains per agent
- No proactive low-balance alerts
- Risk of service interruptions

**Solutions Implemented**:

#### A. Fund Aigents Button
```
Location: /admin/agents
Features:
├── One-click funding for all agents
├── Batch operations across all chains
├── Real-time status feedback
├── Error handling and retry logic
└── Success/failure notifications

Implementation:
- components/admin/FundAigentsButton.tsx
- Integrated with existing agent management
- Uses secure funding workflows
```

#### B. Ops Gas Status Card
```
Location: /ops dashboard (position #3)
Features:
├── Real-time balance monitoring
├── Collapsible design (default collapsed)
├── RAG status indicators (Red/Amber/Green)
├── Auto-refresh every 2 minutes
├── Manual refresh capability
├── Q¢ operational currency tracking
└── ICP canister cycles monitoring

Layout:
Row 1: BASE | OPT | ARB | MATIC
Row 2: ETH  | BTC | SOL | Q¢
Canisters: DVN | RQH
```

---

## 🔧 Operational Procedures

### Daily Operations Checklist

**Morning Startup** (5 minutes):
1. ✅ Check Ops Gas Status card - all green?
2. ✅ Verify agent balances above thresholds
3. ✅ Check for any failed transactions overnight
4. ✅ Verify ICP canister cycles status

**Critical Thresholds**:
```
🔴 CRITICAL (Immediate Action Required):
- Ethereum/Base/Optimism: < 0.001 ETH
- Arbitrum: < 0.002 ETH  
- Polygon: < 0.01 MATIC
- Q¢ Balance: < 100 Q¢

🟡 LOW (Action Needed Soon):
- Ethereum/Base/Optimism: < 0.003 ETH
- Arbitrum: < 0.005 ETH
- Polygon: < 0.05 MATIC  
- Q¢ Balance: < 500 Q¢
```

### Agent Funding Procedures

#### Emergency Funding (< 2 minutes):
```bash
1. Navigate to /admin/agents
2. Click "Fund Aigents" button
3. Monitor real-time status updates
4. Verify completion in Ops Gas Status card
5. Check transaction confirmations on explorers
```

#### Manual Chain-Specific Funding:
```bash
# Check specific agent balance
curl "http://localhost:3000/api/admin/debug/check-eth-balance?agentId=aigent-z&chainId=80002"

# Response format:
{
  "agentId": "aigent-z",
  "chainId": 80002,
  "chainName": "Polygon Amoy", 
  "walletAddress": "0x0e3a4FDbE83F7e206380E6C61CA016F2127FF844",
  "humanEthBalance": "29.930565482485120597",
  "hasGasForTx": true
}
```

#### Q¢ Balance Monitoring:
```bash
# Check Q¢ operational currency
curl "http://localhost:3000/api/admin/debug/check-qct-balance?agentId=aigent-z"

# Response format:
{
  "agentId": "aigent-z",
  "totalQct": "1250",
  "breakdown": {
    "ethereum": "500",
    "polygon": "300",
    "arbitrum": "200", 
    "optimism": "150",
    "base": "100"
  }
}
```

---

## 🔍 Troubleshooting Workflows

### A2A Transaction Failure Diagnosis

**Step 1: Quick Checks** (30 seconds)
```bash
# Check sender balance
curl "http://localhost:3000/api/admin/debug/check-eth-balance?agentId=aigent-z&chainId=80002"

# Verify Ops Gas Status card shows green/yellow (not red)
# Check if recipient agent exists in system
```

**Step 2: API Endpoint Testing** (1 minute)
```bash
# Test A2A transfer endpoint directly
curl -X POST "http://localhost:3000/api/a2a/signer/transfer" \
  -H "Content-Type: application/json" \
  -d '{
    "fromAgent": "aigent-z",
    "toAgent": "aigent-moneypenny", 
    "amount": "0.001",
    "chainId": 80002
  }'

# Expected success response:
{
  "success": true,
  "txHash": "0x...",
  "fromAgent": "aigent-z",
  "toAgent": "aigent-moneypenny"
}

# Error response indicates system issue:
{
  "error": "Internal server error",
  "details": "Supabase client conflict"
}
```

**Step 3: Supabase Client Conflict Check** (2 minutes)
```bash
# Check if AgentiQBootstrap is causing conflicts
# Look for these error patterns in logs:

❌ "Multiple Supabase clients initialized"
❌ "Service role key access denied" 
❌ "Client initialization conflict"
❌ "Permission denied for agent operations"

# Files to investigate:
- app/providers/AgentiQBootstrap.tsx
- services/identity/agentKeyService.ts
- app/api/_lib/supabaseServer.ts
```

**Step 4: Database Verification** (1 minute)
```bash
# Verify environment variables
echo $SUPABASE_SERVICE_ROLE_KEY  # Should be set
echo $SUPABASE_URL              # Should be set
echo $SUPABASE_ANON_KEY         # Should be set

# Test direct database connection
# Navigate to Supabase dashboard
# Check agent_keys table accessibility
# Verify RLS policies for service role
```

### Network Connectivity Issues

**Chain RPC Failures**:
```bash
# Test each chain RPC endpoint
curl -X POST https://rpc-amoy.polygon.technology \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Expected response:
{"jsonrpc":"2.0","id":1,"result":"0x..."}

# If timeout or error, switch to backup RPC
```

**Explorer API Issues**:
```bash
# Verify transaction confirmation
# Check explorer links in Ops Gas Status card
# Use alternative explorers if primary fails
```

---

## 📊 Monitoring & Alerting

### Current Monitoring Setup

**Ops Gas Status Card**:
- **Location**: `/ops` dashboard (card #3)
- **Refresh**: Auto every 2 minutes + manual
- **Status**: RAG indicators for immediate assessment
- **Coverage**: All agents, all chains, Q¢, ICP cycles

**API Endpoints for Monitoring**:
```bash
# Agent balances
GET /api/admin/debug/check-eth-balance?agentId={id}&chainId={chain}

# Q¢ operational currency  
GET /api/admin/debug/check-qct-balance?agentId={id}

# ICP canister cycles
GET /api/admin/debug/check-canister-cycles?canisterId={id}
```

### Recommended Alerting (Future Implementation)

**Critical Alerts** (Immediate Response):
- Agent balance drops below critical threshold
- A2A transaction failure rate > 10%
- ICP canister cycles < 1T remaining
- RPC endpoint failures > 3 consecutive

**Warning Alerts** (Action Within 1 Hour):
- Agent balance in low range
- Q¢ balance declining trend
- Network latency increasing
- Failed transaction retry needed

**Info Alerts** (Daily Review):
- Daily funding summary
- Transaction volume reports
- Agent utilization statistics
- System health overview

---

## 🚨 Emergency Procedures

### Critical Balance Emergency

**Scenario**: Agent balance drops to critical level during active operations

**Immediate Actions** (< 60 seconds):
1. 🚨 Navigate to `/admin/agents`
2. 🚨 Click "Fund Aigents" button immediately
3. 🚨 Monitor funding progress in real-time
4. 🚨 Verify completion via Ops Gas Status card
5. 🚨 Check transaction confirmations on explorers

**Follow-up Actions** (< 5 minutes):
1. ✅ Verify all agents above low thresholds
2. ✅ Check for any failed transactions during low balance period
3. ✅ Review what caused rapid balance depletion
4. ✅ Adjust monitoring thresholds if needed

### A2A System Complete Failure

**Scenario**: All agent-to-agent transactions failing

**Immediate Diagnosis** (< 2 minutes):
1. 🔍 **Check Private Key Decryption First** (Most Common Issue):
   - Verify `AGENT_KEY_ENCRYPTION_SECRET` is set in environment
   - Check if private keys are encrypted in database (`evm_private_key_encrypted` field)
   - Test decryption logic with actual encrypted data
   - Ensure APIs use direct Supabase client with decryption

2. 🔍 **Check Agent Balances**:
   - Verify sender has sufficient gas
   - Verify recipient wallet exists
   - Check network connectivity

3. 🔍 **Verify Supabase Client Conflicts**:
   - Check if AgentiQBootstrap is interfering
   - Verify AgentKeyService has proper service role access
   - Look for concurrent client initialization

4. 🔍 **API Endpoint Testing**:
   - Test A2A transfer endpoint directly

**Escalation Path**:
```
Level 1: Balance/Network Issues (5 min fix)
├── Fund agents if needed
├── Switch RPC endpoints
└── Retry failed transactions

Level 2: API/Database Issues (30 min fix)  
├── Restart services
├── Check Supabase connectivity
├── Verify database permissions
└── Review recent deployments

Level 3: Architecture Issues (2+ hour fix)
├── Implement universal QubeBase SDK
├── Resolve client pattern conflicts  
├── Update all affected services
└── Full system testing required
```

### ICP Canister Cycles Depletion

**Scenario**: DVN or RQH canister running low on cycles

**Immediate Actions**:
1. 🚨 Check canister status via Ops Gas Status card
2. 🚨 Navigate to ICP management interface
3. 🚨 Top up cycles for affected canister
4. 🚨 Verify canister functionality restored

**Prevention**:
- Monitor cycles via Ops Gas Status card
- Set up automated cycles top-up (future)
- Maintain minimum 5T cycles buffer

---

## 📝 Environment Configuration

### Required Environment Variables

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Chain RPC Endpoints  
NEXT_PUBLIC_RPC_ETHEREUM_SEPOLIA=https://ethereum-sepolia-rpc.publicnode.com
NEXT_PUBLIC_RPC_POLYGON_AMOY=https://rpc-amoy.polygon.technology
NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA=https://sepolia-rollup.arbitrum.io/rpc
NEXT_PUBLIC_RPC_OPTIMISM_SEPOLIA=https://sepolia.optimism.io
NEXT_PUBLIC_RPC_BASE_SEPOLIA=https://sepolia.base.org

# ICP Configuration
DFX_IDENTITY_PEM=-----BEGIN EC PRIVATE KEY-----...
DVN_CANISTER_ID=sp5ye-2qaaa-aaaao-qkqla-cai
RQH_CANISTER_ID=zdjf3-2qaaa-aaaas-qck4q-cai

# QubeBase SDK
NEXT_PUBLIC_QUBEBASE_URL=https://your-qubebase-instance.com
QUBEBASE_SERVICE_KEY=your-service-key
```

### Critical File Locations

**Agent Management**:
```
app/admin/agents/page.tsx              # Agent management UI
components/admin/FundAigentsButton.tsx # Funding operations
services/identity/agentKeyService.ts   # Agent key management (CRITICAL)
```

**Monitoring & Operations**:
```
components/ops/FundingStatusCard.tsx           # Ops Gas Status card
app/api/admin/debug/check-eth-balance/route.ts # Balance checking API
app/api/admin/debug/check-qct-balance/route.ts # Q¢ balance API
app/api/admin/debug/check-canister-cycles/route.ts # Cycles API
```

**A2A Transaction System**:
```
app/api/a2a/signer/transfer/route.ts   # A2A transfer endpoint (BROKEN)
services/identity/personaService.ts    # Identity management
app/providers/AgentiQBootstrap.tsx     # Global SDK init (CONFLICT)
app/api/_lib/supabaseServer.ts         # New client pattern
```

---

## 📞 Support & Escalation

### Internal Escalation
1. **Level 1**: Operations team (balance/funding issues)
2. **Level 2**: Development team (API/database issues)  
3. **Level 3**: Architecture team (system design issues)

### External Dependencies
- **Supabase**: Database and authentication
- **Chain RPCs**: Blockchain connectivity
- **ICP Network**: Canister hosting
- **QubeBase SDK**: Identity management

### Documentation Updates
- Update this guide when new issues discovered
- Document all resolution procedures
- Maintain agent key inventory
- Track system architecture changes

---

**Last Updated**: October 18, 2025  
**Version**: 1.0  
**Status**: ✅ Monitoring Operational | ⚠️ A2A System Requires Fix
