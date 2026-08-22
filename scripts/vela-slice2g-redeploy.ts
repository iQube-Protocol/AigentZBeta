/**
 * One-off ops script: redeploy the already-built MoneyPenny Confidential
 * Consequence Projector WASM (Slice 2D) to the CURRENTLY running local Vela
 * chain, and print the fresh `applicationId`.
 *
 * Why this is needed: the local Vela chain (`vela-skit-chain`, Anvil) does
 * not persist its in-memory state across a container restart, so a
 * previously-deployed `applicationId` from an earlier session (e.g.
 * `2089125378143059424`, recorded in the Slice 2F session doc) no longer
 * exists once the container has been restarted — confirmed live: the
 * ProcessorEndpoint/TeeAuthenticator CONTRACTS still exist at their
 * deterministic Anvil-genesis addresses (the deployer redeploys them on every
 * container start), but the WASM APPLICATION deployed on top of them does
 * not survive a chain restart. The WASM ARTIFACT itself is untouched — it
 * lives in the `vela-skit-shared-data` named volume, confirmed present on
 * disk at its recorded sha256
 * (`b287b7e838d172d2acb196f248dc1d6a35ee70d4450ef88ca3dd11c83bd81c1c`) — so
 * only the on-chain `submitDeployRequest` needs to be resubmitted, not a
 * fresh WASM upload.
 *
 * ABI verified directly against the pinned v0.2.0 source
 * (`horizenofficial/vela/contracts/contracts/ProcessorEndpoint.sol` and its
 * generated Go binding `pkg/blockchain/contracts/processorendpoint/
 * ProcessorEndpoint.go`) — not guessed:
 *   function submitDeployRequest(uint8 protocolVersion, bytes payload) payable returns (bytes32)
 *   event DeployRequestSubmitted(uint64 indexed applicationId, bytes32 requestId, address indexed sender)
 *   event DeployRequestCompleted(uint64 indexed applicationId, bytes32 indexed requestId, uint256 applicationFees, uint8 status, uint8 errorCode, string errorMessage)
 * `applicationId = uint64(bytes8(requestId))` per `_submitDeployRequest`.
 *
 * Usage:
 *   npx tsx scripts/vela-slice2g-redeploy.ts [--evm-key <hex>]
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { JsonRpcProvider, Wallet, Contract, Interface } from 'ethers';
import { VELA_LOCAL_DEPLOYMENT } from '../services/vela/velaConfig';

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  if (fallback !== undefined) return fallback;
  throw new Error(`missing required argument --${name}`);
}

// Anvil Account #0 — documented dev key from vela-starterkit/dockerfiles/.env.dev
// (DEPLOYER_PRIVATE_KEY / DEPLOYER_ADMIN). Holds DEPLOYER_ROLE.
const DEFAULT_DEV_EVM_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const EVM_KEY = arg('evm-key', DEFAULT_DEV_EVM_KEY);

const DEPLOY_ABI = [
  'function submitDeployRequest(uint8 protocolVersion, bytes payload) payable returns (bytes32)',
  'event DeployRequestSubmitted(uint64 indexed applicationId, bytes32 requestId, address indexed sender)',
  'event DeployRequestCompleted(uint64 indexed applicationId, bytes32 indexed requestId, uint256 applicationFees, uint8 status, uint8 errorCode, string errorMessage)',
  'function minFeePerRequest() view returns (uint256)',
];

const WASM_PATH = join(
  process.cwd(),
  'services/vela/wasm/projector/production_build/moneypenny_projector.wasm',
);

async function main() {
  const wasm = readFileSync(WASM_PATH);
  const wasmSha256 = createHash('sha256').update(wasm).digest('hex');
  console.log(`WASM: ${WASM_PATH}`);
  console.log(`sha256: ${wasmSha256}`);

  const provider = new JsonRpcProvider(VELA_LOCAL_DEPLOYMENT.rpcUrl);
  const wallet = new Wallet(EVM_KEY, provider);
  const processor = new Contract(VELA_LOCAL_DEPLOYMENT.processorEndpointAddress, DEPLOY_ABI, wallet);

  const payload = Buffer.from(
    JSON.stringify({
      mode: 'artifact_ref',
      artifactId: `sha256:${wasmSha256}`,
      wasmSha256,
      constructorParams: {},
    }),
    'utf8',
  );

  const minFee: bigint = await processor.minFeePerRequest();
  console.log(`minFeePerRequest: ${minFee}`);

  const tx = await processor.submitDeployRequest(0, payload, { value: minFee > 0n ? minFee : 1_000_000n });
  console.log(`submitDeployRequest tx: ${tx.hash}`);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error('submitDeployRequest transaction reverted');

  const iface = new Interface(DEPLOY_ABI);
  let applicationId: bigint | null = null;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === 'DeployRequestSubmitted') {
        applicationId = parsed.args.applicationId as bigint;
        console.log(`DeployRequestSubmitted — applicationId ${applicationId}, requestId ${parsed.args.requestId}`);
      }
    } catch {
      /* not one of our events */
    }
  }
  if (applicationId === null) throw new Error('DeployRequestSubmitted event not found in receipt logs');

  // Poll for DeployRequestCompleted (Manager/Executor process asynchronously).
  console.log('Waiting for DeployRequestCompleted…');
  const filter = processor.filters.DeployRequestCompleted(applicationId);
  let completed: { errorCode: number; errorMessage: string; status: number } | null = null;
  const fromBlock = receipt.blockNumber;
  for (let i = 0; i < 60 && !completed; i++) {
    const events = await processor.queryFilter(filter, fromBlock, 'latest');
    if (events.length > 0) {
      const ev = events[events.length - 1] as unknown as { args: { errorCode: number; errorMessage: string; status: number } };
      completed = { errorCode: Number(ev.args.errorCode), errorMessage: ev.args.errorMessage, status: Number(ev.args.status) };
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (!completed) throw new Error('DeployRequestCompleted did not arrive within timeout');

  console.log(`DeployRequestCompleted — status ${completed.status}, errorCode ${completed.errorCode}, errorMessage "${completed.errorMessage}"`);
  if (completed.errorCode !== 0) throw new Error(`deploy failed on-chain: errorCode ${completed.errorCode} — ${completed.errorMessage}`);

  console.log(`\nAPPLICATION_ID=${applicationId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
