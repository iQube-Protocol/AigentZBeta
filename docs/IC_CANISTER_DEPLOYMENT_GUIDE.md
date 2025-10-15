# IC Canister Deployment Guide - DiDQube Canisters

This guide explains how to deploy the 4 DiDQube canisters (Escrow, RQH, FBC, DBC) to the Internet Computer mainnet using GitHub Actions CI/CD.

---

## 📋 Overview

**Canisters to Deploy**:
1. **Escrow** - Alias registration, mailbox relay, cohort compute
2. **RQH** (ReputationQube Hub) - Reputation bucket proofs
3. **FBC** (Flag Bulletin Canister) - Cohort flags
4. **DBC** (Dispute Board Canister) - Dispute resolution

**Deployment Method**: GitHub Actions workflow  
**Target Network**: IC Mainnet  
**Workflow File**: `.github/workflows/deploy-ic-canisters.yml`

---

## 🔑 Prerequisites

### **1. GitHub Secrets**

Add the following secret to your GitHub repository:

**Secret Name**: `DFX_IDENTITY_PEM`  
**Value**: Your dfx identity PEM file content

```bash
# Generate or export your dfx identity
dfx identity export staging > identity.pem

# Copy the content (including BEGIN/END lines)
cat identity.pem

# Add to GitHub:
# Settings → Secrets and variables → Actions → New repository secret
# Name: DFX_IDENTITY_PEM
# Value: <paste PEM content>
```

### **2. Canister Source Code**

**Note**: The current implementation assumes canister source code exists. You have two options:

#### **Option A: Use Placeholder Canisters (Quick Start)**

Create minimal Rust canisters for initial deployment:

```bash
# Create canister directories
mkdir -p src/{escrow,rqh,fbc,dbc}

# For each canister, create minimal Candid interface and Rust code
# Example for escrow:
cat > src/escrow/escrow.did << 'EOF'
service : {
  register_alias: (blob, blob, nat64) -> ();
  relay_message: (text, blob) -> ();
  compute_cohort: (text) -> (vec text) query;
  purge_expired: () -> (nat64);
}
EOF

cat > src/escrow/src/lib.rs << 'EOF'
#[ic_cdk::update]
fn register_alias(_commitment: Vec<u8>, _mailbox: Vec<u8>, _ttl: u64) {
    // Placeholder implementation
}

#[ic_cdk::update]
fn relay_message(_mailbox_id: String, _message: Vec<u8>) {
    // Placeholder implementation
}

#[ic_cdk::query]
fn compute_cohort(_partition_id: String) -> Vec<String> {
    vec![] // Placeholder
}

#[ic_cdk::update]
fn purge_expired() -> u64 {
    0 // Placeholder
}
EOF

# Repeat for rqh, fbc, dbc with their respective interfaces
```

#### **Option B: Full Implementation**

Implement complete canister logic based on IDL definitions in `services/ops/idl/`.

---

## 🚀 Deployment Methods

### **Method 1: GitHub Actions (Recommended)**

#### **Step 1: Trigger Workflow**

1. Navigate to GitHub repository
2. Go to **Actions** tab
3. Select **Deploy IC Canisters** workflow
4. Click **Run workflow**
5. Select options:
   - **Environment**: `staging` or `production`
   - **Canisters**: `all` or specific (e.g., `escrow,rqh`)
6. Click **Run workflow**

#### **Step 2: Monitor Deployment**

- Watch workflow progress in Actions tab
- Check deployment summary when complete
- Verify canister IDs in output

#### **Step 3: Capture Canister IDs**

Workflow will automatically:
- Deploy canisters to IC mainnet
- Capture assigned canister IDs
- Update `canister_ids.json` in repo
- Commit changes back to branch

---

### **Method 2: Manual Deployment (Local)**

If you prefer to deploy manually from your local machine:

#### **Prerequisites**

```bash
# Install dfx
DFX_VERSION=0.29.1
sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)"

# Verify installation
dfx --version

# Setup identity
dfx identity use staging  # or create new: dfx identity new staging
dfx identity get-principal
```

#### **Deploy Canisters**

```bash
# Navigate to project root
cd /Users/hal1/CascadeProjects/AigentZBeta

# Create dfx.json (if not exists)
cat > dfx.json << 'EOF'
{
  "version": 1,
  "canisters": {
    "escrow": {
      "type": "rust",
      "candid": "src/escrow/escrow.did",
      "package": "escrow"
    },
    "rqh": {
      "type": "rust",
      "candid": "src/rqh/rqh.did",
      "package": "rqh"
    },
    "fbc": {
      "type": "rust",
      "candid": "src/fbc/fbc.did",
      "package": "fbc"
    },
    "dbc": {
      "type": "rust",
      "candid": "src/dbc/dbc.did",
      "package": "dbc"
    }
  },
  "networks": {
    "ic": {
      "providers": ["https://icp-api.io"],
      "type": "persistent"
    }
  }
}
EOF

# Deploy all canisters
dfx deploy --network ic

# Or deploy individually
dfx deploy escrow --network ic
dfx deploy rqh --network ic
dfx deploy fbc --network ic
dfx deploy dbc --network ic

# Get canister IDs
dfx canister id escrow --network ic
dfx canister id rqh --network ic
dfx canister id fbc --network ic
dfx canister id dbc --network ic
```

---

## 📝 Post-Deployment Configuration

### **Step 1: Update canister_ids.json**

After deployment, create or update `canister_ids.json`:

```json
{
  "escrow": {
    "ic": "xxxxx-xxxxx-xxxxx-xxxxx-cai"
  },
  "rqh": {
    "ic": "xxxxx-xxxxx-xxxxx-xxxxx-cai"
  },
  "fbc": {
    "ic": "xxxxx-xxxxx-xxxxx-xxxxx-cai"
  },
  "dbc": {
    "ic": "xxxxx-xxxxx-xxxxx-xxxxx-cai"
  }
}
```

### **Step 2: Set Environment Variables**

#### **Local Development** (`.env.local`)

```bash
# DiDQube ICP Canisters
ESCROW_CANISTER_ID=xxxxx-xxxxx-xxxxx-xxxxx-cai
RQH_CANISTER_ID=xxxxx-xxxxx-xxxxx-xxxxx-cai
FBC_CANISTER_ID=xxxxx-xxxxx-xxxxx-xxxxx-cai
DBC_CANISTER_ID=xxxxx-xxxxx-xxxxx-xxxxx-cai

# Or use NEXT_PUBLIC_ prefix for client-side access
NEXT_PUBLIC_ESCROW_CANISTER_ID=xxxxx-xxxxx-xxxxx-xxxxx-cai
NEXT_PUBLIC_RQH_CANISTER_ID=xxxxx-xxxxx-xxxxx-xxxxx-cai
NEXT_PUBLIC_FBC_CANISTER_ID=xxxxx-xxxxx-xxxxx-xxxxx-cai
NEXT_PUBLIC_DBC_CANISTER_ID=xxxxx-xxxxx-xxxxx-xxxxx-cai
```

#### **Production/Staging** (AWS Amplify/Vercel)

Add the same variables to your deployment platform:

**AWS Amplify**:
1. Go to App Settings → Environment variables
2. Add each canister ID variable
3. Redeploy app

**Vercel**:
1. Go to Project Settings → Environment Variables
2. Add each canister ID variable
3. Redeploy app

---

## ✅ Verification

### **Step 1: Test Canister Connectivity**

```bash
# Test escrow canister
dfx canister call escrow compute_cohort '("test-partition")' --network ic

# Test rqh canister
dfx canister call rqh present_bucket '(blob "test-partition-id")' --network ic

# Test fbc canister
dfx canister call fbc get_flags '("test-partition")' --network ic --query

# Test dbc canister
dfx canister call dbc get_dispute_status '("test-ticket-id")' --network ic --query
```

### **Step 2: Test via AigentZBeta API**

```bash
# Test reputation bucket API
curl "http://localhost:3000/api/identity/reputation/bucket?partitionId=test-partition-id"

# Test cohort alias registration
curl -X POST http://localhost:3000/api/identity/cohort/register-alias \
  -H "Content-Type: application/json" \
  -d '{
    "aliasCommitment": "0123456789abcdef",
    "mailboxId": "fedcba9876543210",
    "ttl": 86400
  }'

# Test dispute submission
curl -X POST http://localhost:3000/api/identity/disputes \
  -H "Content-Type: application/json" \
  -d '{
    "flagId": "flag-123",
    "evidencePtr": "ipfs://Qm..."
  }'
```

### **Step 3: Verify in Ops Console**

1. Navigate to `http://localhost:3000/ops`
2. Find **DiDQube Reputation** card
3. Enter a test partition ID
4. Click **Check**
5. Verify response from RQH canister

---

## 🔄 Canister Management

### **Upgrade Canisters**

```bash
# Build new wasm
dfx build escrow

# Upgrade canister
dfx canister install escrow --mode upgrade --network ic

# Or use deploy (auto-detects upgrade)
dfx deploy escrow --network ic
```

### **Check Canister Status**

```bash
# Get canister info
dfx canister status escrow --network ic

# Check cycles balance
dfx canister status escrow --network ic | grep "Balance"
```

### **Top Up Cycles**

```bash
# Top up canister with cycles
dfx canister deposit-cycles 1000000000000 escrow --network ic
```

---

## 🚨 Troubleshooting

### **Issue: "Canister not found"**

**Cause**: Canister not deployed or wrong canister ID

**Solution**:
```bash
# Verify canister exists
dfx canister id escrow --network ic

# Redeploy if needed
dfx deploy escrow --network ic
```

### **Issue: "Insufficient cycles"**

**Cause**: Canister out of cycles

**Solution**:
```bash
# Check balance
dfx canister status escrow --network ic

# Top up
dfx canister deposit-cycles 1000000000000 escrow --network ic
```

### **Issue: "Authentication failed"**

**Cause**: Wrong identity or missing permissions

**Solution**:
```bash
# Verify identity
dfx identity whoami
dfx identity get-principal

# Use correct identity
dfx identity use staging
```

### **Issue: API routes return "Canister not configured"**

**Cause**: Environment variables not set

**Solution**:
1. Verify `.env.local` has canister IDs
2. Restart dev server: `npm run dev`
3. Check API route logs for errors

---

## 📊 Deployment Checklist

- [ ] GitHub secret `DFX_IDENTITY_PEM` configured
- [ ] Canister source code exists in `src/` directories
- [ ] `dfx.json` created with canister definitions
- [ ] Workflow triggered and completed successfully
- [ ] Canister IDs captured from deployment
- [ ] `canister_ids.json` updated in repo
- [ ] Environment variables set in `.env.local`
- [ ] Environment variables set in production (Amplify/Vercel)
- [ ] Canister connectivity tested via dfx
- [ ] API routes tested and returning data
- [ ] Ops Console cards displaying canister data
- [ ] Cycles balance checked and topped up if needed

---

## 📚 Related Documentation

- **DiDQube Phase 1 Summary**: `docs/DIDQUBE_PHASE1_SUMMARY.md`
- **QubeBase Migration Guide**: `docs/QUBEBASE_MIGRATION_GUIDE.md`
- **Canister IDLs**: `services/ops/idl/{escrow,rqh,fbc,dbc}.ts`
- **GitHub Workflow**: `.github/workflows/deploy-ic-canisters.yml`

---

## 🆘 Support

If you encounter issues:
1. Check GitHub Actions logs for deployment errors
2. Verify dfx identity and permissions
3. Test canisters directly with `dfx canister call`
4. Check API route logs for connection errors
5. Verify environment variables are set correctly
6. Reach out to team for assistance

---

**Workflow**: `.github/workflows/deploy-ic-canisters.yml`  
**Status**: Ready to deploy  
**Next Step**: Trigger workflow or deploy manually
