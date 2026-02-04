import { selectCompassActions } from "@/services/content/smartMenuIntegration";
import type { SmartContentQube } from "@/types/smartContent";

describe("compass menu policy", () => {
  const paidContent = {
    id: "content-1",
    title: "Test Offer",
    pricingModel: {
      tiers: [{ amount: 10, currency: "QCT", kind: "paid" }],
    },
    modalities: {
      read: { enabled: true },
      watch: { enabled: false },
      listen: { enabled: false },
      interact: { enabled: false },
    },
    rewardOutcomes: { engagementRewards: [] },
  } as unknown as SmartContentQube;

  it("caps primary actions at 3 and secondary at 2", () => {
    const actions = selectCompassActions({
      directive: "buy now",
      content: paidContent,
      ownedContent: false,
      hasActivePersona: false,
      mode: "runtime",
    });

    const primary = actions.filter((action) => action.isPrimary);
    const secondary = actions.filter((action) => !action.isPrimary);

    expect(primary.length).toBeLessThanOrEqual(3);
    expect(secondary.length).toBeLessThanOrEqual(2);
  });

  it("switches Pay label to Buy when directive indicates purchase", () => {
    const actions = selectCompassActions({
      directive: "buy this offer",
      content: paidContent,
      ownedContent: false,
      hasActivePersona: true,
      mode: "runtime",
    });

    expect(actions.some((action) => action.label === "Buy")).toBe(true);
  });

  it("includes Be as a secondary action when persona is inactive", () => {
    const actions = selectCompassActions({
      directive: "explore",
      content: paidContent,
      ownedContent: true,
      hasActivePersona: false,
      mode: "runtime",
    });

    expect(actions.some((action) => action.label === "Be" && !action.isPrimary)).toBe(true);
  });
});
