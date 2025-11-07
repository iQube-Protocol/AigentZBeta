import { Contract, Interface, JsonRpcProvider, Wallet } from 'ethers';

export const IClaimManagerAbi = [
  // events
  {
    type: 'event',
    name: 'ClaimRedeemed',
    inputs: [
      { name: 'claimId', type: 'bytes32', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'srcTx', type: 'bytes32', indexed: false },
    ],
    anonymous: false,
  },
  // functions
  {
    type: 'function',
    name: 'redeem',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'claimId', type: 'bytes32' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'dvnAttestation', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'cancelExpired',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'claimId', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const;

export function claimManagerAt(address: string, provider: JsonRpcProvider | Wallet) {
  const iface = new Interface(IClaimManagerAbi as any);
  return new Contract(address, iface, provider);
}
