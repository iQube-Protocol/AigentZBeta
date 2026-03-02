#!/usr/bin/env node
import { spawn } from "node:child_process";
import { QubeTalkHttpClient } from "../bridge-core/qubetalkHttpClient";
import { loadEnv } from "./loadEnv";

loadEnv();

const tenantId = process.env.QT_TENANT_ID || "tnt_clawhack";
const client = new QubeTalkHttpClient({
  baseUrl: process.env.QUBETALK_API_ENDPOINT || "http://localhost:3000/api/qubetalk",
  tenantId,
  authToken: process.env.QUBETALK_AUTH_TOKEN || "",
});

const inboundId = process.env.QT_CHANNEL_BRIDGE_INBOUND_ID || "";
const outboundId = process.env.QT_CHANNEL_BRIDGE_OUTBOUND_ID || "";
let outboundSince: string | undefined;

const bridgeAgent = {
  id: process.env.BRIDGE_AGENT_ID || "convos_bridge",
  role: "system" as const,
  name: process.env.BRIDGE_AGENT_NAME || "Convos Bridge",
};

const proc = spawn("npx", [
  "@xmtp/convos-cli",
  "agent",
  "serve",
  "--name",
  "ClawHack",
  "--profile-name",
  "🤖 ClawHack",
  "--identity",
  process.env.CONVOS_IDENTITY_LABEL || "clawhack",
  ...(process.env.CONVOS_INVITE_URL ? ["--invite", process.env.CONVOS_INVITE_URL] : []),
], { stdio: ["pipe", "pipe", "inherit"] });

let convId = "";

proc.stdout?.on("data", async (data) => {
  for (const line of data.toString().split("\n").filter(Boolean)) {
    try {
      const evt = JSON.parse(line);
      if (evt.event === "ready") {
        convId = evt.conversationId;
        console.log(`✅ Ready! Conversation: ${convId}`);
      } else if (evt.event === "message") {
        console.log(`📥 ${evt.content}`);
        await client.sendMessage({
          channelId: inboundId,
          fromAgent: bridgeAgent,
          type: "event",
          content: JSON.stringify({
          schema: "metame.bridge.inbound.v0",
          tenant_id: tenantId,
          provider: { name: "xmtp", environment: "dev" },
          thread: {
            provider_thread_id: convId,
            thread_key: `convos_${convId}`,
            qt_thread_id: `qt://${tenantId}/threads/xmtp/${convId}`,
          },
          message: {
            provider_message_id: evt.id,
            sent_ts: evt.sentAt,
            sender: { provider_user_id: evt.senderInboxId, display_name: "User" },
            content: { type: "text", text: evt.content },
          },
          routing: { target_agent: "router", intent_hint: "unknown" },
          security: {
            data_classification: "internal",
            receipt_required: true,
            redaction_required: false,
          },
          }),
          metadata: {
            schema: "metame.bridge.inbound.v0",
            thread_key: `convos_${convId}`,
          },
        });
      }
    } catch {}
  }
});

setInterval(async () => {
  if (!convId) return;

  const msgs = await client.listMessages(outboundId, {
    since: outboundSince,
    limit: 25,
  });
  if (msgs.length > 0) {
    outboundSince = msgs
      .map((msg) => msg.created_at)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .at(-1);
  }

  for (const msg of msgs) {
    try {
      const payload = JSON.parse(msg.content) as {
        message?: { content?: { text?: string } };
      };
      const text = payload?.message?.content?.text;
      if (text && text.trim()) {
        proc.stdin?.write(JSON.stringify({ type: "send", text }) + "\n");
        console.log("📤 Sent response");
      }
    } catch {
      // Ignore non-JSON or non-bridge payloads.
    }
  }
}, 5000);
