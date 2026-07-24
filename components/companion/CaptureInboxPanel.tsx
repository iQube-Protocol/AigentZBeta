/**
 * CaptureInboxPanel — the Workspace Inbox (SPEC-MMC-001 §4/§9, PRD-MMC-IMPL-003
 * Increment 3, DESIGN — awaiting operator ratification).
 *
 * Renders every capture still in `status: 'inbox'` — the concrete UI
 * expression of PRD-MMC-IMPL-003 §0.8's governing invariant: this is the
 * point at which something ceases to be "content on the web" and becomes an
 * object within the runtime. Constitution already happened server-side
 * (`POST /api/companion/capture`) by the time a row appears here — this
 * panel is where the operator decides what happens next (Movement II,
 * Organize): Intent or Venture, the only two destinations this pass
 * supports (§0.3). Once assigned, a capture never reappears in this list —
 * its home is the destination now, not a lingering duplicate here (mirrors
 * SPEC-MMC-001 §0.2's Content Capsule Containment spirit).
 *
 * Each destination offers two paths: mint a brand-new Intent/Venture from
 * the capture, or attach it to one the persona already has (the existing-
 * object picker, 2026-07-24 follow-on — the original pass only ever
 * created new objects, with no way to land a capture in something that
 * already existed).
 *
 * Surface-agnostic: takes only `personaIdHint`, same discipline as
 * `ObserverGrantPanel.tsx` — a future extension-sidebar surface could mount
 * this exact component unchanged.
 *
 * Data flow: `personaFetch` ONLY (CLAUDE.md PARAMOUNT client-spine-fetch
 * rule) against the Increment 2 routes plus the 2026-07-24 follow-on:
 *   GET  /api/companion/capture                    → list inbox captures
 *   GET  /api/companion/capture/destinations        → existing Intents/Ventures for the picker
 *   POST /api/companion/capture/[id]/assign         → bind to Intent/Venture (new or existing)
 * Never a raw `fetch`, never `authedFetchHeaders`.
 *
 * T0/T1 discipline: `personaIdHint` is used ONLY as a `personaFetch` query
 * hint — never rendered as visible text or a DOM attribute.
 *
 * Styling: canonical slate house style only (CLAUDE.md "Canonical Surface
 * Styling") — `border-slate-800` / `bg-slate-900/40`, no white hairlines.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, MousePointer2, FileType, Image as ImageIcon, Sparkles, Rocket } from "lucide-react";

import { personaFetch } from "@/utils/personaSpine";
import type {
  CaptureIntentDestination,
  CaptureSourceKind,
  CaptureVentureDestination,
  CapturedObjectRecord,
} from "@/types/companionCapture";

const CAPTURE_ENDPOINT = "/api/companion/capture";
const DESTINATIONS_ENDPOINT = "/api/companion/capture/destinations";

export interface CaptureInboxPanelProps {
  /** T1 persona hint threaded onto every `personaFetch` call. Never
   *  rendered as text or a DOM attribute anywhere in this component. */
  personaIdHint: string;
}

const SOURCE_KIND_ICON: Record<CaptureSourceKind, typeof FileText> = {
  webpage: FileText,
  selection: MousePointer2,
  pdf: FileType,
  image: ImageIcon,
};

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body === "object" && "error" in body && typeof (body as { error?: unknown }).error === "string") {
    const b = body as { error: string; detail?: unknown };
    // `detail` (e.g. the underlying Postgres error) is dropped by every prior
    // version of this reader -- surfacing it is the difference between a
    // dead-end "assign-persist-failed" and an actionable message.
    return typeof b.detail === "string" && b.detail.trim().length > 0 ? `${b.error}: ${b.detail}` : b.error;
  }
  return fallback;
}

export function CaptureInboxPanel({ personaIdHint }: CaptureInboxPanelProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [captures, setCaptures] = useState<CapturedObjectRecord[]>([]);
  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});
  // Existing-object picker (2026-07-24, operator-reported gap): before this,
  // "Bring into Intent"/"Bring into Venture" always minted a brand-new
  // object — there was no way to land a capture in something the persona
  // already has. Fetched alongside the inbox; refreshed after every assign
  // so a just-created object is immediately available as an "existing"
  // target for the next capture in the same session.
  const [intents, setIntents] = useState<CaptureIntentDestination[]>([]);
  const [ventures, setVentures] = useState<CaptureVentureDestination[]>([]);

  const setPending = (id: string, value: boolean) => {
    setPendingIds((prev) => ({ ...prev, [id]: value }));
  };

  const loadCaptures = useCallback(async () => {
    setStatus((prev) => (prev === "ready" ? prev : "loading"));
    setError(null);
    try {
      const res = await personaFetch(CAPTURE_ENDPOINT, { personaIdHint, cache: "no-store" });
      if (!res.ok) {
        setError(await readErrorMessage(res, `Failed to load your Inbox (${res.status}).`));
        setStatus("error");
        return;
      }
      const body = (await res.json()) as { captures: CapturedObjectRecord[] };
      setCaptures((body.captures ?? []).filter((c) => c.status === "inbox"));
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, [personaIdHint]);

  const loadDestinations = useCallback(async () => {
    try {
      const res = await personaFetch(DESTINATIONS_ENDPOINT, { personaIdHint, cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as {
        intents: CaptureIntentDestination[];
        ventures: CaptureVentureDestination[];
      };
      setIntents(body.intents ?? []);
      setVentures(body.ventures ?? []);
    } catch {
      // Non-fatal — the picker just falls back to "create new" only.
    }
  }, [personaIdHint]);

  useEffect(() => {
    void loadCaptures();
    void loadDestinations();
  }, [loadCaptures, loadDestinations]);

  const assign = useCallback(
    async (captureId: string, destination: "intent" | "venture", existingId?: string) => {
      setPending(captureId, true);
      try {
        const res = await personaFetch(`${CAPTURE_ENDPOINT}/${captureId}/assign`, {
          method: "POST",
          personaIdHint,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ destination, ...(existingId ? { existingId } : {}) }),
        });
        if (!res.ok) {
          setError(await readErrorMessage(res, `Failed to bring this into ${destination} (${res.status}).`));
          return;
        }
        // Assigned captures never reappear in the inbox — remove locally
        // rather than re-fetching the whole list.
        setCaptures((prev) => prev.filter((c) => c.id !== captureId));
        setError(null);
        if (!existingId) void loadDestinations(); // a just-created object becomes a future "existing" target
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setPending(captureId, false);
      }
    },
    [personaIdHint, loadDestinations],
  );

  return (
    <div className="space-y-2">
      {status === "loading" ? (
        <div className="text-xs text-slate-500">Loading your Inbox…</div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-[11px] text-rose-300">
          {error}
        </div>
      ) : null}

      {status === "ready" && captures.length === 0 ? (
        <div className="text-xs text-slate-500 italic">
          Nothing captured yet. Recognize something on the web — right-click and Pull Across — and it lands here.
        </div>
      ) : null}

      {status !== "loading"
        ? captures.map((capture) => {
            const Icon = SOURCE_KIND_ICON[capture.sourceKind];
            const isPending = !!pendingIds[capture.id];
            return (
              <div
                key={capture.id}
                className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-3"
              >
                <div className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-slate-200">
                      {capture.title || capture.sourceUrl || "Untitled capture"}
                    </div>
                    {capture.contentText ? (
                      <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                        {capture.contentText.slice(0, 200)}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => void assign(capture.id, "intent")}
                    className="inline-flex items-center gap-1 rounded-sm border border-slate-800 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-900 disabled:opacity-50"
                  >
                    <Sparkles className="h-3 w-3" />
                    {isPending ? "…" : "Bring into new Intent"}
                  </button>
                  {intents.length > 0 ? (
                    <select
                      disabled={isPending}
                      value=""
                      onChange={(e) => {
                        if (e.target.value) void assign(capture.id, "intent", e.target.value);
                      }}
                      className="rounded-sm border border-slate-800 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-300 disabled:opacity-50"
                    >
                      <option value="">…or attach to existing Intent</option>
                      {intents.map((intent) => (
                        <option key={intent.id} value={intent.id}>
                          {intent.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => void assign(capture.id, "venture")}
                    className="inline-flex items-center gap-1 rounded-sm border border-slate-800 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-900 disabled:opacity-50"
                  >
                    <Rocket className="h-3 w-3" />
                    {isPending ? "…" : "Bring into new Venture"}
                  </button>
                  {ventures.length > 0 ? (
                    <select
                      disabled={isPending}
                      value=""
                      onChange={(e) => {
                        if (e.target.value) void assign(capture.id, "venture", e.target.value);
                      }}
                      className="rounded-sm border border-slate-800 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-300 disabled:opacity-50"
                    >
                      <option value="">…or attach to existing Venture</option>
                      {ventures.map((venture) => (
                        <option key={venture.id} value={venture.id}>
                          {venture.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              </div>
            );
          })
        : null}
    </div>
  );
}

export default CaptureInboxPanel;
