export type ChainConfig = {
  rpcUrl: string;
  aclAddress?: string; // ITokenQubeACL
  claimManagerAddress?: string; // IClaimManager
};

export type X402ExecConfig = {
  enabled: boolean; // global kill switch
  custodyEnabled: boolean;
  claimEnabled: boolean;
  chains: Record<string, ChainConfig>; // key by chain slug, e.g. 'polygon', 'arbitrum'
  treasuryPrivateKey?: string; // signer PK for exec
};

export function loadExecConfig(): X402ExecConfig {
  const enabled = [
    process.env.X402_EXEC_ENABLED,
    process.env.X402_EXECUTION_ENABLED
  ].some(v => (v || '').toLowerCase() === 'true');
  const custodyEnabled = [
    process.env.CUSTODY_ENABLED,
    process.env.X402_EXEC_CUSTODY_ENABLED
  ].some(v => (v || '').toLowerCase() === 'true');
  const claimEnabled = [
    process.env.CLAIM_ENABLED,
    process.env.X402_EXEC_CLAIM_ENABLED
  ].some(v => (v || '').toLowerCase() === 'true');
  const treasuryPrivateKey = process.env.TREASURY_PRIVATE_KEY || process.env.EVM_DEPLOYER_KEY;

  // Optional JSON blob for chain config
  // Example: {"polygon":{"rpcUrl":"https://...","aclAddress":"0x..."},"arbitrum":{"rpcUrl":"https://...","claimManagerAddress":"0x..."}}
  let chains: Record<string, ChainConfig> = {};
  try {
    const raw = process.env.X402_CHAIN_CONFIG_JSON;
    if (raw) chains = JSON.parse(raw);
  } catch {}

  // Also allow simple env overrides per common chains
  const ensure = (key: string, patch: Partial<ChainConfig>) => {
    const cur = chains[key] || {} as ChainConfig;
    chains[key] = { ...cur, ...patch } as ChainConfig;
  };
  if (process.env.POLYGON_RPC_URL) ensure('polygon', { rpcUrl: process.env.POLYGON_RPC_URL });
  if (process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY && !chains['polygon']?.rpcUrl) ensure('polygon', { rpcUrl: process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY });
  if (process.env.ARBITRUM_RPC_URL) ensure('arbitrum', { rpcUrl: process.env.ARBITRUM_RPC_URL });
  if (process.env.POLYGON_ACL_ADDRESS) ensure('polygon', { aclAddress: process.env.POLYGON_ACL_ADDRESS });
  if (process.env.ARBITRUM_ACL_ADDRESS) ensure('arbitrum', { aclAddress: process.env.ARBITRUM_ACL_ADDRESS });
  if (process.env.POLYGON_CLAIM_MANAGER_ADDRESS) ensure('polygon', { claimManagerAddress: process.env.POLYGON_CLAIM_MANAGER_ADDRESS });
  if (process.env.ARBITRUM_CLAIM_MANAGER_ADDRESS) ensure('arbitrum', { claimManagerAddress: process.env.ARBITRUM_CLAIM_MANAGER_ADDRESS });

  return { enabled, custodyEnabled, claimEnabled, chains, treasuryPrivateKey };
}
