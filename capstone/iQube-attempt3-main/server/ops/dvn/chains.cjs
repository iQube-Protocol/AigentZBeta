const CHAIN_CONFIGS = {
  0: {
    chainId: 0,
    name: "Bitcoin",
    family: "bitcoin",
  },
  101: {
    chainId: 101,
    name: "Solana",
    family: "solana",
  },
  11155111: {
    chainId: 11155111,
    name: "Ethereum Sepolia",
    family: "evm",
    defaultRpcUrl: process.env.DVN_RPC_11155111 || "https://rpc.sepolia.org",
  },
  421614: {
    chainId: 421614,
    name: "Arbitrum Sepolia",
    family: "evm",
    defaultRpcUrl: process.env.DVN_RPC_421614 || "",
  },
  84532: {
    chainId: 84532,
    name: "Base Sepolia",
    family: "evm",
    defaultRpcUrl: process.env.DVN_RPC_84532 || "https://sepolia.base.org",
  },
  11155420: {
    chainId: 11155420,
    name: "Optimism Sepolia",
    family: "evm",
    defaultRpcUrl: process.env.DVN_RPC_11155420 || "",
  },
  80002: {
    chainId: 80002,
    name: "Polygon Amoy",
    family: "evm",
    defaultRpcUrl: process.env.DVN_RPC_80002 || "https://rpc-amoy.polygon.technology",
  },
};

function getChainConfig(chainId) {
  return CHAIN_CONFIGS[chainId] || null;
}

function getDefaultRpc(chainId) {
  const chain = getChainConfig(chainId);
  return chain?.defaultRpcUrl || "";
}

function getChainName(chainId) {
  const chain = getChainConfig(chainId);
  return chain?.name || `Chain ${chainId}`;
}

function isSupportedChain(chainId) {
  return Boolean(CHAIN_CONFIGS[chainId]);
}

const SUPPORTED_CHAIN_IDS = Object.keys(CHAIN_CONFIGS)
  .map((id) => Number(id))
  .sort((a, b) => a - b);

module.exports = {
  CHAIN_CONFIGS,
  getChainConfig,
  getDefaultRpc,
  getChainName,
  isSupportedChain,
  SUPPORTED_CHAIN_IDS,
};
