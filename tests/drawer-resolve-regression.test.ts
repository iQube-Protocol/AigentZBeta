import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/drawer/resolve/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/api/drawer/resolve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("/api/drawer/resolve regression", () => {
  it("resolves with query-only payload (no top-level persona/app/tenant/device)", async () => {
    const req = makeRequest({
      query: {
        appId: "metaKnyts",
        tenantId: "tenant-main",
        personaId: "metaKnyts",
      },
    });

    const res = await POST(req as any);

    expect(res.status).toBe(200);

    const json = await res.json();

    expect(json.drawerSet?.id).toBeTruthy();
    expect(json.drawerSet?.appId).toBe("metaKnyts");
    expect(json.filtered?.drawers?.length).toBeGreaterThan(0);
    expect(json.context?.device).toBe("mobile");
  });
});
