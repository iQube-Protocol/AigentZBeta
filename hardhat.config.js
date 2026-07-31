require("@nomicfoundation/hardhat-toolbox");
const path = require("path");
const fs = require("fs");

// Load environment variables from .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    // Bumped from 0.8.20 → 0.8.27 because OpenZeppelin v5 internals
    // (ERC721, Strings, Bytes) added `pragma solidity ^0.8.24` AND
    // use the `mcopy` Cancun-era opcode (Solidity ≥0.8.25 with
    // evmVersion='cancun', which is the default at 0.8.25+). Base
    // mainnet is fully Cancun since the Dencun upgrade. Our contracts
    // pin `^0.8.20` which is forward-compatible.
    version: "0.8.27",
    settings: {
      // Hardhat's default evmVersion is 'paris' regardless of compiler
      // version. OpenZeppelin Bytes.sol uses the `mcopy` opcode which
      // only exists on Cancun-or-later EVMs. Base mainnet is fully
      // Cancun since the Dencun upgrade, so it's safe (and required)
      // to compile against it.
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 31337
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    },
    sepolia: {
      url: process.env.NEXT_PUBLIC_RPC_ETHEREUM_SEPOLIA || "https://rpc.sepolia.org",
      accounts: process.env.EVM_DEPLOYER_KEY ? [process.env.EVM_DEPLOYER_KEY] : [],
      chainId: 11155111
    },
    amoy: {
      url: process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY || "",
      accounts: process.env.EVM_DEPLOYER_KEY ? [process.env.EVM_DEPLOYER_KEY] : [],
      chainId: 80002
    },
    arbitrumSepolia: {
      url: process.env.NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA || "",
      accounts: process.env.EVM_DEPLOYER_KEY ? [process.env.EVM_DEPLOYER_KEY] : [],
      chainId: 421614
    },
    optimismSepolia: {
      url: process.env.NEXT_PUBLIC_RPC_OPTIMISM_SEPOLIA || "",
      accounts: process.env.EVM_DEPLOYER_KEY ? [process.env.EVM_DEPLOYER_KEY] : [],
      chainId: 11155420
    },
    baseSepolia: {
      url: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || "",
      accounts: process.env.EVM_DEPLOYER_KEY ? [process.env.EVM_DEPLOYER_KEY] : [],
      chainId: 84532
    },
    base: {
      url: process.env.NEXT_PUBLIC_RPC_BASE_MAINNET || "https://mainnet.base.org",
      accounts: process.env.EVM_DEPLOYER_KEY ? [process.env.EVM_DEPLOYER_KEY] : [],
      chainId: 8453
    }
  },
  // Etherscan v2 unified verification config.
  // As of May 31, 2025 Etherscan retired V1 chain-specific keys
  // (basescan.org, optimistic.etherscan.io, etc.). The V2 API uses
  // a single key from etherscan.io that auto-routes by chainId. We
  // accept ETHERSCAN_API_KEY first; BASESCAN_API_KEY is kept as a
  // fallback for operator inertia but should also be a V2-issued key.
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || process.env.BASESCAN_API_KEY || '',
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
