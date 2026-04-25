import { describe, expect, it } from "vitest";
import {
  MAX_CONTEXT_SERIALIZED_CHARS,
  resolveSelectedIqubeContexts,
} from "../utilities/chatContextResolver";

describe("resolveSelectedIqubeContexts", () => {
  const wallet = "0x1111111111111111111111111111111111111111";

  it("resolves encrypted iQube context via client-side decrypt", async () => {
    const result = await resolveSelectedIqubeContexts(
      {
        tokenIds: [12],
        walletAddress: wallet,
      },
      {
        ownerOfFn: async () => "0x2222222222222222222222222222222222222222",
        hasAccessGrantFn: async () => true,
        getMetaQubeLocationFn: async () => "https://gateway.autonomys.xyz/file/fakecid",
        fetchJsonFn: async () => ({
          name: "Tax Profile",
          attributes: [
            { trait_type: "isEncrypted", value: true },
            {
              trait_type: "blakQube",
              value: JSON.stringify({
                iv: "a1",
                authTag: "b2",
                encryptedData: "c3",
              }),
            },
          ],
        }),
        fetchKeyRowFn: async () => ({
          encrypted_key: "cipher",
          key_encryption_iv: "iv",
        }),
        requestDekFn: async () => "deadbeef",
        decryptFn: async () => ({ ssn: "111-22-3333", filingStatus: "single" }),
      }
    );

    expect(result.hasEncryptedContext).toBe(true);
    expect(result.contexts).toHaveLength(1);
    expect(result.contexts[0].isEncrypted).toBe(true);
    expect(result.contexts[0].payload).toEqual({
      ssn: "111-22-3333",
      filingStatus: "single",
    });
    expect(result.systemMessage.role).toBe("system");
    expect(result.systemMessage.content).toContain("iQube context");
  });

  it("blocks unauthorized token usage", async () => {
    await expect(
      resolveSelectedIqubeContexts(
        {
          tokenIds: [9],
          walletAddress: wallet,
        },
        {
          ownerOfFn: async () => "0x2222222222222222222222222222222222222222",
          hasAccessGrantFn: async () => false,
          getMetaQubeLocationFn: async () => "https://example.com/meta.json",
          fetchJsonFn: async () => ({}),
        }
      )
    ).rejects.toThrow("not authorized");
  });

  it("fails when serialized context exceeds size limit", async () => {
    await expect(
      resolveSelectedIqubeContexts(
        {
          tokenIds: [1],
          walletAddress: wallet,
        },
        {
          ownerOfFn: async () => wallet,
          hasAccessGrantFn: async () => true,
          getMetaQubeLocationFn: async () => "https://example.com/meta.json",
          fetchJsonFn: async () => ({
            name: "Oversized",
            attributes: [],
            huge: "x".repeat(MAX_CONTEXT_SERIALIZED_CHARS + 500),
          }),
        }
      )
    ).rejects.toThrow("too large");
  });
});
