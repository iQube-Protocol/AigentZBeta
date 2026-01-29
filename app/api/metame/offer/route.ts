import { NextRequest, NextResponse } from "next/server";
import { receiptService } from "@/services/receipts/receiptService";
import {
  createSessionRecord,
  getSessionRecord,
  updateSessionRecord,
} from "@/services/composer/composerPersistence";
import { createIQube, shareIQube, isQubeBaseConfigured } from "@/app/(shell)/copilot/services/qubebase";

export const runtime = "nodejs";

const DEFAULT_OFFER = {
  id: "metame-smart-offer",
  title: "Smart Offer",
  description: "Earn rewards by completing this guided offer.",
  amount: 40,
  currency: "Q¢",
};

type OfferSessionData = {
  offerId: string;
  offerTitle: string;
  offerDescription: string;
  amount: number;
  currency: string;
  consentGiven: boolean;
  iqubeId?: string | null;
  iqubeShared?: boolean;
  settlement?: { amount: number; currency: string; receiptId?: string } | null;
  inviteToken: string;
  participants: string[];
  receipts: Array<{
    id: string;
    action: string;
    createdAt: string;
    receiptId: string;
  }>;
};

function buildReceiptEntry(action: string, receiptId: string) {
  return {
    id: `receipt_${action}_${Date.now()}`,
    action,
    createdAt: new Date().toISOString(),
    receiptId,
  };
}

async function appendReceipt(sessionId: string, action: string, receiptId: string) {
  const session = await getSessionRecord(sessionId);
  if (!session) return null;
  const data = (session.data || {}) as OfferSessionData;
  const receipts = Array.isArray(data.receipts) ? data.receipts : [];
  const nextReceipts = [...receipts, buildReceiptEntry(action, receiptId)];
  return updateSessionRecord(sessionId, {
    data: {
      ...data,
      receipts: nextReceipts,
    },
  });
}

function ensurePersonaLabel(personaId?: string | null) {
  return personaId && personaId.length > 0 ? personaId : "guest";
}

function buildSessionData(offerId: string, personaId: string): OfferSessionData {
  return {
    offerId,
    offerTitle: DEFAULT_OFFER.title,
    offerDescription: DEFAULT_OFFER.description,
    amount: DEFAULT_OFFER.amount,
    currency: DEFAULT_OFFER.currency,
    consentGiven: false,
    iqubeId: null,
    iqubeShared: false,
    settlement: null,
    inviteToken: offerId,
    participants: [personaId],
    receipts: [],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body?.action as string | undefined;

    if (!action) {
      return NextResponse.json({ success: false, error: "action is required" }, { status: 400 });
    }

    const personaId = ensurePersonaLabel(body?.personaId);
    const tenantId = body?.tenantId || "tenant-main";

    if (action === "create") {
      const offerId = body?.offerId || DEFAULT_OFFER.id;
      const sessionId = `offer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const data = buildSessionData(offerId, personaId);
      data.inviteToken = sessionId;

      const session = await createSessionRecord({
        id: sessionId,
        tenant_id: tenantId,
        user_id: personaId,
        template_id: "metame_smart_offer",
        current_step: 0,
        status: "active",
        data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      });

      const receipt = await receiptService.createSmartTriadReceipt({
        action: "create_experience",
        component: "metame_offer",
        personaId,
        tenantId,
        result: { sessionId, offerId },
      });
      await appendReceipt(session.id, "create_experience", receipt.receiptId);
      const refreshed = await getSessionRecord(session.id);

      return NextResponse.json({ success: true, session: refreshed || session });
    }

    const sessionId = body?.sessionId as string | undefined;
    if (!sessionId) {
      return NextResponse.json({ success: false, error: "sessionId is required" }, { status: 400 });
    }

    const session = await getSessionRecord(sessionId);
    if (!session) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    const sessionData = (session.data || {}) as OfferSessionData;

    if (action === "join") {
      const participants = Array.isArray(sessionData.participants) ? sessionData.participants : [];
      const nextParticipants = participants.includes(personaId)
        ? participants
        : [...participants, personaId];

      const updated = await updateSessionRecord(sessionId, {
        data: {
          ...sessionData,
          participants: nextParticipants,
        },
      });

      const receipt = await receiptService.createSmartTriadReceipt({
        action: "open_experience",
        component: "metame_offer",
        personaId,
        tenantId,
        result: { sessionId },
      });
      await appendReceipt(sessionId, "open_experience", receipt.receiptId);
      const refreshed = await getSessionRecord(sessionId);

      return NextResponse.json({ success: true, session: refreshed || updated || session });
    }

    if (action === "consent") {
      const updated = await updateSessionRecord(sessionId, {
        data: {
          ...sessionData,
          consentGiven: true,
        },
        current_step: Math.max(session.current_step, 1),
      });

      const receipt = await receiptService.createSmartTriadReceipt({
        action: "offer_consent",
        component: "metame_offer",
        personaId,
        tenantId,
        result: { sessionId, offerId: sessionData.offerId },
      });
      await appendReceipt(sessionId, "offer_consent", receipt.receiptId);
      const refreshed = await getSessionRecord(sessionId);

      return NextResponse.json({ success: true, session: refreshed || updated || session });
    }

    if (action === "iqube") {
      const name = body?.iqubeName || "metaMe Offer iQube";
      const type = body?.iqubeType || "DataQube";

      let iqubeId: string | null = null;
      let createdFromQubeBase = false;
      if (isQubeBaseConfigured()) {
        const result = await createIQube({
          tenantId,
          type,
          name,
          description: "Smart Offer micro-experience context",
        });
        if (result.success && result.iqube) {
          iqubeId = result.iqube.id;
          createdFromQubeBase = true;
        }
      }

      if (!iqubeId) {
        iqubeId = `iqube_${Date.now()}`;
      }

      const updated = await updateSessionRecord(sessionId, {
        data: {
          ...sessionData,
          iqubeId,
          iqubeShared: sessionData.iqubeShared ?? false,
        },
        current_step: Math.max(session.current_step, 2),
      });

      const receipt = await receiptService.createSmartTriadReceipt({
        action: "offer_iqube_created",
        component: "metame_offer",
        personaId,
        tenantId,
        result: { sessionId, iqubeId, createdFromQubeBase },
      });
      await appendReceipt(sessionId, "offer_iqube_created", receipt.receiptId);
      const refreshed = await getSessionRecord(sessionId);

      return NextResponse.json({ success: true, session: refreshed || updated || session, iqubeId, createdFromQubeBase });
    }

    if (action === "share_iqube") {
      const shareWithPersonaId = body?.shareWithPersonaId as string | undefined;
      const shareWithTenantId = body?.shareWithTenantId as string | undefined;
      const accessLevel = body?.accessLevel || "metaqube";

      if (!sessionData.iqubeId) {
        return NextResponse.json({ success: false, error: "No iQube to share" }, { status: 400 });
      }

      let shareResult: { success: boolean; error?: string; mock?: boolean } = { success: false, error: "QubeBase not configured" };
      if (isQubeBaseConfigured()) {
        const result = await shareIQube({
          iQubeId: sessionData.iqubeId,
          ownerPersonaId: personaId,
          sharedWithPersonaId: shareWithPersonaId,
          sharedWithTenantId: shareWithTenantId,
          accessLevel,
        });
        shareResult = { success: result.success, error: result.error };
      } else {
        shareResult = { success: true, mock: true };
      }

      const updated = await updateSessionRecord(sessionId, {
        data: {
          ...sessionData,
          iqubeShared: shareResult.success,
        },
        current_step: Math.max(session.current_step, 2),
      });

      const receipt = await receiptService.createSmartTriadReceipt({
        action: "offer_iqube_shared",
        component: "metame_offer",
        personaId,
        tenantId,
        result: { sessionId, success: shareResult.success, mock: shareResult.mock },
      });
      await appendReceipt(sessionId, "offer_iqube_shared", receipt.receiptId);
      const refreshed = await getSessionRecord(sessionId);

      return NextResponse.json({ success: shareResult.success, session: refreshed || updated || session, error: shareResult.error || null, mock: shareResult.mock || false });
    }

    if (action === "settle") {
      const amount = Number(body?.amount ?? sessionData.amount ?? DEFAULT_OFFER.amount);
      const currency = String(body?.currency ?? sessionData.currency ?? DEFAULT_OFFER.currency);

      const updated = await updateSessionRecord(sessionId, {
        data: {
          ...sessionData,
          settlement: { amount, currency },
        },
        current_step: Math.max(session.current_step, 3),
      });

      const receipt = await receiptService.createSmartTriadReceipt({
        action: "offer_settlement",
        component: "metame_offer",
        personaId,
        tenantId,
        result: { sessionId, amount, currency },
      });
      await appendReceipt(sessionId, "offer_settlement", receipt.receiptId);
      const refreshed = await getSessionRecord(sessionId);

      return NextResponse.json({ success: true, session: refreshed || updated || session, receiptId: receipt.receiptId });
    }

    if (action === "share") {
      const receipt = await receiptService.createSmartTriadReceipt({
        action: "offer_invite",
        component: "metame_offer",
        personaId,
        tenantId,
        result: { sessionId },
      });
      await appendReceipt(sessionId, "offer_invite", receipt.receiptId);
      const refreshed = await getSessionRecord(sessionId);

      return NextResponse.json({ success: true, session: refreshed || session, inviteToken: sessionId, receiptId: receipt.receiptId });
    }

    return NextResponse.json({ success: false, error: `Unsupported action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error("[metaMe Offer] error:", error);
    return NextResponse.json({ success: false, error: error.message || "Offer flow failed" }, { status: 500 });
  }
}
