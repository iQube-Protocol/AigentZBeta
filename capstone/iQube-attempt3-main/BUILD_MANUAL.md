# iQube Protocol - Comprehensive Build Manual

## Project Overview
The iQube Protocol is a complex web3 application utilizing React, Typescript, and blockchain technologies with support for multiple wallet integrations.

## Prerequisites
- Node.js (v18.x or later recommended)
- npm (v9.x or later)
- Yarn (optional but recommended)
- Git
- Metamask Browser Extension
- Thirdweb Wallet

## Wallet Integration Pathways
### 1. Metamask Wallet Integration
- **Dependencies**: 
  - `ethers.js`
  - `@metamask/providers`
  - Custom MetaMask connection utilities

### 2. Thirdweb Wallet Integration
- **Dependencies**:
  - `@thirdweb-dev/react`
  - `@thirdweb-dev/sdk`
  - Thirdweb Provider configuration

## Environment Setup

### 1. Clone the Repository
```bash
git clone https://github.com/your-org/iQube-Protocol.git
cd iQube-Protocol/Front_Endv2
```

### 2. Install Dependencies
```bash
# Using npm
npm install

# Or using Yarn
yarn install
```

### 3. Environment Variables
Create a `.env` file in the project root with the following keys:
```
VITE_PINATA_API_KEY=your_pinata_api_key
VITE_PINATA_SECRET_KEY=your_pinata_secret_key
VITE_ENCRYPTION_SERVER_URL=https://your-encryption-server.com
VITE_POLYGON_CONTRACT_ADDRESS=your_polygon_contract_address
VITE_THIRDWEB_CLIENT_ID=your_thirdweb_client_id
VITE_METAMASK_PROJECT_ID=your_metamask_project_id
```

## Key Dependencies

### Frontend
- React (v18.x)
- Vite
- Typescript
- Tailwind CSS
- Axios
- Ethers.js
- Thirdweb SDK

### Blockchain Interactions
- Web3.js
- Ethers.js
- Polygon Network SDK
- IPFS (Pinata) Integration

### Encryption
- Custom encryption server
- Crypto-JS
- Web Crypto API

### State Management
- React Hooks
- Context API

## Wallet Connection Strategies

### Metamask Connection
1. Install MetaMask browser extension
2. Use `window.ethereum` provider
3. Implement chain switching
4. Handle account changes

### Thirdweb Connection
1. Wrap app with ThirdwebProvider
2. Use `useConnect()` hook
3. Support multiple wallet connections
4. Implement network switching

## Restoration Checklist After Catastrophic Crash

### 1. Reinstall Operating System
- Ensure latest security updates
- Install development tools (Xcode for macOS)

### 2. Reinstall Development Environment
```bash
# Install Node.js (use NVM recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
nvm install 18
nvm use 18

# Install Yarn
npm install -g yarn

# Install global development tools
npm install -g vite typescript
```

### 3. Recover Project
```bash
# Clone repository
git clone [REPOSITORY_URL]
cd iQube-Protocol/Front_Endv2

# Install dependencies
yarn install

# Restore environment variables from secure backup
# IMPORTANT: Never commit .env files to version control

# Verify Thirdweb and MetaMask API keys
# Regenerate if necessary
```

### 4. Blockchain Wallet Restoration
- Recover MetaMask seed phrase
- Restore Thirdweb wallet configurations
- Verify contract addresses
- Check network connectivity

## Troubleshooting

### Common Issues
1. Wallet Connection Failures
   - Check network settings
   - Verify API keys
   - Ensure correct chain/network

2. Build Errors
   - Clear npm/yarn cache
   - Remove node_modules
   - Reinstall dependencies

3. Encryption Server Issues
   - Verify server connectivity
   - Check encryption key rotation

## Security Recommendations
- Use hardware wallets for significant transactions
- Enable two-factor authentication
- Regularly update dependencies
- Implement comprehensive error logging
- Use environment-specific configurations

## Performance Monitoring
- Use React DevTools
- Implement Sentry or similar error tracking
- Monitor blockchain transaction times
- Profile React component rendering

## Deployment Checklist
- Run comprehensive test suite
- Build production version
- Deploy to staging environment
- Perform end-to-end testing
- Deploy to production

## Backup Strategy
- Daily git repository backups
- Encrypted cloud storage for sensitive configs
- Offsite backup of critical infrastructure details

## Contact & Support
**Technical Support**: support@iqube-protocol.com
**Blockchain Specialist**: blockchain@iqube-protocol.com

---

**Last Updated**: 2024-12-17
**Version**: 1.0.0
