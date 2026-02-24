# DVN Canister Configuration for AWS Amplify

## 🚨 CRITICAL: Updated DVN Canister ID Required

The DVN (cross_chain_service) canister has been **redeployed** with a new ID. AWS Amplify environment variables must be updated.

## 📋 Required Environment Variables for AWS Amplify

### **NEW DVN Canister (LIVE MAINNET)**
```bash
# Cross Chain Service (DVN) - NEW DEPLOYMENT
CROSS_CHAIN_SERVICE_CANISTER_ID=sp5ye-2qaaa-aaaao-qkqla-cai
NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID=sp5ye-2qaaa-aaaao-qkqla-cai
```

### **Other ICP Canisters (LIVE MAINNET)**
```bash
# Proof of State - LIVE MAINNET
PROOF_OF_STATE_CANISTER_ID=n2hhv-aaaaa-aaaas-qccza-cai
NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID=n2hhv-aaaaa-aaaas-qccza-cai

# Bitcoin Signer - LIVE MAINNET
BTC_SIGNER_CANISTER_ID=uxrrr-q7777-77774-qaaaq-cai
NEXT_PUBLIC_BTC_SIGNER_CANISTER_ID=uxrrr-q7777-77774-qaaaq-cai

# EVM RPC - LIVE MAINNET
EVM_RPC_CANISTER_ID=uzt4z-lp777-77774-qaabq-cai
NEXT_PUBLIC_EVM_RPC_CANISTER_ID=uzt4z-lp777-77774-qaabq-cai
```

### **ICP Network Configuration**
```bash
# ICP Network Configuration
DFX_NETWORK=ic
ICP_HOST=https://ic0.app
NEXT_PUBLIC_ICP_HOST=https://ic0.app
```

## 🔧 AWS Amplify Setup Instructions

1. **Go to AWS Amplify Console** → Your App → **Environment variables**
2. **Update/Add these variables** with the values above
3. **Redeploy** the application
4. **Test DVN functionality** at `/ops` page

## ✅ Expected Results After Update

Once the environment variables are updated:

- **DVN Status API**: `/api/ops/dvn/status` should return live data
- **Ops Console**: DVN cards should show real canister data
- **LayerZero Processing**: Should work with live canister
- **Cross-Chain Operations**: Should connect to deployed canister

## 🚨 Why This Is Critical

**Old Issue**: DVN calls were failing because the canister ID was missing or incorrect
**New Solution**: Updated canister ID `sp5ye-2qaaa-aaaao-qkqla-cai` is live and operational

**Verification URL**: https://a4gq6-oaaaa-aaaab-qaa4q-cai.raw.icp0.io/?id=sp5ye-2qaaa-aaaao-qkqla-cai

## 🔍 Testing DVN Functionality

After updating environment variables, test these endpoints:

1. **DVN Status**: `https://staging-beta.aigent-z.me/api/ops/dvn/status`
2. **Ops Console**: `https://staging-beta.aigent-z.me/ops`
3. **DVN Health**: Check the DVN card shows live data

**The DVN will not work correctly until these environment variables are updated in AWS Amplify!**
