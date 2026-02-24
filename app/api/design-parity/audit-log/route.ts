import { NextRequest, NextResponse } from "next/server";
import { receiptService } from "@/services/receipts/receiptService";

export const runtime = "nodejs";

type AuditAction =
  | "pipeline_run"
  | "pipeline_error"
  | "remedy_proposed"
  | "remedy_applied"
  | "remedy_rejected";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const experienceId = String(body?.experienceId || "");
    const tenantId = String(body?.tenantId || "");
    const userId = String(body?.userId || "");
    const action = String(body?.action || "") as AuditAction;
    const summary = String(body?.summary || "");
    const details = body?.details || {};

    if (!experienceId || !action) {
      return NextResponse.json(
        {
          success: false,
          error: "experienceId and action are required",
        },
        { status: 400 }
      );
    }

    const receipt = await receiptService.createSmartTriadReceipt({
      action: `design_parity_${action}`,
      component: "agentic-design-parity",
      personaId: userId || undefined,
      tenantId: tenantId || undefined,
      result: {
        experienceId,
        summary,
        details,
      },
    });

    let dvnEvent: Record<string, any> = {
      id: null,
      status: "pending",
      createdAt: new Date().toISOString(),
      source: "design-parity",
      eventType: `design_parity_${action}`,
      payload: {
        experienceId,
        summary,
      },
      receiptId: receipt.receiptId,
    };

    try {
      const dvnResponse = await fetch(new URL("/api/ops/dvn/receipt", request.nextUrl.origin), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: `design_parity_${action}`,
          contentId: experienceId,
          personaId: userId || undefined,
          issue: summary.slice(0, 180),
          source: "COMPOSER",
          receiptId: receipt.receiptId,
          metadata: {
            tenantId,
            experienceId,
            action,
            summary,
            details,
          },
        }),
      });

      const dvnData = await dvnResponse.json().catch(() => ({}));
      if (dvnResponse.ok && dvnData?.ok && dvnData?.messageId) {
        dvnEvent = {
          ...dvnEvent,
          id: dvnData.messageId,
          status: "submitted",
          responseAt: new Date().toISOString(),
        };
      } else {
        dvnEvent = {
          ...dvnEvent,
          status: "failed",
          error: dvnData?.error || "DVN receipt route returned an error",
          responseAt: new Date().toISOString(),
        };
      }
    } catch (dvnError: any) {
      dvnEvent = {
        ...dvnEvent,
        status: "failed",
        error: dvnError?.message || "DVN routing failed",
        responseAt: new Date().toISOString(),
      };
    }

    return NextResponse.json({
      success: true,
      receipt,
      dvnEvent,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to create DPR audit log",
      },
      { status: 500 }
    );
  }
}
