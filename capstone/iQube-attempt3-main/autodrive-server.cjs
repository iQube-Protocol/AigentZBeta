require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createAutoDriveApi } = require("@autonomys/auto-drive");
const { NetworkId } = require("@autonomys/auto-utils");
const { registerAgentRoutes } = require("./server/agent/routes/chat.cjs");
const { createOllamaClient } = require("./server/agent/providers/ollama.cjs");
const { authorizeAgentUse } = require("./server/agent/auth/authorizeAgentUse.cjs");
const { createRateLimiter } = require("./server/agent/rateLimiter.cjs");
const { registerDVNRoutes } = require("./server/ops/dvn/routes.cjs");

const app = express();
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  })
);
app.use(express.json());

const API_KEY = process.env.AUTO_DRIVE_API_KEY;
const NETWORK = NetworkId.MAINNET;

if (!API_KEY) {
  console.warn(
    "[AutoDrive] AUTO_DRIVE_API_KEY is not set in the server environment. Auto-Drive uploads will fail."
  );
}

const autoDriveApi =
  API_KEY &&
  createAutoDriveApi({
    apiKey: API_KEY,
    network: NETWORK,
  });

const ollamaClient = createOllamaClient();
const agentRateLimiter = createRateLimiter({
  windowMs: Number(process.env.AGENT_RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.AGENT_RATE_LIMIT_MAX || 20),
});

registerAgentRoutes(app, {
  authorizeAgentUse,
  ollamaClient,
  rateLimiter: agentRateLimiter,
  logger: console,
});
registerDVNRoutes(app);

app.get("/", (req, res) => {
  res.send("Auto-Drive + Agent helper server is running");
});

app.get("/api/autodrive-metadata", async (req, res) => {
  try {
    const url = req.query.url;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing url query parameter" });
    }

    const response = await fetch(url);
    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: `Upstream metadata fetch failed with status ${response.status}` });
    }

    const json = await response.json();
    res.json(json);
  } catch (err) {
    console.error("Auto-Drive metadata proxy error:", err);
    const message =
      err && typeof err === "object" && "message" in err
        ? String(err.message)
        : String(err);
    res.status(500).json({ error: message });
  }
});

app.post("/api/autodrive-upload", async (req, res) => {
  try {
    if (!autoDriveApi) {
      return res.status(500).json({ error: "Auto-Drive is not configured" });
    }

    const metadata = req.body.metadata;
    if (!metadata) {
      return res.status(400).json({ error: "Missing 'metadata' in request body" });
    }

    const jsonString = JSON.stringify(metadata);
    const buffer = Buffer.from(jsonString, "utf8");

    // uploadFileFromBuffer returns the CID string directly
    const cid = await autoDriveApi.uploadFileFromBuffer(
      buffer,
      "iqube-metadata.json",
      {
        contentType: "application/json",
        compression: true,
      }
    );
    if (!cid) {
      return res.status(500).json({ error: "Auto-Drive upload did not return a CID" });
    }

    const gatewayBase =
      process.env.AUTO_DRIVE_GATEWAY_URL ||
      "https://gateway.autonomys.xyz/file";

    const url = `${gatewayBase}/${cid}`;

    res.json({ cid, url });
  } catch (err) {
    console.error("Auto-Drive upload error:", err);
    const message =
      err && typeof err === "object" && "message" in err
        ? String(err.message)
        : String(err);
    res.status(500).json({ error: message });
  }
});

const PORT = process.env.AUTODRIVE_PORT || 4000;
app.listen(PORT, () => {
  console.log(`Auto-Drive server listening on http://localhost:${PORT}`);
});

