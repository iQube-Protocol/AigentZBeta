// Skeleton BTC adapter for remote custody flows
// This abstracts Bitcoin-specific mechanics (e.g., PSBT, Taproot policy anchors)

export type BtcCustodyPlan = {
  network: 'mainnet'|'testnet'|'signet'|'regtest';
  custodianKeyRef?: string; // KMS ref or xprv ref
  recipient?: string;       // optional btc address for reference
  meta?: Record<string, any>;
};

export type BtcExecResult = { ok: boolean; executed: boolean; txId?: string; psbtBase64?: string; reason?: string; plan?: any };

export function loadBtcConfig() {
  const enabled = (process.env.BTC_CUSTODY_ENABLED || 'false').toLowerCase() === 'true';
  const network = (process.env.BTC_NETWORK || 'testnet') as 'mainnet'|'testnet'|'signet'|'regtest';
  const custodianKeyRef = process.env.BTC_CUSTODIAN_KEY_REF; // do not expose private key
  return { enabled, network, custodianKeyRef };
}

export async function planBtcCustody(_input: { iqubeRef: string; limits?: any; ttlSec?: number }): Promise<BtcExecResult> {
  const cfg = loadBtcConfig();
  if (!cfg.enabled) return { ok: true, executed: false, reason: 'btc custody disabled', plan: { network: cfg.network } };
  // For now, return a PSBT placeholder plan
  return { ok: true, executed: false, plan: { network: cfg.network, note: 'BTC custody PSBT plan placeholder' } };
}
