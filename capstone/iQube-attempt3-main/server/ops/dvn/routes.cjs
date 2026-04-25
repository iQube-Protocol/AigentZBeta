const express = require("express");
const { createDvnActor } = require("./icAgent.cjs");
const { getDefaultRpc, getChainConfig, isSupportedChain, SUPPORTED_CHAIN_IDS } = require("./chains.cjs");

function parseErrorMessage(error) {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return String(error || "Unknown error");
}

function parseLocalId(idValue) {
  // Supported local formats:
  // - local:0x...
  // - local:<chainId>:0x...
  if (!idValue.startsWith("local:")) return null;
  const raw = idValue.slice("local:".length);
  const parts = raw.split(":");
  if (parts.length === 1) {
    return { chainId: null, txHash: parts[0] };
  }
  if (parts.length >= 2) {
    const first = Number(parts[0]);
    const txHash = parts.slice(1).join(":");
    if (Number.isFinite(first)) return { chainId: first, txHash };
  }
  return { chainId: null, txHash: raw };
}

async function fetchReceipt(rpcUrl, txHash) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_getTransactionReceipt",
      params: [txHash],
      id: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC request failed: ${response.status}`);
  }
  return response.json();
}

function createDVNRouter() {
  const router = express.Router();

  // POST /api/ops/dvn/monitor
  // Required body: { txHash: string, chainId: number }
  // Optional body: { rpcUrl: string } to override chain default RPC.
  router.post("/monitor", async (req, res) => {
    let txHash;
    try {
      txHash = req.body?.txHash;
      const chainId = req.body?.chainId;
      const rpcUrl = req.body?.rpcUrl;

      if (!txHash || typeof txHash !== "string") {
        return res.status(400).json({ ok: false, error: "txHash is required" });
      }
      if (typeof chainId !== "number") {
        return res.status(400).json({ ok: false, error: "chainId is required" });
      }
      if (!isSupportedChain(chainId)) {
        return res.status(400).json({
          ok: false,
          error: `Unsupported chainId: ${chainId}. Supported chains: ${SUPPORTED_CHAIN_IDS.join(", ")}`,
        });
      }

      const effectiveRpc = rpcUrl && typeof rpcUrl === "string" ? rpcUrl : getDefaultRpc(chainId);
      console.log(
        `[DVN] monitor request chainId=${chainId}, txHash=${txHash}, rpc=${effectiveRpc || "none"}`
      );

      const { actor, error: actorError } = await createDvnActor();
      if (!actor || typeof actor.submit_dvn_message !== "function") {
        const fallbackId = `local:${chainId}:${txHash}`;
        return res.json({
          ok: true,
          messageId: fallbackId,
          fallback: true,
          note: actorError || "DVN actor unavailable, using local tracking fallback",
          at: new Date().toISOString(),
        });
      }

      const payload = JSON.stringify({
        action: "MONITOR",
        txHash,
        chainId,
        chainName: getChainConfig(chainId)?.name,
        status: "pending",
        timestamp: Date.now(),
        receiptId: `receipt_${Date.now()}`,
      });

      const messageId = `monitor_${chainId}_${Date.now()}`;
      const submitRes = await actor.submit_dvn_message(
        chainId,
        0,
        Array.from(new TextEncoder().encode(payload)),
        messageId
      );

      if (typeof submitRes === "string") {
        return res.json({
          ok: true,
          messageId: submitRes,
          fallback: true,
          at: new Date().toISOString(),
        });
      }

      throw new Error("submit_dvn_message returned unexpected result");
    } catch (error) {
      const message = parseErrorMessage(error);
      if (message.includes("canister_not_found") && txHash) {
        return res.json({
          ok: true,
          messageId: `local:${txHash}`,
          fallback: true,
          at: new Date().toISOString(),
        });
      }
      return res.status(500).json({
        ok: false,
        error: message,
        canisterDown: true,
      });
    }
  });

  // GET /api/ops/dvn/tx?id=...&chainId=...
  // Required query: id or hash.
  // Optional query: chainId (defaults to 80002 for backward compatibility).
  router.get("/tx", async (req, res) => {
    try {
      let idOrHash = req.query.id || req.query.hash || "";
      const chainIdParam = req.query.chainId;
      const queryChainId = chainIdParam !== undefined ? Number(chainIdParam) : 80002;
      if (!idOrHash || typeof idOrHash !== "string") {
        return res.status(400).json({ ok: false, error: "id or hash is required" });
      }
      if (!Number.isFinite(queryChainId)) {
        return res.status(400).json({ ok: false, error: "chainId must be a number" });
      }
      if (!isSupportedChain(queryChainId)) {
        return res.status(400).json({
          ok: false,
          error: `Unsupported chainId: ${queryChainId}. Supported chains: ${SUPPORTED_CHAIN_IDS.join(", ")}`,
        });
      }

      // If caller passed a message text with embedded tx hash, treat as local hash query.
      const txHashMatch = idOrHash.match(/0x[0-9a-fA-F]{64}/);
      if (!idOrHash.startsWith("local:") && txHashMatch) {
        idOrHash = `local:${queryChainId}:${txHashMatch[0]}`;
      } else if (/^0x[0-9a-fA-F]{64}$/.test(idOrHash)) {
        idOrHash = `local:${queryChainId}:${idOrHash}`;
      }

      if (idOrHash.startsWith("local:")) {
        const parsed = parseLocalId(idOrHash);
        const localChainId = parsed?.chainId ?? queryChainId;
        const txHash = parsed?.txHash || "";
        if (!isSupportedChain(localChainId)) {
          return res.status(400).json({
            ok: false,
            error: `Unsupported chainId: ${localChainId}. Supported chains: ${SUPPORTED_CHAIN_IDS.join(", ")}`,
          });
        }

        const rpcUrl = getDefaultRpc(localChainId);
        if (!rpcUrl) {
          return res.status(500).json({
            ok: false,
            error: `No default RPC configured for chainId ${localChainId}`,
            fallback: true,
          });
        }

        const data = await fetchReceipt(rpcUrl, txHash);
        const receipt = data.result;
        if (!receipt) {
          return res.json({
            ok: true,
            message: null,
            attestations: [],
            fallback: true,
            pending: true,
            at: new Date().toISOString(),
          });
        }

        const message = {
          id: `local:${localChainId}:${txHash}`,
          source_chain: localChainId,
          destination_chain: 1,
          nonce: parseInt(receipt.transactionIndex || "0", 16),
          sender: receipt.from,
          timestamp: Date.now(),
          status: receipt.status === "0x1" ? "confirmed" : "failed",
          chain_name: getChainConfig(localChainId)?.name,
        };
        return res.json({ ok: true, message, attestations: [], fallback: true, at: new Date().toISOString() });
      }

      const { actor } = await createDvnActor();
      if (!actor) {
        return res.json({
          ok: true,
          message: null,
          attestations: [],
          fallback: true,
          pending: true,
          at: new Date().toISOString(),
        });
      }

      const msgOpt = await actor.get_dvn_message(idOrHash);
      const message = Array.isArray(msgOpt) ? (msgOpt.length ? msgOpt[0] : null) : msgOpt?.Some || null;
      let attestations = [];
      if (message && typeof actor.get_message_attestations === "function") {
        try {
          attestations = await actor.get_message_attestations(message.id);
        } catch {
          attestations = [];
        }
      }

      if (message) {
        if (message.timestamp) message.timestamp = Number(message.timestamp);
        if (message.nonce) message.nonce = Number(message.nonce);
        if (message.source_chain) message.source_chain = Number(message.source_chain);
        if (message.destination_chain) message.destination_chain = Number(message.destination_chain);
      }

      if (Array.isArray(attestations)) {
        attestations.forEach((att) => {
          if (att?.timestamp) att.timestamp = Number(att.timestamp);
        });
      }

      return res.json({ ok: true, message, attestations, at: new Date().toISOString() });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: parseErrorMessage(error) || "Failed to load DVN tx status",
      });
    }
  });

  return router;
}

function registerDVNRoutes(app) {
  app.use("/api/ops/dvn", createDVNRouter());
}

module.exports = {
  createDVNRouter,
  registerDVNRoutes,
};
