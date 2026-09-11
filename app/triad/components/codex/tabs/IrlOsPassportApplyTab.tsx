"use client";

/**
 * IrlOsPassportApplyTab — the IRL OS Apply step's own resolver wrapper
 * (2026-09-08), mirroring the Horizen/Ian journey precedent for
 * `PassportBureauApplyTab`'s `initialUsablePassport` recognition prop
 * (`PassportBureauApplyTab.tsx`'s own doc comment: "OCSGA Presence
 * recognition fix, 2026-08-27").
 *
 * THE BUG THIS CLOSES. `PassportBureauApplyTab` only ever discovers "the
 * caller already holds a usable Citizen Passport" through its OWN internal
 * Account-step sign-in sub-step (`/api/passport/usable-status`, called right
 * after the wizard's own Bureau/wallet sign-in form succeeds — see that
 * component's `handleAccount`). A caller who is ALREADY platform-
 * authenticated (the normal IRL OS case — no bespoke Bureau sign-in sub-step
 * exists in this flow at all) never reaches that internal check, so the raw
 * "Who is this Passport for?" class picker rendered even for a holder who
 * already has one. `PilotJourneyTab`/`IanJourneyTab` close this for their
 * own Horizen/Ian journeys by resolving it from an already-loaded journey
 * `runtimeState` and seeding `initialUsablePassport`/`initialPassportClass`/
 * `initialPassportRef`. IRL OS's Apply tab has no equivalent bespoke
 * journey-state route to read from, so this wrapper calls the SAME
 * `/api/passport/usable-status` route `PassportBureauApplyTab`'s own
 * internal check already uses (inv.engineering.036/037 — one canonical
 * check, not a second one) directly on mount, through `personaFetch` (never
 * `authedFetchHeaders`+raw `fetch` — CLAUDE.md's Identity & Access Spine
 * rule; this route resolves the caller via `getActivePersona`, making it a
 * spine endpoint).
 *
 * That route is T1-safe by design ("only a boolean leaves the server") — it
 * has no class/ref to report, so `initialPassportClass`/`initialPassportRef`
 * are never seeded here; the recognized-state banner falls back to its own
 * "never fabricated, null when unset" behaviour for those two fields.
 *
 * WAITS FOR THE CHECK BEFORE MOUNTING `PassportBureauApplyTab` at all —
 * `initialUsablePassport` is captured into that component's OWN `useState`
 * ONCE at first mount (never re-read from a later prop update), so mounting
 * it early with a still-unknown value and updating the prop afterward would
 * silently do nothing. A brief loading state is the honest alternative to
 * either guessing `false` first or building a `key`-remount workaround.
 */

import { useEffect, useState } from "react";
import { personaFetch } from "@/utils/personaSpine";
import { PassportBureauApplyTab } from "./PassportBureauApplyTab";

interface IrlOsPassportApplyTabProps {
  personaId?: string;
}

type UsableStatus = { kind: "loading" } | { kind: "checked"; usable: boolean } | { kind: "error" };

export function IrlOsPassportApplyTab({ personaId }: IrlOsPassportApplyTabProps) {
  const [status, setStatus] = useState<UsableStatus>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await personaFetch("/api/passport/usable-status", {
          cache: "no-store",
          personaIdHint: personaId,
        });
        if (!alive) return;
        if (!res.ok) {
          setStatus({ kind: "error" });
          return;
        }
        const data = await res.json();
        setStatus(data?.ok ? { kind: "checked", usable: Boolean(data.usable) } : { kind: "error" });
      } catch {
        if (alive) setStatus({ kind: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [personaId]);

  if (status.kind === "loading") {
    return <div className="p-8 text-center text-sm text-slate-500">Checking your Passport status…</div>;
  }

  // 'error' falls through with initialUsablePassport left unset — the
  // honest default (class picker renders), never a guess in either
  // direction, matching PassportBureauApplyTab's own "no observer answer"
  // behaviour for `routeTo`.
  return (
    <PassportBureauApplyTab
      personaId={personaId}
      initialUsablePassport={status.kind === "checked" ? status.usable : undefined}
    />
  );
}

export default IrlOsPassportApplyTab;
