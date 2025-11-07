import { Contract, Interface, JsonRpcProvider, Wallet } from 'ethers';

export const ITokenQubeACLAbi = [
  // events
  {
    type: 'event',
    name: 'CapabilityGranted',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'scopeHash', type: 'bytes32', indexed: false },
      { name: 'ttl', type: 'uint64', indexed: false },
      { name: 'nonce', type: 'bytes32', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OwnerTransferred',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
    ],
    anonymous: false,
  },
  // functions
  {
    type: 'function',
    name: 'grantCapability',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'scopeHash', type: 'bytes32' },
      { name: 'ttl', type: 'uint64' },
      { name: 'limits', type: 'bytes' },
      { name: 'dvnAttestation', type: 'bytes' },
      { name: 'msgSig', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'transferOwnerWithDID',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'dvnAttestation', type: 'bytes' },
      { name: 'msgSig', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'revokeCapability',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'scopeHash', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const;

export function tokenQubeACLAt(address: string, provider: JsonRpcProvider | Wallet) {
  const iface = new Interface(ITokenQubeACLAbi as any);
  return new Contract(address, iface, provider);
}
