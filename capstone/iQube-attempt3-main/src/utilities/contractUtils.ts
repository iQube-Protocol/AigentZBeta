import {
  createPublicClient,
  createWalletClient,
  http,
  custom,
  type Hash,
  type Address,
} from "viem";
import { polygonAmoy } from "viem/chains";
import constants from "./constants";
import { iqubeAbi } from "./iqubeAbi";

const transport = http(constants.RPC_POLYGON_AMOY);

export const publicClient = createPublicClient({
  transport,
  chain: polygonAmoy,
});

const contractAddress = constants.AMOY as Address;

// ——— Read helpers (no wallet needed) ———

export async function getMetaQubeLocation(tokenId: bigint | number): Promise<string> {
  return publicClient.readContract({
    address: contractAddress,
    abi: iqubeAbi,
    functionName: "getMetaQubeLocation",
    args: [BigInt(tokenId)],
  });
}

export async function minterOf(tokenId: bigint | number): Promise<Address> {
  return publicClient.readContract({
    address: contractAddress,
    abi: iqubeAbi,
    functionName: "minterOf",
    args: [BigInt(tokenId)],
  });
}

export async function ownerOf(tokenId: bigint | number): Promise<Address> {
  return publicClient.readContract({
    address: contractAddress,
    abi: iqubeAbi,
    functionName: "ownerOf",
    args: [BigInt(tokenId)],
  });
}

function getBrowserProvider(): unknown {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: unknown }).ethereum;
}

// ——— Write helpers (need wallet; call from component with useWallet) ———

export async function mintQube(
  to: Address,
  metaQubeLocation: string
): Promise<Hash> {
  const provider = getBrowserProvider();
  if (!provider) {
    throw new Error("Wallet not available");
  }
  const walletClient = createWalletClient({
    transport: custom(provider as never),
    chain: polygonAmoy,
  });
  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error("No account connected");
  const hash = await walletClient.writeContract({
    address: contractAddress,
    abi: iqubeAbi,
    functionName: "mintQube",
    args: [to, metaQubeLocation],
    account,
    // Polygon Amoy requires min ~25 gwei tip; default was 1.5 gwei
    maxPriorityFeePerGas: BigInt(35_000_000_000), // 35 gwei
    maxFeePerGas: BigInt(50_000_000_000),       // 50 gwei
  });
  return hash;
}

/** Parse tokenId from mint transaction receipt (Transfer event from address(0)) */
export async function getTokenIdFromMintReceipt(txHash: Hash): Promise<bigint> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  const transferLog = receipt.logs.find(
    (log) =>
      log.topics[0] ===
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" && // Transfer(address,address,uint256)
      log.topics[1] ===
        "0x0000000000000000000000000000000000000000000000000000000000000000" // from address(0)
  );
  if (!transferLog || !transferLog.topics[3]) {
    throw new Error("Could not parse tokenId from mint receipt");
  }
  return BigInt(transferLog.topics[3]);
}

export async function transferQube(
  to: Address,
  tokenId: bigint | number
): Promise<Hash> {
  const provider = getBrowserProvider();
  if (!provider) {
    throw new Error("Wallet not available");
  }
  const walletClient = createWalletClient({
    transport: custom(provider as never),
    chain: polygonAmoy,
  });
  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error("No account connected");
  const hash = await walletClient.writeContract({
    address: contractAddress,
    abi: iqubeAbi,
    functionName: "transferQube",
    args: [to, BigInt(tokenId)],
    account,
    maxPriorityFeePerGas: BigInt(35_000_000_000),
    maxFeePerGas: BigInt(50_000_000_000),
  });
  return hash;
}
