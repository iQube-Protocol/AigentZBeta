import type { AgentChatMessage } from "./agentClient";
import { getMetaQubeLocation, ownerOf } from "./contractUtils";
import EncryptionModule from "./encryption";
import { requestDekForDecryption, unwrapLegacyDek } from "./keyWrapping";
import { supabase } from "./supabase";

export const MAX_CONTEXT_TOKENS_PER_REQUEST = 8;
export const MAX_CONTEXT_SERIALIZED_CHARS = 25000;
const API_BASE_URL = import.meta.env.VITE_AGENT_API_BASE_URL || "http://localhost:4000";

interface KeyRow {
  wrapped_key?: string | null;
  encrypted_key?: string | null;
  key_encryption_iv?: string | null;
}

interface MetadataAttribute {
  trait_type: string;
  value: unknown;
}

interface MetadataPayload {
  name?: string;
  description?: string;
  attributes?: MetadataAttribute[];
  [key: string]: unknown;
}

export interface ResolvedIqubeContext {
  tokenId: number;
  title: string;
  isEncrypted: boolean;
  metadataUri: string;
  payload: unknown;
}

export interface ResolvedIqubeContextBundle {
  contexts: ResolvedIqubeContext[];
  hasEncryptedContext: boolean;
  systemMessage: AgentChatMessage;
  serializedContextChars: number;
}

interface ResolveIqubeContextInput {
  tokenIds: number[];
  walletAddress: string;
}

interface ResolveIqubeContextDeps {
  ownerOfFn?: (tokenId: number) => Promise<string>;
  hasAccessGrantFn?: (tokenId: number, walletAddress: string) => Promise<boolean>;
  getMetaQubeLocationFn?: (tokenId: number) => Promise<string>;
  fetchJsonFn?: (url: string) => Promise<unknown>;
  fetchKeyRowFn?: (tokenId: number) => Promise<KeyRow | null>;
  requestDekFn?: (args: { tokenId: number; address: string }) => Promise<string>;
  unwrapLegacyDekFn?: (wrappedKeyJson: string, address: string) => Promise<string>;
  decryptFn?: (args: {
    iv: string;
    authTag: string;
    encryptedData: string;
    key: string;
  }) => Promise<unknown>;
}

function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

function assertValidTokenIds(tokenIds: number[]) {
  if (!Array.isArray(tokenIds)) {
    throw new Error("Context token IDs must be an array.");
  }
  if (tokenIds.length > MAX_CONTEXT_TOKENS_PER_REQUEST) {
    throw new Error(
      `Too many context iQubes selected. Max allowed is ${MAX_CONTEXT_TOKENS_PER_REQUEST}.`
    );
  }
  for (const tokenId of tokenIds) {
    if (!Number.isInteger(tokenId) || tokenId < 0) {
      throw new Error("Context token IDs must be non-negative integers.");
    }
  }
}

function buildMetadataFetchUrl(rawUrl: string | null): string {
  if (!rawUrl) {
    throw new Error("Empty metaQube URL on chain.");
  }

  let url = rawUrl;
  if (!url.startsWith("http")) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    if (parsed.hostname === "gateway.autonomys.xyz") {
      const segments = parsed.pathname.split("/").filter(Boolean);
      const cid = segments[segments.length - 1] ?? "";
      const gatewayUrl = `https://gateway.autonomys.xyz/file/${cid}`;
      return `${API_BASE_URL}/api/autodrive-metadata?url=${encodeURIComponent(
        gatewayUrl
      )}`;
    }
    return parsed.toString();
  } catch {
    const cid = rawUrl.replace(/^ipfs:\/\//, "").split("/").pop() ?? "";
    const gatewayUrl = `https://gateway.autonomys.xyz/file/${cid}`;
    return `${API_BASE_URL}/api/autodrive-metadata?url=${encodeURIComponent(
      gatewayUrl
    )}`;
  }
}

async function defaultFetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch iQube metadata (status ${response.status}).`);
  }
  return response.json();
}

async function defaultHasAccessGrant(tokenId: number, walletAddress: string): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase
    .from("iqube_access_list")
    .select("id")
    .eq("token_id", tokenId)
    .eq("address", normalizeAddress(walletAddress))
    .maybeSingle();
  return Boolean(data);
}

async function defaultFetchKeyRow(tokenId: number): Promise<KeyRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("iqube_wrapped_keys")
    .select("wrapped_key, encrypted_key, key_encryption_iv")
    .eq("token_id", tokenId)
    .single();
  if (error || !data) return null;
  return data as KeyRow;
}

function findAttribute(meta: MetadataPayload, trait: string): MetadataAttribute | undefined {
  if (!Array.isArray(meta.attributes)) return undefined;
  return meta.attributes.find((item) => item?.trait_type === trait);
}

function stripEncryptedBlob(meta: MetadataPayload): MetadataPayload {
  if (!Array.isArray(meta.attributes)) return meta;
  return {
    ...meta,
    attributes: meta.attributes.filter((item) => item?.trait_type !== "blakQube"),
  };
}

export async function resolveSelectedIqubeContexts(
  input: ResolveIqubeContextInput,
  deps: ResolveIqubeContextDeps = {}
): Promise<ResolvedIqubeContextBundle> {
  const walletAddress = normalizeAddress(input.walletAddress);
  const uniqueTokenIds = Array.from(new Set(input.tokenIds));
  assertValidTokenIds(uniqueTokenIds);

  const ownerOfFn = deps.ownerOfFn ?? ((tokenId: number) => ownerOf(tokenId));
  const hasAccessGrantFn = deps.hasAccessGrantFn ?? defaultHasAccessGrant;
  const getMetaQubeLocationFn =
    deps.getMetaQubeLocationFn ?? ((tokenId: number) => getMetaQubeLocation(tokenId));
  const fetchJsonFn = deps.fetchJsonFn ?? defaultFetchJson;
  const fetchKeyRowFn = deps.fetchKeyRowFn ?? defaultFetchKeyRow;
  const requestDekFn = deps.requestDekFn ?? requestDekForDecryption;
  const unwrapLegacyDekFn = deps.unwrapLegacyDekFn ?? unwrapLegacyDek;
  const decryptFn =
    deps.decryptFn ??
    ((args: { iv: string; authTag: string; encryptedData: string; key: string }) =>
      EncryptionModule.Decrypt(args));

  const contexts: ResolvedIqubeContext[] = [];
  let hasEncryptedContext = false;

  for (const tokenId of uniqueTokenIds) {
    const ownerAddress = normalizeAddress(await ownerOfFn(tokenId));
    const hasAccess =
      ownerAddress === walletAddress || (await hasAccessGrantFn(tokenId, walletAddress));
    if (!hasAccess) {
      throw new Error(`You are not authorized to use iQube #${tokenId} as context.`);
    }

    const metadataUri = await getMetaQubeLocationFn(tokenId);
    const metadataUrl = buildMetadataFetchUrl(metadataUri);
    const metadata = (await fetchJsonFn(metadataUrl)) as MetadataPayload;
    const title = String(metadata.name || `iQube #${tokenId}`);
    const isEncrypted = Boolean(findAttribute(metadata, "isEncrypted")?.value);

    if (!isEncrypted) {
      contexts.push({
        tokenId,
        title,
        isEncrypted: false,
        metadataUri,
        payload: stripEncryptedBlob(metadata),
      });
      continue;
    }

    const encryptedBlobValue = findAttribute(metadata, "blakQube")?.value;
    if (typeof encryptedBlobValue !== "string") {
      throw new Error(`iQube #${tokenId} is encrypted but has no decryptable payload.`);
    }

    const keyRow = await fetchKeyRowFn(tokenId);
    if (!keyRow) {
      throw new Error(`No decryptable key metadata found for iQube #${tokenId}.`);
    }

    let dekHex = "";
    if (keyRow.encrypted_key && keyRow.key_encryption_iv) {
      dekHex = await requestDekFn({ tokenId, address: walletAddress });
    } else if (keyRow.wrapped_key) {
      dekHex = await unwrapLegacyDekFn(keyRow.wrapped_key, walletAddress);
    } else {
      throw new Error(`No decryptable key was stored for iQube #${tokenId}.`);
    }

    const encryptedBlob = JSON.parse(encryptedBlobValue) as {
      iv: string;
      authTag: string;
      encryptedData: string;
    };
    const decryptedPayload = await decryptFn({
      iv: encryptedBlob.iv,
      authTag: encryptedBlob.authTag,
      encryptedData: encryptedBlob.encryptedData,
      key: dekHex,
    });

    hasEncryptedContext = true;
    contexts.push({
      tokenId,
      title,
      isEncrypted: true,
      metadataUri,
      payload: decryptedPayload,
    });
  }

  const contextEnvelope = {
    contextType: "iqube_context_bundle_v1",
    walletAddress,
    generatedAt: new Date().toISOString(),
    iqubes: contexts.map((item) => ({
      tokenId: item.tokenId,
      title: item.title,
      isEncrypted: item.isEncrypted,
      metadataUri: item.metadataUri,
      payload: item.payload,
    })),
  };

  const serializedContext = JSON.stringify(contextEnvelope, null, 2);
  if (serializedContext.length > MAX_CONTEXT_SERIALIZED_CHARS) {
    throw new Error(
      `Selected iQube context is too large (${serializedContext.length} chars). Max is ${MAX_CONTEXT_SERIALIZED_CHARS}.`
    );
  }

  const systemMessage: AgentChatMessage = {
    role: "system",
    content:
      "User-authorized iQube context is provided below as JSON. Use it when answering and do not fabricate missing values.\n\n" +
      serializedContext,
  };

  return {
    contexts,
    hasEncryptedContext,
    systemMessage,
    serializedContextChars: serializedContext.length,
  };
}
