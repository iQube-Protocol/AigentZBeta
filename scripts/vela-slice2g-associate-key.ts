/**
 * One-off ops script: submit an ASSOCIATEKEY request (RequestType=3) so a
 * given P-521 public key is registered with a Vela application before any
 * PROCESS request from that requester can be decrypted.
 *
 * Root cause this fixes: a live PROCESS request against a freshly deployed
 * app failed with `errorCode 9 "no Secp521r1_PubKey found"` — confirmed via
 * `docs/3_typescript-client.md`'s "Registering Your Key (Associate Key)"
 * section: "Before you can receive encrypted events or submit encrypted
 * payloads, your P-521 public key must be registered on-chain via an
 * ASSOCIATEKEY request." Slices 2B/2E/2F's live proofs must have performed
 * this step out-of-band; it was never codified in this repo.
 *
 * Payload is the 133-byte raw uncompressed P-521 public key (Option A per the
 * docs — no privacy-preserving subtype seed needed for this proof).
 *
 * Usage:
 *   npx tsx scripts/vela-slice2g-associate-key.ts --app <applicationId> \
 *     --evm-key <hex> --p521-key <hex>
 */
import { createECDH } from 'crypto';
import { JsonRpcProvider, Wallet, Contract, Interface } from 'ethers';
import { VELA_LOCAL_DEPLOYMENT } from '../services/vela/velaConfig';

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || !process.argv[i + 1]) throw new Error(`missing required argument --${name}`);
  return process.argv[i + 1];
}

const ABI = [
  'function submitRequest(uint8 protocolVersion, uint64 applicationId, uint8 requestType, bytes payload, address tokenAddress, uint256 assetAmount, uint256 maxFeeValue) payable returns (bytes32)',
  'function minFeePerRequest() view returns (uint256)',
  'event RequestSubmitted(uint64 indexed applicationId, bytes32 indexed requestId, address indexed sender, address facilitator)',
  'event RequestCompleted(uint64 indexed applicationId, bytes32 indexed requestId, uint256 applicationFees, uint8 status, uint8 errorCode, string errorMessage)',
];

async function main() {
  const appId = BigInt(arg('app'));
  const evmKey = arg('evm-key');
  const p521PrivHex = arg('p521-key');

  const provider = new JsonRpcProvider(VELA_LOCAL_DEPLOYMENT.rpcUrl);
  const wallet = new Wallet(evmKey, provider);
  const processor = new Contract(VELA_LOCAL_DEPLOYMENT.processorEndpointAddress, ABI, wallet);

  const ecdh = createECDH('secp521r1');
  ecdh.setPrivateKey(Buffer.from(p521PrivHex, 'hex'));
  const pubKey = ecdh.getPublicKey(); // uncompressed, 133 bytes for P-521
  if (pubKey.length !== 133) throw new Error(`expected 133-byte P-521 public key, got ${pubKey.length}`);

  const minFee: bigint = await processor.minFeePerRequest();
  const maxFee = minFee > 1_000_000n ? minFee : 1_000_000n;

  const tx = await processor.submitRequest(
    0,
    appId,
    3, // ASSOCIATEKEY
    pubKey,
    '0x0000000000000000000000000000000000000000',
    0n,
    maxFee,
    { value: maxFee },
  );
  console.log('submitRequest(ASSOCIATEKEY) tx:', tx.hash);
  const receipt = await tx.wait();
  if (!receipt) throw new Error('no receipt');

  const iface = new Interface(ABI);
  let requestId: string | null = null;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === 'RequestSubmitted') requestId = parsed.args.requestId as string;
    } catch {
      /* not ours */
    }
  }
  if (!requestId) throw new Error('RequestSubmitted event not found');
  console.log('requestId:', requestId);

  for (let i = 0; i < 30; i++) {
    const events = await processor.queryFilter(
      processor.filters.RequestCompleted(appId, requestId),
      receipt.blockNumber,
    );
    if (events.length > 0) {
      const ev = events[0] as unknown as { args: { errorCode: number; errorMessage: string; status: number } };
      console.log(`RequestCompleted — errorCode ${ev.args.errorCode}, errorMessage "${ev.args.errorMessage}", status ${ev.args.status}`);
      if (Number(ev.args.errorCode) !== 0) throw new Error(`ASSOCIATEKEY failed: errorCode ${ev.args.errorCode} — ${ev.args.errorMessage}`);
      console.log('ASSOCIATEKEY SUCCEEDED');
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('timed out waiting for RequestCompleted');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
