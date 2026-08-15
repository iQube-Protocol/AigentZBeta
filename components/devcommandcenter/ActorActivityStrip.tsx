"use client";

/**
 * ActorActivityStrip / ActorEventRow — DevOn UI Refinement Phase C, repositioned in C2.
 *
 * `ActorEventRow` renders a single actor-event as one lightweight,
 * operational row (icon + name + action label + summary), and is what
 * `DevCommandCenterTab.tsx` feeds into SmartTriadCopilotLayer's
 * `streamSupplementItems` seam — each row is interleaved chronologically
 * into the same scrolling conversation as DevOn's messages, above the
 * composer, per the engagement-stream rule: acts belong in the
 * conversation, never in a separate footer/tray/pane. No change to
 * `SmartTriadMessage` or to the copilot's own message-state management was
 * needed (that would have required taking over full controlled-`messages`
 * ownership, a far bigger change than this phase calls for).
 *
 * Deliberately NOT rendered as chat bubbles: DevOn is the persistent
 * orchestrator narrating in the message stream; these rows are
 * orchestration STATUS, visually distinct (compact status rows, not
 * speech bubbles) so Aigent Z / Claude Code / reviewers never read as
 * separate chat participants competing with DevOn.
 *
 * `ActorActivityStrip` groups several rows under one heading and remains
 * available for any future grouped/non-interleaved presentation, but is
 * not the current integration path.
 *
 * Provider-neutral by construction — nothing below branches on `actorId`.
 * `actorName` and `actionLabel` are the only per-actor data, both supplied
 * by the caller who constructed the event.
 */

import { CheckCircle2, Circle, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { DEFAULT_ACTION_LABEL, type ActorEvent, type ActorEventAction } from "./actorEvents";

const ACTION_TONE: Record<ActorEventAction, { dotClass: string; textClass: string; Icon: typeof Circle }> = {
  invoked: { dotClass: "bg-sky-400", textClass: "text-sky-200", Icon: Circle },
  working: { dotClass: "bg-amber-400", textClass: "text-amber-200", Icon: Loader2 },
  completed: { dotClass: "bg-emerald-400", textClass: "text-emerald-200", Icon: CheckCircle2 },
  failed: { dotClass: "bg-rose-400", textClass: "text-rose-200", Icon: XCircle },
  "awaiting-authorization": { dotClass: "bg-violet-400", textClass: "text-violet-200", Icon: ShieldAlert },
};

export function ActorEventRow({ event }: { event: ActorEvent }) {
  const tone = ACTION_TONE[event.action];
  const Icon = tone.Icon;
  const label = event.actionLabel || DEFAULT_ACTION_LABEL[event.action];
  return (
    <div className="flex items-start gap-2 py-1">
      <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${tone.textClass} ${event.action === "working" ? "animate-spin" : ""}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-white">{event.actorName}</span>
          <span className="text-slate-600">·</span>
          <span className={`text-[11px] font-medium ${tone.textClass}`}>{label}</span>
        </div>
        <div className="text-[10px] text-slate-400 truncate">{event.summary}</div>
        {event.detail && <div className="text-[10px] text-slate-500 font-mono truncate">{event.detail}</div>}
      </div>
      <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${tone.dotClass}`} />
    </div>
  );
}

/**
 * `events` should already be ONE row per actor (see `latestPerActor` in
 * `actorEvents.ts`) — this component does no deduplication or history
 * management of its own; it renders exactly what it is given.
 */
export function ActorActivityStrip({ events }: { events: readonly ActorEvent[] }) {
  if (events.length === 0) return null;
  return (
    <div className="space-y-0.5">
      <div className="text-[9px] uppercase tracking-wider text-slate-600 font-semibold">Orchestration activity</div>
      {events.map((event) => (
        <ActorEventRow key={event.actorId} event={event} />
      ))}
    </div>
  );
}
