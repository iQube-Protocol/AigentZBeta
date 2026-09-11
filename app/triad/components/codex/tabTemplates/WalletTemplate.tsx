"use client";

/**
 * WalletTemplate — cartridge-scoped wallet surface.
 *
 * Phase 9 of the myCartridge PRD §19.
 *
 * Renders the embedded `SmartWalletDrawer` inside the cartridge wallet
 * tab, using the cartridge identity as the agent context and forwarding
 * `cartridgeSlug` for cartridge-scoped affordances (set-as-default
 * persona, etc., that the drawer already supports).
 *
 * The runtime shell already wraps the tab tree in SmartTriadProvider,
 * so the drawer reads its own state internally — no extra provider
 * wiring is needed. The mount pattern mirrors
 * `app/components/codex/CodexCopilotLayer.tsx:1694` which uses
 * `variant="embedded"` + a small `agent: {id, name}` object + personaId.
 *
 * Phase 9b deferred:
 *   - TransactionModal `mode: 'request'` (TransactionTab union
 *     extension; payment-request flow per PRD §19).
 *   - Cartridge token-whitelist EVM filter pushed into the drawer
 *     (today the drawer shows the persona's full token list; the
 *     cartridge config carries the whitelist but the drawer doesn't
 *     filter on it yet).
 *
 * Phase 9 (this file) delivers:
 *   - Real embedded wallet inside the cartridge wallet tab.
 *   - Cartridge wallet posture summary (token whitelist + enabled
 *     primitives) rendered above the drawer so the operator can see
 *     what the cartridge declares vs. what the drawer surfaces.
 *   - Owner-only payment-request CTA stub.
 *   - Graceful empty states: wallet disabled, cartridge lookup failed,
 *     no active persona.
 */

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Wallet, Coins, Check, X, Send, Download, FileText, Gift } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import type { TabTemplateProps } from "./types";

// Dynamic import mirrors the pattern from CodexCopilotLayer — breaks the
// SmartWalletDrawer ↔ SmartTriadProvider circular dependency at build time.
const SmartWalletDrawer = dynamic(
  () => import("@/app/components/content/SmartWalletDrawer"),
  { ssr: false },
);

interface CartridgeWalletConfig {
  enabled: boolean;
  tokenWhitelist: string[];
  primitives: {
    cryptoSend: boolean;
    cryptoReceive: boolean;
    paymentRequest: boolean;
    rewardPayout: boolean;
  };
}

interface CartridgeFetchResult {
  ok: boolean;
  cartridge?: {
    title: string;
    tokenWhitelist?: string[];
    smartTriadConfig?: { wallet?: CartridgeWalletConfig } | null;
  };
  caller?: { canEdit: boolean };
  error?: string;
}

const TOKEN_LABEL: Record<string, string> = {
  "q-cent": "Q¢",
  usdc: "USDC",
  knyt: "KNYT",
};

const PRIMITIVE_META: Array<{
  key: keyof CartridgeWalletConfig["primitives"];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "cryptoSend", label: "Crypto send", icon: Send },
  { key: "cryptoReceive", label: "Crypto receive", icon: Download },
  { key: "paymentRequest", label: "Payment request", icon: FileText },
  { key: "rewardPayout", label: "Reward payout", icon: Gift },
];

export function WalletTemplate({ cartridgeSlug, personaId, theme }: TabTemplateProps) {
  const dark = theme === "dark";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<CartridgeWalletConfig | null>(null);
  const [title, setTitle] = useState<string>(cartridgeSlug);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await personaFetch(`/api/cartridge/${encodeURIComponent(cartridgeSlug)}`);
        const body = (await res.json()) as CartridgeFetchResult;
        if (cancelled) return;
        if (!res.ok || !body.ok || !body.cartridge) {
          setError(body.error ?? `lookup failed (${res.status})`);
          return;
        }
        setTitle(body.cartridge.title);
        setCanEdit(Boolean(body.caller?.canEdit));
        const cfg = body.cartridge.smartTriadConfig?.wallet;
        const whitelist =
          cfg?.tokenWhitelist && cfg.tokenWhitelist.length > 0
            ? cfg.tokenWhitelist
            : (body.cartridge.tokenWhitelist ?? []);
        const enabledBase = cfg?.enabled ?? whitelist.length > 0;
        setWallet({
          enabled: enabledBase,
          tokenWhitelist: whitelist,
          primitives: cfg?.primitives ?? {
            cryptoSend: false,
            cryptoReceive: false,
            paymentRequest: false,
            rewardPayout: false,
          },
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cartridgeSlug]);

  const surfaceClass = dark
    ? "bg-slate-900/50 border-slate-700 text-slate-200"
    : "bg-white border-slate-200 text-slate-900";
  const mutedClass = dark ? "text-slate-400" : "text-slate-600";
  const chipClass = dark
    ? "bg-slate-800 text-slate-200 border-slate-700"
    : "bg-slate-100 text-slate-700 border-slate-200";

  if (loading) {
    return (
      <div className={`p-6 rounded-lg border ${surfaceClass}`}>
        <p className={`text-sm ${mutedClass}`}>Loading wallet configuration…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 rounded-lg border ${surfaceClass}`}>
        <h2 className="text-lg font-semibold mb-1">Wallet</h2>
        <p className="text-sm text-amber-400">Could not load cartridge config: {error}</p>
        <p className={`text-xs mt-2 ${mutedClass}`}>
          The cartridge config endpoint requires the persona to hold a role on this cartridge.
        </p>
      </div>
    );
  }

  if (!wallet || !wallet.enabled) {
    return (
      <div className={`p-6 rounded-lg border ${surfaceClass}`}>
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Wallet</h2>
        </div>
        <p className={`text-sm ${mutedClass}`}>
          The wallet is not enabled on <strong>{title}</strong>. The owner can enable it from
          the cartridge manager (Triad &gt; Wallet).
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${dark ? "text-slate-200" : "text-slate-900"}`}>
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          <h2 className="text-lg font-semibold">{title} — Wallet</h2>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded border ${chipClass}`}>
          {cartridgeSlug}
        </span>
      </header>

      {/* Cartridge wallet posture summary */}
      <section className={`p-4 rounded-lg border ${surfaceClass}`}>
        <h3 className={`text-sm font-medium mb-2 ${mutedClass}`}>Accepted tokens</h3>
        {wallet.tokenWhitelist.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {wallet.tokenWhitelist.map((tokenId) => (
              <span
                key={tokenId}
                className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${chipClass}`}
              >
                <Coins className="w-3 h-3" />
                {TOKEN_LABEL[tokenId] ?? tokenId}
              </span>
            ))}
          </div>
        ) : (
          <p className={`text-sm ${mutedClass}`}>No tokens whitelisted yet.</p>
        )}
        <h3 className={`text-sm font-medium mt-4 mb-2 ${mutedClass}`}>Wallet primitives</h3>
        <ul className="space-y-2">
          {PRIMITIVE_META.map((p) => {
            const enabled = wallet.primitives[p.key];
            const Icon = p.icon;
            return (
              <li key={p.key} className="flex items-center gap-3 text-sm">
                <Icon className={`w-4 h-4 ${enabled ? "" : mutedClass}`} />
                <span className={enabled ? "" : mutedClass}>{p.label}</span>
                <span className="ml-auto">
                  {enabled ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <X className={`w-4 h-4 ${mutedClass}`} />
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Embedded SmartWalletDrawer — the real wallet surface. The
          runtime shell already wraps this tree in SmartTriadProvider so
          the drawer reads its own state internally. The `agent` prop
          carries the cartridge identity so the drawer header reads as
          the cartridge title rather than the visitor's persona name. */}
      {personaId ? (
        <section
          className={`rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl ${surfaceClass}`}
        >
          <SmartWalletDrawer
            open={true}
            onClose={() => {
              // Cartridge wallet tab is always-open — the close handler is a
              // no-op since the surface IS the wallet. The drawer's own X
              // button is hidden via the embedded variant.
            }}
            variant="embedded"
            embeddedWidth="fill"
            embeddedAnchor="left"
            allowWideLayout={true}
            codexMode={true}
            personaId={personaId}
            cartridgeSlug={cartridgeSlug}
            agent={{
              id: cartridgeSlug,
              name: title,
            }}
            initialTab="wallet"
          />
        </section>
      ) : (
        <section className={`p-4 rounded-lg border ${surfaceClass}`}>
          <p className={`text-sm ${mutedClass}`}>
            Sign in with an active persona to use the wallet.
          </p>
        </section>
      )}

      {/* Owner-only payment request CTA stub */}
      {canEdit && wallet.primitives.paymentRequest && (
        <section className={`p-4 rounded-lg border ${surfaceClass}`}>
          <h3 className={`text-sm font-medium mb-2 ${mutedClass}`}>Payment request</h3>
          <p className={`text-sm mb-3 ${mutedClass}`}>
            Generate a shareable payment request payload — the visitor sees a pre-filled
            TransactionModal with the recipient and amount locked.
          </p>
          <button
            type="button"
            disabled
            className="px-3 py-1.5 rounded text-sm bg-violet-500/20 border border-violet-500/30 text-violet-300 cursor-not-allowed opacity-70"
            title="Phase 9b — TransactionModal mode='request' wiring lands next"
          >
            Request payment (Phase 9b)
          </button>
        </section>
      )}

      <p className={`text-xs ${mutedClass}`}>
        Template: wallet-v1 · Phase 9. Token-whitelist push into the drawer EVM filter +
        TransactionModal mode='request' land in Phase 9b.
      </p>
    </div>
  );
}
