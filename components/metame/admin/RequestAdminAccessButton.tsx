"use client";

/**
 * RequestAdminAccessButton — opens a small modal that lets a persona
 * submit a request for access to a cartridge.
 *
 * 2026-05-26 refinements: the alpha mistakenly conflated two flows.
 * Most requesters want runtime ACCESS to a cartridge (view + use it),
 * NOT admin scope (review queues, partner ops, gated admin tabs).
 * The modal now defaults to cartridge_access and surfaces an explicit
 * "request admin privileges instead" toggle for the rarer admin path.
 *
 * Submits to /api/admin/access-requests. The spine-gated route writes
 * a 'pending' row; a global admin decides via the Admin Access
 * Requests tab.
 *
 * Component supports two modes:
 *   - uncontrolled (default) — renders its own trigger button + modal.
 *   - controlled (open + onOpenChange) — parent owns open state; only
 *     the modal renders. Used by the welcome-surface pulse chip.
 */

import { useCallback, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info, ShieldCheck, Sparkles } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface Props {
  defaultCartridgeSlug?: string;
  className?: string;
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
}

const CARTRIDGE_OPTIONS: Array<{ slug: string | null; label: string }> = [
  { slug: 'metame', label: 'metaMe' },
  { slug: 'knyt-codex', label: 'KNYT' },
  { slug: 'qripto', label: 'The Qriptopian' },
  { slug: 'marketa', label: 'Marketa' },
  { slug: 'venture-lab', label: 'metaMe Venture Lab' },
  { slug: 'agentiq-os', label: 'AgentiQ OS' },
  // Global admin is intentionally NOT in this list. It's a much
  // narrower path and requires a separate flow (reviewer must opt in
  // explicitly; not a default the typical operator should land on).
];

type AccessKind = 'access' | 'admin';

export function RequestAdminAccessButton({
  defaultCartridgeSlug,
  className,
  open: controlledOpen,
  onOpenChange,
}: Props) {
  const isControlled = controlledOpen !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (isControlled) onOpenChange?.(next);
    else setUncontrolledOpen(next);
  };
  const [cartridgeSlug, setCartridgeSlug] = useState<string>(defaultCartridgeSlug ?? 'metame');
  const [accessKind, setAccessKind] = useState<AccessKind>('access');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const selectedLabel =
    CARTRIDGE_OPTIONS.find((o) => o.slug === cartridgeSlug)?.label ?? cartridgeSlug;

  const submit = useCallback(async () => {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await personaFetch('/api/admin/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedCartridgeSlug: cartridgeSlug,
          requestType: accessKind === 'admin' ? 'cartridge_admin' : 'cartridge_access',
          message: message.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setResult({
          ok: false,
          text: json.message || json.error || 'Submission failed.',
        });
        return;
      }
      setResult({
        ok: true,
        text:
          accessKind === 'admin'
            ? `Admin request submitted for ${selectedLabel}. A global admin will review it.`
            : `Access request submitted for ${selectedLabel}. A global admin will review it and you'll see the cartridge in your runtime once approved.`,
      });
      setMessage('');
    } catch (err) {
      setResult({ ok: false, text: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }, [cartridgeSlug, accessKind, message, selectedLabel]);

  return (
    <>
      {!isControlled && (
        <Button
          variant="outline"
          size="sm"
          className={`border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 ${className ?? ''}`}
          onClick={() => setOpen(true)}
        >
          <Sparkles className="w-4 h-4 mr-1.5" />
          Request alpha access — {selectedLabel}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-300" />
              Request alpha access
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-300">
            <div className="text-xs text-slate-400 leading-relaxed flex gap-2">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-500" />
              <span>
                This is an alpha release. Submit a request below; once a global admin
                approves you'll see the cartridge in your runtime and can use it. Admin
                privileges are a separate scope — toggle the option below only if you
                need to administer the cartridge (review queues, partner ops, gated
                admin tabs).
              </span>
            </div>

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-slate-400 mb-1 block">
                Cartridge
              </span>
              <select
                value={cartridgeSlug}
                onChange={(e) => setCartridgeSlug(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-slate-800/60 border border-slate-700 text-sm focus:outline-none focus:border-violet-500"
              >
                {CARTRIDGE_OPTIONS.map((opt) => (
                  <option key={opt.slug ?? '__global'} value={opt.slug ?? '__global'}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={accessKind === 'admin'}
                onChange={(e) => setAccessKind(e.target.checked ? 'admin' : 'access')}
                className="mt-1"
              />
              <span className="text-xs text-slate-300">
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                  Request <em>admin privileges</em> on {selectedLabel}
                </span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  Most requesters don't need this. Only check if you'll be administering
                  the cartridge (review queues, gated admin tabs).
                </span>
              </span>
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-slate-400 mb-1 block">
                Justification
              </span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  accessKind === 'admin'
                    ? "e.g. I'm the partnership lead for the KNYT activation and need to review campaigns and approve partner cohorts."
                    : `e.g. I'd like to start using ${selectedLabel} as part of my active workstreams.`
                }
                rows={4}
                maxLength={2000}
                className="w-full px-3 py-2 rounded-md bg-slate-800/60 border border-slate-700 text-sm focus:outline-none focus:border-violet-500 resize-y"
              />
              <span className="text-[11px] text-slate-500 mt-0.5 block text-right">
                {message.length} / 2000
              </span>
            </label>

            {result && (
              <div
                className={`text-sm px-3 py-2 rounded-md border ${
                  result.ok
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-500/10 border-rose-500/40 text-rose-200'
                }`}
              >
                {result.text}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Close
            </Button>
            <Button onClick={() => void submit()} disabled={submitting || (result?.ok ?? false)}>
              {submitting
                ? 'Submitting…'
                : accessKind === 'admin'
                  ? 'Request admin'
                  : 'Request access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default RequestAdminAccessButton;
