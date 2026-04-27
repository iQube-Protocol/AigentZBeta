import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createPublicClient,
  http,
  verifyMessage,
  type Address,
} from "https://esm.sh/viem@2";
import { polygonAmoy } from "https://esm.sh/viem@2/chains";

// ——— Environment ———

const MASTER_KEY_HEX = Deno.env.get("IQUBE_DEK_MASTER_KEY_HEX");
const CONTRACT_ADDRESS = (Deno.env.get("IQUBE_CONTRACT_ADDRESS") ??
  "0x52963dCe351eE3e8Af3f179D01271cA4e29C8448") as Address;
const RPC_URL =
  Deno.env.get("IQUBE_POLYGON_RPC_URL") ?? "https://rpc-amoy.polygon.technology";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ——— Helpers ———

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function getMasterKey(): Promise<CryptoKey> {
  if (!MASTER_KEY_HEX) throw new Error("IQUBE_DEK_MASTER_KEY_HEX not set");
  return crypto.subtle.importKey(
    "raw",
    hexToBytes(MASTER_KEY_HEX),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptDek(dekHex: string): Promise<{ ciphertext: string; iv: string }> {
  const masterKey = await getMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    masterKey,
    new TextEncoder().encode(dekHex)
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
  };
}

async function decryptDek(ciphertextB64: string, ivB64: string): Promise<string> {
  const masterKey = await getMasterKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivB64), tagLength: 128 },
    masterKey,
    base64ToBytes(ciphertextB64)
  );
  return new TextDecoder().decode(decrypted);
}

// Minimal ABI for ownerOf
const ownerOfAbi = [
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const viemClient = createPublicClient({
  transport: http(RPC_URL),
  chain: polygonAmoy,
});

async function verifyOwnership(tokenId: number, address: string): Promise<boolean> {
  const owner = await viemClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: ownerOfAbi,
    functionName: "ownerOf",
    args: [BigInt(tokenId)],
  });
  return owner.toLowerCase() === address.toLowerCase();
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

// ——— Main handler ———

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const {
      action,
      tokenId,
      address,
      dekHex,
      ipfsHash,
      message,
      signature,
    } = await req.json();

    // 1. Validate inputs
    if (!action || !tokenId || !address || !message || !signature) {
      return jsonResponse({ error: "Missing required fields" }, 400);
    }

    // 2. Verify wallet signature
    const isValid = await verifyMessage({
      address: address as Address,
      message,
      signature,
    });

    if (!isValid) {
      return jsonResponse({ error: "Invalid wallet signature" }, 403);
    }

    // 3. Verify on-chain ownership or shared access
    const isOwner = await verifyOwnership(tokenId, address);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (!isOwner) {
      // Not the owner — check if caller is in the access list
      const { data: accessRow } = await supabase
        .from("iqube_access_list")
        .select("id")
        .eq("token_id", tokenId)
        .eq("address", address.toLowerCase())
        .maybeSingle();

      if (!accessRow) {
        return jsonResponse({ error: "Caller is not the token owner or an authorized address" }, 403);
      }
    }

    // ——— STORE action ———
    if (action === "store") {
      if (!isOwner) {
        return jsonResponse({ error: "Only the token owner can store keys" }, 403);
      }
      if (!dekHex) {
        return jsonResponse({ error: "dekHex is required for store action" }, 400);
      }

      const { ciphertext, iv } = await encryptDek(dekHex);

      const { error: upsertErr } = await supabase
        .from("iqube_wrapped_keys")
        .upsert(
          {
            token_id: tokenId,
            minter_address: address.toLowerCase(),
            encrypted_key: ciphertext,
            key_encryption_iv: iv,
            key_encryption_scheme: "server_aes_gcm_v1",
            ipfs_hash: ipfsHash ?? null,
            // Clear legacy field on migration
            wrapped_key: null,
          },
          { onConflict: "token_id" }
        );

      if (upsertErr) {
        return jsonResponse({ error: upsertErr.message }, 500);
      }

      return jsonResponse({ success: true });
    }

    // ——— DECRYPT action ———
    if (action === "decrypt") {
      const { data: keyRow, error: fetchErr } = await supabase
        .from("iqube_wrapped_keys")
        .select("encrypted_key, key_encryption_iv")
        .eq("token_id", tokenId)
        .single();

      if (fetchErr || !keyRow) {
        return jsonResponse({ error: "Key not found for this token" }, 404);
      }

      if (!keyRow.encrypted_key || !keyRow.key_encryption_iv) {
        return jsonResponse(
          { error: "This token still uses the legacy key scheme. Migrate first." },
          400
        );
      }

      const dekHexResult = await decryptDek(
        keyRow.encrypted_key,
        keyRow.key_encryption_iv
      );

      return jsonResponse({ success: true, dekHex: dekHexResult });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: msg }, 500);
  }
});
