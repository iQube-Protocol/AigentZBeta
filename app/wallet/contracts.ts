import type { ActionType, SmartContentItem } from "@/packages/smarttriad/src/types";

export type SmartWalletSurface = "overlay" | "embedded" | "liquid";

export type SmartWalletDrawerTab =
  | "wallet"
  | "library"
  | "tasks"
  | "reputation"
  | "rewards";

export interface SmartWalletEventMeta {
  eventId: string;
  timestamp: number;
  source: string;
}

export interface SmartWalletPrice {
  amount: number;
  currency: string;
  paymentType?: "one-time" | "subscription";
}

export interface SmartWalletContentPayload {
  id: string;
  title: string;
  description?: string;
  excerpt?: string;
  image?: string;
  section?: string;
  type?: string;
  modalities?: SmartContentItem["modalities"];
  pdf_cid?: string;
  pdf_master_id?: string;
  created_at?: string;
  updated_at?: string;
  pricingModel?: {
    tiers: Array<{
      kind: "one-time" | "subscription";
      amount: number;
      currency: string;
    }>;
  };
}

export interface SmartWalletPaymentEventDetail {
  item: SmartWalletContentPayload;
  price?: SmartWalletPrice;
  paymentSurface?: SmartWalletSurface;
  meta?: SmartWalletEventMeta;
}

export interface SmartWalletOpenDrawerEventDetail {
  currentContent?: SmartWalletContentPayload;
  open?: boolean;
  variant?: "overlay" | "embedded";
  tab?: SmartWalletDrawerTab;
  meta?: SmartWalletEventMeta;
}

export interface SmartContentActionEventDetail {
  item: SmartContentItem;
  action: ActionType;
  playlist?: SmartContentItem[];
  meta?: SmartWalletEventMeta;
}
