require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: '.env.local' });

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
    sepolia: {
      url: process.env.NEXT_PUBLIC_RPC_ETHEREUM_SEPOLIA || "",
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
