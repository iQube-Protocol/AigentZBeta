import type { InboundEvent, OutboundEvent } from "../schemas/bridgeEvents";
import {
  type MetaMeRuntimeEnvelope,
  tryParseMetaMeRuntimeEnvelopeText,
} from "../schemas/metameEnvelope";

export function envelopeIntentToHint(
  intent: MetaMeRuntimeEnvelope["intent"]
): InboundEvent["routing"]["intent_hint"] {
  if (intent === "make") return "create_drop";
  if (intent === "find" || intent === "play") return "summarize";
  return "help";
}

export function extractEnvelopeFromUnknownContent(content: unknown): MetaMeRuntimeEnvelope | null {
  if (typeof content === "string") {
    return tryParseMetaMeRuntimeEnvelopeText(content);
  }

  if (content && typeof content === "object") {
    const envelope = content as Partial<MetaMeRuntimeEnvelope>;
    if (envelope.schema_version === "metame.envelope.v1" && typeof envelope.envelope_id === "string") {
      return envelope as MetaMeRuntimeEnvelope;
    }

    const nestedText = (content as { text?: unknown }).text;
    if (typeof nestedText === "string") {
      return tryParseMetaMeRuntimeEnvelopeText(nestedText);
    }
  }

  return null;
}

export function outboundEventToProviderPayload(event: OutboundEvent): string {
  const envelope = event.message.content.metame_envelope;
  if (envelope) {
    return JSON.stringify(envelope);
  }
  return event.message.content.text;
}

export function normalizeInboundText(
  content: unknown,
  fallbackText: string
): { text: string; envelope: MetaMeRuntimeEnvelope | null } {
  const envelope = extractEnvelopeFromUnknownContent(content);
  if (!envelope) {
    return { text: fallbackText, envelope: null };
  }

  const envelopeText =
    envelope.payload.text ||
    envelope.payload.inference?.content ||
    fallbackText ||
    JSON.stringify(envelope.payload.data || {});

  return { text: envelopeText, envelope };
}

