/**
 * specialistThreadStore — persisted, append-only conversation storage for
 * the reusable Specialist Workspace (Aigent Factor / Aegis specialist
 * surfaces upgrade, 2026-09-05).
 *
 * Threads are kept separate by personaId + specialistId + an optional
 * bounded scope id (a Factor caseId or an Aegis assessmentId) — never a
 * single shared thread. A Factor conversation must never appear in the
 * Aegis thread, and a direct consult (no case/assessment open) must never
 * appear in a case/assessment-grounded thread for the SAME specialist.
 *
 * personaId is read the same way MoneyPennyCopilotWorkspace.tsx already
 * does (localStorage 'currentPersonaId' — the spine's own client-side
 * record of the active persona, per CLAUDE.md), never fabricated or sent
 * anywhere — this is a client-only partition key for sessionStorage, not an
 * auth mechanism (personaFetch/getActivePersona remain the sole authority
 * for who the operator actually is).
 *
 * sessionStorage (not localStorage) matches the existing
 * writePendingPanel/writePendingSpecialist idiom in moneyPennyNavigation.tsx
 * — scoped to this browser tab's session, cleared when it closes.
 */

import type { SpecialistResponseData } from "@/components/metame/cards/SpecialistResponseCard";

export interface ConsultTurn {
  id: string;
  prompt: string;
  response: SpecialistResponseData | null;
  error: string | null;
  loading: boolean;
  timestamp: string;
  /** Set when the operator's own prompt was structurally refused before any
   *  network call (e.g. asking Factor to admit a candidate directly, or
   *  asking Aegis to assess itself) — see classifyRefusal in
   *  SpecialistWorkspace.tsx. */
  refusalMessage: string | null;
}

function readStoredPersonaId(): string {
  if (typeof window === "undefined") return "anonymous";
  try {
    return window.localStorage.getItem("currentPersonaId") ?? "anonymous";
  } catch {
    return "anonymous";
  }
}

export function specialistThreadKey(specialistId: string, scopeId: string | null | undefined): string {
  const persona = readStoredPersonaId();
  return `moneypenny.specialist-thread.${persona}.${specialistId}.${scopeId ?? "direct"}`;
}

export function loadThread(key: string): ConsultTurn[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ConsultTurn[]) : [];
  } catch {
    return [];
  }
}

export function saveThread(key: string, turns: ConsultTurn[]): void {
  if (typeof window === "undefined") return;
  try {
    if (turns.length === 0) {
      window.sessionStorage.removeItem(key);
      return;
    }
    window.sessionStorage.setItem(key, JSON.stringify(turns));
  } catch {
    /* non-fatal — the conversation simply doesn't survive a remount this time */
  }
}

export function clearThread(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* non-fatal */
  }
}
