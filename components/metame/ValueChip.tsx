import React from "react";
import { cn } from "@/utils/cn";

type ValueChipContext = "wallet" | "content" | "offer";

interface ValueChipProps {
  amount: number;
  currency: string;
  context?: ValueChipContext;
  isKnytOffer?: boolean;
  className?: string;
}

const QCT_ALIASES = new Set(["QCT", "Q¢", "QC", "QCTOKEN", "QCOIN"]);

function formatUsd(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatQct(value: number) {
  return `${value.toLocaleString()} Q¢`;
}

function resolveDisplay({
  amount,
  currency,
  context = "content",
  isKnytOffer = false,
}: {
  amount: number;
  currency: string;
  context?: ValueChipContext;
  isKnytOffer?: boolean;
}) {
  const normalizedCurrency = currency?.toUpperCase?.() || "";
  const isQct = QCT_ALIASES.has(normalizedCurrency);
  const isUsd = normalizedCurrency === "USD" || normalizedCurrency === "$";
  const isKnyt = normalizedCurrency === "$KNYT" || normalizedCurrency === "KNYT";

  if (isKnyt && isKnytOffer) {
    return {
      primary: `${amount.toLocaleString()} $KNYT`,
      secondary: undefined,
    };
  }

  if (isQct) {
    const usdEquivalent = amount / 100;
    return {
      primary: formatQct(amount),
      secondary: formatUsd(usdEquivalent),
    };
  }

  if (isUsd) {
    return {
      primary: formatUsd(amount),
      secondary: undefined,
    };
  }

  if (isKnyt) {
    return {
      primary: `${amount.toLocaleString()} KNYT`,
      secondary: undefined,
    };
  }

  return {
    primary: `${amount.toLocaleString()} ${currency}`,
    secondary: undefined,
  };
}

export function ValueChip({ amount, currency, context = "content", isKnytOffer = false, className }: ValueChipProps) {
  const display = resolveDisplay({ amount, currency, context, isKnytOffer });

  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full bg-slate-900/70 px-2.5 py-1 text-xs", className)}>
      <span className="font-semibold text-white">{display.primary}</span>
      {display.secondary && <span className="text-[11px] text-slate-400">{display.secondary}</span>}
    </div>
  );
}
