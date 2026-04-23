import { describe, expect, it } from "vitest";
import { validateChatRequest } from "../../server/agent/validation.cjs";

describe("validateChatRequest contextTokenIds", () => {
  const baseBody = {
    walletAddress: "0x1111111111111111111111111111111111111111",
    messages: [{ role: "user", content: "hello" }],
    stream: false,
  };

  it("accepts valid context token ids", () => {
    const result = validateChatRequest({
      ...baseBody,
      contextTokenIds: [4, 9],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.contextTokenIds).toEqual([4, 9]);
  });

  it("deduplicates repeated context token ids", () => {
    const result = validateChatRequest({
      ...baseBody,
      contextTokenIds: [7, 7, 9],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.contextTokenIds).toEqual([7, 9]);
  });

  it("rejects non-array context token ids", () => {
    const result = validateChatRequest({
      ...baseBody,
      contextTokenIds: "12",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("contextTokenIds");
  });
});
