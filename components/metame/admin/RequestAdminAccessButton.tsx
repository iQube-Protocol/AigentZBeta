"use client";

/**
 * RequestAdminAccessButton — opens a small modal that lets a persona
 * submit a request for admin access to a specific cartridge. Only
 * renders when the active persona has NO admin grants (no isAdmin,
 * no per-cartridge grants). Global admins and cartridge admins don't
 * see it.
 *
 * The submit POSTs to /api/admin/access-requests; the route is gated
 * by the spine and writes a 'pending' row that a global admin can
 * decide via the Admin Access Requests tab.
 */

import { useCallback, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface Props {
  /**
   * Pre-fill the cartridge slug the user is requesting admin on.
   * When omitted, the modal lets them pick from the standard set
   * (or request platform-wide / global admin).
   */
  defaultCartridgeSlug?: string;
  className?: string;
}

const CARTRIDGE_OPTIONS: Array<{ slug: string | null; label: string }> = [
  { slug: 'metame', label: 'metaMe' },
  { slug: 'knyt-codex', label: 'KNYT' },
  { slug: 'qripto', label: 'The Qriptopian' },
  { slug: 'marketa', label: 'Marketa' },
  { slug: 'venture-lab', label: 'metaMe Venture Lab' },
  { slug: 'agentiq-os', label: 'AgentiQ OS' },
  { slug: null, label: 'Platform-wide (global admin)' },
];

export function RequestAdminAccessButton({ defaultCartridgeSlug, className }: Props) {
  const [open, setOpen] = useState(false);
  const [cartridgeSlug, setCartridgeSlug] = useState<string | null>(defaultCartridgeSlug ?? 'metame');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = useCallback(async () => {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await personaFetch('/api/admin/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedCartridgeSlug: cartridgeSlug,
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
          'Request submitted. A global admin will review it and you will see the decision on your next sign-in.',
      });
      setMessage('');
    } catch (err) {
      setResult({ ok: false, text: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }, [cartridgeSlug, message]);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={`border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 ${className ?? ''}`}
        onClick={() => setOpen(true)}
      >
        <ShieldCheck className="w-4 h-4 mr-1.5" />
        Request admin access
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request admin access</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-300">
            <p>
              Choose the cartridge you want admin scope on, and add a short justification so the
              reviewer knows the context.
            </p>
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-slate-400 mb-1 block">
                Cartridge
              </span>
              <select
                value={cartridgeSlug ?? '__global'}
                onChange={(e) =>
                  setCartridgeSlug(e.target.value === '__global' ? null : e.target.value)
                }
                className="w-full px-3 py-2 rounded-md bg-slate-800/60 border border-slate-700 text-sm focus:outline-none focus:border-violet-500"
              >
                {CARTRIDGE_OPTIONS.map((opt) => (
                  <option key={opt.slug ?? '__global'} value={opt.slug ?? '__global'}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-slate-400 mb-1 block">
                Justification
              </span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. I'm the partnership lead for the KNYT activation and need to review campaigns and partner cohorts."
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
              {submitting ? 'Submitting…' : 'Submit request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default RequestAdminAccessButton;
