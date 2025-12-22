import { NextRequest, NextResponse } from "next/server";
import { quoteSkuOffers } from "@/services/wallet/knyt/knytSkuQuoteService";
import type { PricingKind } from "@/types/smartContent";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const sku = searchParams.get("sku");
    const personaId = searchParams.get("personaId") || undefined;
    const tierKind = (searchParams.get("tierKind") || undefined) as PricingKind | undefined;

    if (!sku) {
      return NextResponse.json({ success: false, error: "sku is required" }, { status: 400 });
    }

    const result = await quoteSkuOffers({ sku, personaId, tierKind });
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("[Pricing Quote API] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
