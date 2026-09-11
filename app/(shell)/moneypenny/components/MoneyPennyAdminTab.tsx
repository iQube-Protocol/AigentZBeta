/**
 * MoneyPennyAdminTab — MoneyPenny's native, admin-only tab (navigation-
 * hierarchy correction, 2026-09-03: "Admin is visible and accessible only
 * to authorized administrators. Reuse existing administrative functions;
 * if none belong here yet, provide an honest admin-only placeholder rather
 * than inventing functionality. Do not duplicate Qriptopian's bridge
 * editorial admin.").
 *
 * Audited before writing this file (No-Guessing discipline): the pre-
 * collapse `MONEYPENNY_CARTRIDGE` (git history, commit 95277c77b) had a
 * group LABELLED "Administer" — but its one tab (`identity`, FIO/persona
 * management) was `adminOnly: false`, i.e. never actually gated to
 * administrators. No genuinely admin-only MoneyPenny capability exists
 * anywhere in this codebase today. `identity` already lives correctly
 * under the My Money area's own carousel (moneypennyCapabilities.ts) —
 * it is NOT moved here, since it was never an administrative function.
 *
 * This is therefore an honest placeholder, not a stub pretending to be a
 * real surface: it names what MoneyPenny administration will eventually
 * need (per the two capabilities named directly in this cartridge's own
 * spec history — service-level operational oversight and constitutional
 * runtime configuration) without fabricating buttons, data, or controls
 * that do nothing. Qriptopian's own Bridge editorial admin
 * (`QriptopianAdminTab.tsx`) is a SEPARATE, already-built surface for a
 * different cartridge's content — deliberately not reused, embedded, or
 * duplicated here.
 */

'use client';

import { ShieldAlert } from 'lucide-react';

export function MoneyPennyAdminTab() {
  return (
    <div className="flex h-full w-full items-start justify-center bg-slate-950 p-8">
      <div className="max-w-xl space-y-4 rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-400" />
          <h2 className="text-sm font-semibold text-slate-100">MoneyPenny Administration</h2>
        </div>
        <p className="text-sm text-slate-400">
          No MoneyPenny-specific administrative functions exist yet. This tab is a placeholder,
          gated to administrators, reserved for capabilities such as:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-400">
          <li>Service-level configuration for the Constitutional Financial Services Runtime</li>
          <li>Operational oversight of admitted agents consuming MoneyPenny Financial Services</li>
        </ul>
        <p className="text-xs text-slate-600">
          Nothing here is functional yet — no data is fetched, no action can be taken. When a real
          administrative capability is built, it belongs on this tab rather than a new one.
        </p>
      </div>
    </div>
  );
}

export default MoneyPennyAdminTab;
