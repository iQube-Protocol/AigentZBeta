import type {
  SmartContentActionEventDetail,
  SmartWalletEventMeta,
  SmartWalletOpenDrawerEventDetail,
  SmartWalletPaymentEventDetail,
  SmartWalletSurface,
} from "@/app/wallet/contracts";

export const SMART_WALLET_EVENTS = {
  overlayPayment: "overlayPayment",
  embeddedPayment: "embeddedPayment",
  liquidPayment: "liquidUIPayment",
  openDrawer: "openSmartWalletDrawer",
  smartContentAction: "smartContentAction",
} as const;

export type SmartWalletEventName =
  (typeof SMART_WALLET_EVENTS)[keyof typeof SMART_WALLET_EVENTS];

export interface SmartWalletEventPayloadMap {
  [SMART_WALLET_EVENTS.overlayPayment]: SmartWalletPaymentEventDetail;
  [SMART_WALLET_EVENTS.embeddedPayment]: SmartWalletPaymentEventDetail;
  [SMART_WALLET_EVENTS.liquidPayment]: SmartWalletPaymentEventDetail;
  [SMART_WALLET_EVENTS.openDrawer]: SmartWalletOpenDrawerEventDetail;
  [SMART_WALLET_EVENTS.smartContentAction]: SmartContentActionEventDetail;
}

const PAYMENT_EVENT_BY_SURFACE: Record<SmartWalletSurface, SmartWalletEventName> = {
  overlay: SMART_WALLET_EVENTS.overlayPayment,
  embedded: SMART_WALLET_EVENTS.embeddedPayment,
  liquid: SMART_WALLET_EVENTS.liquidPayment,
};

function createEventMeta(source: string): SmartWalletEventMeta {
  const eventId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    eventId,
    timestamp: Date.now(),
    source,
  };
}

export function dispatchSmartWalletEvent<TEvent extends SmartWalletEventName>(
  eventName: TEvent,
  detail: SmartWalletEventPayloadMap[TEvent]
): boolean {
  if (typeof window === "undefined") return false;
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
  return true;
}

export function dispatchSmartWalletPayment(
  surface: SmartWalletSurface,
  detail: Omit<SmartWalletPaymentEventDetail, "meta" | "paymentSurface"> & {
    paymentSurface?: SmartWalletSurface;
  },
  source = "smartcontent-action-context"
): boolean {
  const eventName = PAYMENT_EVENT_BY_SURFACE[surface];
  return dispatchSmartWalletEvent(eventName, {
    ...detail,
    paymentSurface: detail.paymentSurface ?? surface,
    meta: createEventMeta(source),
  });
}

export function dispatchOpenSmartWalletDrawer(
  detail: Omit<SmartWalletOpenDrawerEventDetail, "meta">,
  source = "smartcontent-action-context"
): boolean {
  return dispatchSmartWalletEvent(SMART_WALLET_EVENTS.openDrawer, {
    ...detail,
    meta: createEventMeta(source),
  });
}

export function dispatchSmartContentAction(
  detail: Omit<SmartContentActionEventDetail, "meta">,
  source = "smartcontent-action-context"
): boolean {
  return dispatchSmartWalletEvent(SMART_WALLET_EVENTS.smartContentAction, {
    ...detail,
    meta: createEventMeta(source),
  });
}

export function addSmartWalletEventListener<TEvent extends SmartWalletEventName>(
  eventName: TEvent,
  handler: (
    detail: SmartWalletEventPayloadMap[TEvent],
    event: CustomEvent<SmartWalletEventPayloadMap[TEvent]>
  ) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<SmartWalletEventPayloadMap[TEvent]>;
    handler(customEvent.detail, customEvent);
  };

  window.addEventListener(eventName, listener as EventListener);
  return () => {
    window.removeEventListener(eventName, listener as EventListener);
  };
}
