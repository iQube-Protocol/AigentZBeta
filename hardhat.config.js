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
    version: "0.8.20",
    settings: {
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
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
