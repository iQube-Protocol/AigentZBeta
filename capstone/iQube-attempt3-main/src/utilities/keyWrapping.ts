import { supabase } from "./supabase";

type KeyAction = "store" | "decrypt";

interface WalletMessageArgs {
  action: KeyAction;
  tokenId: number;
  address: string;
  issuedAt?: string;
  origin?: string;
}

interface StoreDekArgs {
  tokenId: number;
  address: string;
  dekHex: string;
  ipfsHash?: string | null;
}

interface RequestDekArgs {
  tokenId: number;
  address: string;
}

interface EdgeFunctionSuccess {
  success: boolean;
  dekHex?: string;
}

const EDGE_FUNCTION_NAME = "iqube-key-service";

function getEthereum() {
  const ethereum = (window as unknown as {
    ethereum?: { request: (args: unknown) => Promise<unknown> };
  }).ethereum;

  if (!ethereum) throw new Error("Wallet not available");
  return ethereum;
}

function getOrigin(origin?: string): string {
  if (origin) return origin;
  if (typeof window === "undefined") return "unknown";
  return window.location.origin;
}

function createMessage({
  action,
  tokenId,
  address,
  issuedAt = new Date().toISOString(),
  origin,
}: WalletMessageArgs): string {
  return [
    "iQube Key Authorization",
    `Action: ${action}`,
    `Token ID: ${tokenId}`,
    `Address: ${address.toLowerCase()}`,
    `Origin: ${getOrigin(origin)}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}

async function signMessage(address: string, message: string): Promise<string> {
  const ethereum = getEthereum();
  const signature = await ethereum.request({
    method: "personal_sign",
    params: [message, address],
  });

  if (typeof signature !== "string") {
    throw new Error("Wallet signature failed");
  }

  return signature;
}

async function invokeKeyService(
  payload: Record<string, unknown>
): Promise<EdgeFunctionSuccess> {
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const { data, error } = await supabase.functions.invoke<EdgeFunctionSuccess>(
    EDGE_FUNCTION_NAME,
    { body: payload }
  );

  if (error) {
    throw new Error(error.message || "Key service request failed");
  }

  if (!data?.success) {
    throw new Error("Key service returned an invalid response");
  }

  return data;
}

export function buildKeyAuthorizationMessage(args: WalletMessageArgs): string {
  return createMessage(args);
}

export async function authorizeDekStorage({
  tokenId,
  address,
  dekHex,
  ipfsHash,
}: StoreDekArgs): Promise<void> {
  const message = createMessage({ action: "store", tokenId, address });
  const signature = await signMessage(address, message);

  await invokeKeyService({
    action: "store",
    tokenId,
    address,
    dekHex,
    ipfsHash: ipfsHash ?? null,
    message,
    signature,
  });
}

export async function requestDekForDecryption({
  tokenId,
  address,
}: RequestDekArgs): Promise<string> {
  const message = createMessage({ action: "decrypt", tokenId, address });
  const signature = await signMessage(address, message);
  const data = await invokeKeyService({
    action: "decrypt",
    tokenId,
    address,
    message,
    signature,
  });

  if (!data.dekHex) {
    throw new Error("Key service did not return a decryption key");
  }

  return data.dekHex;
}

/**
 * Legacy migration path for iQubes minted before the server-managed key flow.
 * This keeps old data recoverable while rows are re-saved under the new scheme.
 */
export async function unwrapLegacyDek(
  wrappedKeyJson: string,
  address: string
): Promise<string> {
  const ethereum = getEthereum();

  try {
    const decrypted = await ethereum.request({
      method: "eth_decrypt",
      params: [wrappedKeyJson, address],
    });

    if (typeof decrypted !== "string") {
      throw new Error("Decryption failed");
    }

    return decrypted;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error ?? "unknown error");

    if (
      message.toLowerCase().includes("user denied") ||
      message.includes("4001")
    ) {
      throw new Error(
        "This iQube still uses the legacy MetaMask decrypt flow. Approve the one-time legacy decrypt prompt so the key can be migrated."
      );
    }

    throw new Error(
      `Legacy MetaMask decrypt failed. The iQube must be migrated to the new signature-based flow. Details: ${message}`
    );
  }
}
