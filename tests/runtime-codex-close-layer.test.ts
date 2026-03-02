import { describe, expect, it } from "vitest";

import {
  buildLaunchMessageId,
  readCodexClose,
  shouldDismissForCodexClose,
} from "@/components/metame/runtimeCloseLayer";

describe("runtimeCloseLayer", () => {
  it("builds codex launch ids with codex prefix", () => {
    const id = buildLaunchMessageId({ runtimeSource: "codex", runtimeCodexSlug: "knyt" }, 1700000000000);
    expect(id).toBe("capsule-launch-codex-knyt-codex-1700000000000");
  });

  it("parses close payload and normalizes codex id", () => {
    const close = readCodexClose({
      type: "METAME_CODEX_CLOSE_LAYER",
      codex_slug: "qripto",
    });
    expect(close).toEqual({ isClose: true, codexId: "qripto-codex" });
  });

  it("dismisses only targeted codex panel messages", () => {
    expect(
      shouldDismissForCodexClose(
        { id: "capsule-launch-codex-knyt-codex-1", variant: "panel" },
        "knyt-codex"
      )
    ).toBe(true);

    expect(
      shouldDismissForCodexClose(
        { id: "capsule-launch-codex-qripto-codex-1", variant: "panel" },
        "knyt-codex"
      )
    ).toBe(false);

    expect(
      shouldDismissForCodexClose({ id: "capsule-panel", variant: "panel" }, "knyt-codex")
    ).toBe(false);
  });
});
