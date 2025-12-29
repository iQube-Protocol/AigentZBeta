import { AbiCoder, JsonRpcProvider, Wallet, keccak256, toUtf8Bytes, zeroPadValue, isHexString } from 'ethers';
import { tokenQubeACLAt } from '../contracts/ITokenQubeACL';
import { claimManagerAt } from '../contracts/IClaimManager';
import { loadExecConfig } from './config';

export type ExecResult = { ok: boolean; executed: boolean; txHash?: string; reason?: string; plan?: any };

function parseIqubeRef(ref: string): { chain: string | null; contract: string | null; tokenId: string | null } {
  try {
    // iq:<chain>/<contract>/<tokenId>
    const after = ref.split(':')[1] || '';
    const [chain, contract, tokenId] = after.split('/');
    return { chain: chain || null, contract: contract || null, tokenId: tokenId || null };
  } catch { return { chain: null, contract: null, tokenId: null }; }
}

function hashScope(scope: string[]): string {
  const canon = [...(scope || [])].map(s => s.trim()).sort();
  return keccak256(toUtf8Bytes(canon.join('\n')));
}

function encodeLimits(limits?: { rpm?: number; tokens_per_day?: number }): string {
  const coder = new AbiCoder();
  const rpm = limits?.rpm ?? 0;
  const tpd = limits?.tokens_per_day ?? 0;
  return coder.encode(['uint32','uint64'], [rpm, tpd]);
}

export async function executeCustodyGrant(input: {
  iqubeRef: string;
  recipientAddress?: string; // if available
  scope: string[];
  ttlSec?: number;
  limits?: { rpm?: number; tokens_per_day?: number };
  dvnAttestation?: string; // hex
  messageSig?: string;     // hex
}): Promise<ExecResult> {
  const cfg = loadExecConfig();
  if (!cfg.enabled || !cfg.custodyEnabled) return { ok: true, executed: false, reason: 'custody exec disabled' };

  const ref = parseIqubeRef(input.iqubeRef);
  if (!ref.chain) return { ok: false, executed: false, reason: 'missing chain in iqube_ref' };
  const chainCfg = cfg.chains[ref.chain];
  if (!chainCfg?.rpcUrl || !chainCfg.aclAddress) return { ok: true, executed: false, reason: 'rpc or aclAddress not configured', plan: { chain: ref.chain, scopeHash: hashScope(input.scope) } };
  if (!cfg.treasuryPrivateKey) return { ok: true, executed: false, reason: 'missing signer key', plan: { chain: ref.chain } };

  // Prepare plan
  const plan = {
    tokenId: ref.tokenId,
    to: input.recipientAddress,
    scopeHash: hashScope(input.scope),
    ttl: input.ttlSec ?? 0,
    limits: encodeLimits(input.limits),
    dvnAttestation: input.dvnAttestation || '0x',
    msgSig: input.messageSig || '0x',
  };

  try {
    const provider = new JsonRpcProvider(chainCfg.rpcUrl);
    const signer = new Wallet(cfg.treasuryPrivateKey!, provider);
    const acl = tokenQubeACLAt(chainCfg.aclAddress!, signer);
    const tx = await acl.grantCapability(plan.tokenId, plan.to, plan.scopeHash, plan.ttl, plan.limits, plan.dvnAttestation, plan.msgSig);
    const receipt = await tx.wait();
    return { ok: true, executed: true, txHash: receipt?.hash };
  } catch (e: any) {
    return { ok: false, executed: false, reason: e?.message || 'custody exec error', plan };
  }
}

export async function executeClaimRedeem(input: {
  claimId: string;
  toAddress?: string;
  amountWei: string;
  toChain: string;
  dvnAttestation?: string;
}): Promise<ExecResult> {
  const cfg = loadExecConfig();
  if (!cfg.enabled || !cfg.claimEnabled) return { ok: true, executed: false, reason: 'claim exec disabled' };

  const chainCfg = cfg.chains[input.toChain];
  if (!chainCfg?.rpcUrl || !chainCfg.claimManagerAddress) return { ok: true, executed: false, reason: 'rpc or claimManagerAddress not configured', plan: { chain: input.toChain } };
  if (!cfg.treasuryPrivateKey) return { ok: true, executed: false, reason: 'missing signer key', plan: { chain: input.toChain } };

  // Normalize claimId to bytes32
  const toBytes32 = (v: string): string => {
    if (!v) return '0x' + '00'.repeat(32);
    if (isHexString(v)) {
      const hex = v as `0x${string}`;
      const len = (hex.length - 2) / 2;
      if (len === 32) return hex;
      return zeroPadValue(hex, 32);
    }
    // UUID -> strip dashes, treat as hex if valid length else hash
    const noDash = v.replace(/-/g, '');
    if (/^[0-9a-fA-F]+$/.test(noDash) && noDash.length <= 64) {
      const padded = noDash.padStart(64, '0');
      return '0x' + padded.toLowerCase();
    }
    return keccak256(toUtf8Bytes(v));
  };

  const normalizedClaimId = toBytes32(input.claimId);
  const normalizedAttestation = input.dvnAttestation && input.dvnAttestation !== '0x'
    ? toBytes32(input.dvnAttestation)
    : ('0x' + '00'.repeat(32));
  const to = input.toAddress && input.toAddress !== '' ? input.toAddress : '0x0000000000000000000000000000000000000000';

  const plan = {
    claimId: normalizedClaimId,
    to,
    amount: input.amountWei,
    dvnAttestation: normalizedAttestation,
    original: {
      claimId: input.claimId,
      toAddress: input.toAddress,
      dvnAttestation: input.dvnAttestation || '0x'
    }
  };

  try {
    const provider = new JsonRpcProvider(chainCfg.rpcUrl);
    const signer = new Wallet(cfg.treasuryPrivateKey!, provider);
    const cm = claimManagerAt(chainCfg.claimManagerAddress!, signer);
    const tx = await cm.redeem(plan.claimId, plan.to, plan.amount, plan.dvnAttestation);
    const receipt = await tx.wait();
    return { ok: true, executed: true, txHash: receipt?.hash };
  } catch (e: any) {
    return { ok: false, executed: false, reason: e?.message || 'claim exec error', plan };
  }
}
