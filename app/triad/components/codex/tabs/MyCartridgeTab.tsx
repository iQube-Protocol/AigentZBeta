"use client";

/**
 * MyCartridgeTab — operator-tier manager surface for owned cartridges.
 *
 * Phase 7 of the myCartridge PRD §14. Replaces the Phase 2 stub.
 *
 * Layout: left rail lists the operator's cartridges (one per row);
 * right panel renders the detail editor for the selected slug. When no
 * cartridge exists, the surface shows a "Create your first cartridge"
 * CTA that opens the wizard (Phase 6).
 *
 * Phase 7 scope:
 *   - List + select owned cartridges
 *   - Edit identity (title, description, category, visibility)
 *   - Edit primaryTabSlug
 *   - Edit availableSpecialists (cap 3; payment-gated above)
 *   - Edit tokenWhitelist
 *   - Per-tab visibility editor (member/admin/invite/token-gated)
 *   - Member list + invite by personaId + revoke
 *
 * Phase 7 scope NOT included:
 *   - Per-tab metrics + actions composer (the Active tab editor still
 *     accepts arrays in PATCH /api/cartridge/[slug] but UI for editing
 *     them inline lands in Phase 10 alongside the Activations Catalogue
 *     review flow).
 *   - Tab reorder (typed in PATCH /tabs.order; UI is a Phase 7b drag-
 *     handle).
 *   - Transfer ownership (Phase 7b).
 *   - Invite-by-handle (Phase 7b).
 *
 * Privacy posture: every read goes via personaFetch through the spine.
 * Memberships render as `personaDisplayToken` (8-char hash prefix); the
 * full T0 persona_id is never echoed to this surface.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Boxes, Loader2, Plus, RefreshCcw, Sparkles, Trash2, UserPlus, Wand2 } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { CartridgeSetupWizard } from "@/components/metame/setup/CartridgeSetupWizard";

// ─── Types ────────────────────────────────────────────────────────────────

interface OwnedCartridgeSummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: string | null;
  visibility: string | null;
  primaryTabSlug: string | null;
  tabCount: number;
  role: string;
  canEdit: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CartridgeTab {
  id: string;
  slug: string;
  label: string;
  enabled: boolean;
  order: number;
  type: string;
  config?: Record<string, unknown>;
  member_only?: boolean;
  invite_only?: boolean;
  role_required?: string | null;
  token_gated?: { tokenId: string; minBalance: string } | null;
}

interface CartridgeDetail {
  id: string;
  slug: string;
  title: string;
  enabled: boolean;
  description: string | null;
  purpose: string | null;
  category: string | null;
  visibility: string | null;
  primaryTabSlug: string | null;
  availableSpecialists: string[];
  tokenWhitelist: string[];
  smartTriadConfig: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  isOwnerCaller: boolean;
}

interface Membership {
  personaDisplayToken: string | null;
  role: string;
  grantedAt: string | null;
}

interface DetailResponse {
  ok: boolean;
  cartridge: CartridgeDetail;
  tabs: CartridgeTab[];
  memberships: Membership[];
  caller: { canEdit: boolean; reason: string };
  error?: string;
  detail?: string;
}

interface Props {
  personaId?: string;
  theme?: "light" | "dark";
}

type TabVisibility = "public" | "member" | "admin" | "invite" | "token-gated";

const SPECIALIST_OPTIONS = [
  "aigent-c", "aigent-z", "marketa", "moneypenny",
  "kn0w1", "quill", "metaye", "aigent-nakamoto",
];
const TOKEN_OPTIONS = ["q-cent", "usdc", "knyt"];
const ROLE_OPTIONS = [
  "admin", "editor", "contributor", "member",
  "partner", "franchisee", "correspondent", "guest",
];

// ─── Component ────────────────────────────────────────────────────────────

export function MyCartridgeTab({ personaId: _personaId, theme: _theme }: Props) {
  const [list, setList] = useState<OwnedCartridgeSummary[] | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);

  const refreshList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await personaFetch("/api/cartridge/list-mine");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || body?.error || `list failed (${res.status})`);
      }
      const body = (await res.json()) as { ok: boolean; cartridges: OwnedCartridgeSummary[] };
      setList(body.cartridges);
      if (!selectedSlug && body.cartridges.length > 0) {
        setSelectedSlug(body.cartridges[0].slug);
      }
    } catch (err) {
      setListError(err instanceof Error ? err.message : String(err));
    } finally {
      setListLoading(false);
    }
  }, [selectedSlug]);

  const refreshDetail = useCallback(async (slug: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await personaFetch(`/api/cartridge/${encodeURIComponent(slug)}`);
      const body = (await res.json()) as DetailResponse;
      if (!res.ok || !body.ok) {
        throw new Error(body.detail || body.error || `detail failed (${res.status})`);
      }
      setDetail(body);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : String(err));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (selectedSlug) void refreshDetail(selectedSlug);
  }, [selectedSlug, refreshDetail]);

  const onWizardSaved = useCallback(
    (saved: { slug: string }) => {
      setSelectedSlug(saved.slug);
      void refreshList();
    },
    [refreshList],
  );

  // ── Empty + initial states ───────────────────────────────────────────

  if (list === null && listLoading) {
    return (
      <div className="flex h-full items-center justify-center p-10 text-slate-400 gap-3">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading your cartridges…
      </div>
    );
  }

  if (list && list.length === 0) {
    return (
      <>
        <div className="flex h-full w-full flex-col items-center justify-center px-6 py-10 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10 ring-1 ring-violet-400/30">
            <Boxes className="h-8 w-8 text-violet-300" />
          </div>
          <h2 className="mb-2 text-2xl font-semibold text-slate-100">myCartridge</h2>
          <p className="mb-6 max-w-lg text-sm text-slate-400">
            You haven&apos;t created a cartridge yet. The setup wizard walks you
            through identity, purpose, tabs, audience, and the Triad (Cartridge
            + Copilot + Wallet) in 5 steps.
          </p>
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-violet-500 text-white text-sm hover:bg-violet-400"
          >
            <Wand2 className="w-4 h-4" />
            Create your first cartridge
          </button>
          {listError && (
            <p className="text-xs text-amber-400 mt-3">List error: {listError}</p>
          )}
        </div>
        <CartridgeSetupWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          onSaved={onWizardSaved}
        />
      </>
    );
  }

  // ── Main layout: rail + detail ───────────────────────────────────────

  return (
    <>
      <div className="flex h-full">
        {/* Left rail */}
        <div className="w-72 shrink-0 border-r border-slate-700/40 overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/40">
            <span className="text-xs uppercase tracking-wide text-slate-500">
              Your cartridges
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setWizardOpen(true)}
                title="Create cartridge"
                className="p-1 rounded hover:bg-slate-700/40 text-slate-400 hover:text-slate-200"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => void refreshList()}
                title="Refresh"
                className="p-1 rounded hover:bg-slate-700/40 text-slate-400 hover:text-slate-200"
              >
                <RefreshCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
          {listError && (
            <p className="px-3 py-2 text-xs text-amber-400">{listError}</p>
          )}
          <ul>
            {(list ?? []).map((c) => {
              const selected = c.slug === selectedSlug;
              return (
                <li key={c.slug}>
                  <button
                    type="button"
                    onClick={() => setSelectedSlug(c.slug)}
                    className={`w-full text-left px-3 py-2 border-b border-slate-700/30 transition ${
                      selected ? "bg-violet-500/10" : "hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="text-sm font-medium text-slate-100 truncate">
                      {c.title}
                    </div>
                    <div className="text-xs text-slate-500 font-mono truncate">
                      /{c.slug}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] uppercase tracking-wider">
                      <span className="text-violet-300">{c.role}</span>
                      <span className="text-slate-500">{c.tabCount} tabs</span>
                      {c.visibility && (
                        <span className="text-slate-500">{c.visibility}</span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Right detail */}
        <div className="flex-1 overflow-y-auto">
          {!selectedSlug && (
            <div className="p-10 text-sm text-slate-400">
              Select a cartridge on the left to edit it.
            </div>
          )}
          {selectedSlug && detailLoading && !detail && (
            <div className="flex items-center justify-center gap-2 p-10 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading {selectedSlug}…
            </div>
          )}
          {detailError && (
            <div className="m-4 px-3 py-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded">
              {detailError}
            </div>
          )}
          {detail && selectedSlug === detail.cartridge.slug && (
            <ManagerDetail
              detail={detail}
              onChanged={() => {
                void refreshDetail(detail.cartridge.slug);
                void refreshList();
              }}
            />
          )}
        </div>
      </div>
      <CartridgeSetupWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onSaved={onWizardSaved}
      />
    </>
  );
}

export default MyCartridgeTab;

// ─── Detail editor ────────────────────────────────────────────────────────

function ManagerDetail({
  detail,
  onChanged,
}: {
  detail: DetailResponse;
  onChanged: () => void;
}) {
  const c = detail.cartridge;
  const canEdit = detail.caller.canEdit;

  const [savingId, setSavingId] = useState<string | null>(null);
  const [opError, setOpError] = useState<string | null>(null);

  async function patchCartridge(body: Record<string, unknown>, opId: string) {
    setSavingId(opId);
    setOpError(null);
    try {
      const res = await personaFetch(`/api/cartridge/${encodeURIComponent(c.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as { ok: boolean; error?: string; detail?: string };
      if (!res.ok || !j.ok) throw new Error(j.detail || j.error || `save failed (${res.status})`);
      onChanged();
    } catch (err) {
      setOpError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingId(null);
    }
  }

  async function patchTabs(tabPatch: Record<string, unknown>, opId: string) {
    setSavingId(opId);
    setOpError(null);
    try {
      const res = await personaFetch(`/api/cartridge/${encodeURIComponent(c.slug)}/tabs`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabs: [tabPatch] }),
      });
      const j = (await res.json()) as { ok: boolean; error?: string; detail?: string };
      if (!res.ok || !j.ok) throw new Error(j.detail || j.error || `save failed (${res.status})`);
      onChanged();
    } catch (err) {
      setOpError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <header>
        <h2 className="text-xl font-semibold text-slate-100">{c.title}</h2>
        <div className="mt-1 text-xs text-slate-500 font-mono">/{c.slug}</div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {c.category && <Chip>{c.category}</Chip>}
          {c.visibility && <Chip>{c.visibility}</Chip>}
          <Chip>caller: {detail.caller.reason}</Chip>
          {!canEdit && <Chip className="text-amber-300">read-only</Chip>}
        </div>
      </header>

      {opError && (
        <div className="px-3 py-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded">
          {opError}
        </div>
      )}

      {/* Identity */}
      <section>
        <SectionHeader title="Identity" subtitle="title, description, category, visibility" />
        <IdentityEditor
          disabled={!canEdit}
          savingId={savingId}
          initial={{
            title: c.title,
            description: c.description ?? "",
            category: c.category ?? "venture",
            visibility: c.visibility ?? "private",
          }}
          onSave={(patch) => patchCartridge(patch, "identity")}
        />
      </section>

      {/* Tabs */}
      <section>
        <SectionHeader title="Tabs" subtitle="primary tab + per-tab visibility" />
        <div className="space-y-2">
          {detail.tabs.map((t) => (
            <TabRow
              key={t.slug}
              tab={t}
              isPrimary={c.primaryTabSlug === t.slug}
              disabled={!canEdit}
              savingId={savingId}
              onSetPrimary={() => patchCartridge({ primaryTabSlug: t.slug }, `prim:${t.slug}`)}
              onSetVisibility={(vis, role) =>
                patchTabs(
                  vis === "admin" && role
                    ? { slug: t.slug, visibility: vis, roleRequired: role }
                    : { slug: t.slug, visibility: vis },
                  `vis:${t.slug}`,
                )
              }
              onToggleEnabled={() =>
                patchTabs({ slug: t.slug, enabled: !t.enabled }, `en:${t.slug}`)
              }
            />
          ))}
        </div>
      </section>

      {/* Specialists */}
      <section>
        <SectionHeader title="Specialists" subtitle="≤3 free-tier" />
        <SpecialistsEditor
          disabled={!canEdit}
          savingId={savingId}
          initial={c.availableSpecialists}
          onSave={(specialists) => patchCartridge({ availableSpecialists: specialists }, "spec")}
        />
      </section>

      {/* Token whitelist */}
      <section>
        <SectionHeader title="Wallet tokens" subtitle="cartridge token whitelist" />
        <TokenWhitelistEditor
          disabled={!canEdit}
          savingId={savingId}
          initial={c.tokenWhitelist}
          onSave={(tokens) => patchCartridge({ tokenWhitelist: tokens }, "tok")}
        />
      </section>

      {/* Members */}
      <section>
        <SectionHeader title="Members" subtitle="invite + change role + revoke" />
        <MembershipsEditor
          cartridgeSlug={c.slug}
          memberships={detail.memberships}
          disabled={!canEdit}
          onChanged={onChanged}
        />
      </section>

      <footer className="text-xs text-slate-500 pt-4 border-t border-slate-700/40">
        Phase 7 manager · createdAt {c.createdAt.slice(0, 10)} · updatedAt {c.updatedAt.slice(0, 10)}
      </footer>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-2">
      <h3 className="text-sm font-medium text-slate-200">{title}</h3>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`px-2 py-0.5 rounded border bg-slate-800 text-slate-300 border-slate-700 ${className}`}>
      {children}
    </span>
  );
}

function IdentityEditor({
  initial, disabled, savingId, onSave,
}: {
  initial: { title: string; description: string; category: string; visibility: string };
  disabled: boolean;
  savingId: string | null;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [initial]);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  return (
    <div className="space-y-2">
      <input
        type="text"
        value={form.title}
        disabled={disabled}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        placeholder="Title"
        className="w-full px-3 py-2 rounded bg-slate-800/60 border border-slate-700 text-sm"
      />
      <textarea
        value={form.description}
        disabled={disabled}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        placeholder="Description"
        rows={3}
        className="w-full px-3 py-2 rounded bg-slate-800/60 border border-slate-700 text-sm"
      />
      <div className="flex gap-2">
        <select
          value={form.category}
          disabled={disabled}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          className="px-2 py-1 rounded bg-slate-800/60 border border-slate-700 text-xs"
        >
          {["community","venture","knowledge","creative","media","franchise","learning","research","professional","private"].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={form.visibility}
          disabled={disabled}
          onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value }))}
          className="px-2 py-1 rounded bg-slate-800/60 border border-slate-700 text-xs"
        >
          {["public","private","invite-only","member-only"].map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={disabled || !dirty || savingId === "identity"}
          onClick={() => onSave({
            title: form.title,
            description: form.description,
            category: form.category,
            visibility: form.visibility,
          })}
          className="px-3 py-1.5 text-xs rounded bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-40"
        >
          {savingId === "identity" ? "Saving…" : "Save identity"}
        </button>
      </div>
    </div>
  );
}

function TabRow({
  tab, isPrimary, disabled, savingId, onSetPrimary, onSetVisibility, onToggleEnabled,
}: {
  tab: CartridgeTab;
  isPrimary: boolean;
  disabled: boolean;
  savingId: string | null;
  onSetPrimary: () => void;
  onSetVisibility: (vis: TabVisibility, role?: string) => void;
  onToggleEnabled: () => void;
}) {
  const currentVis: TabVisibility =
    tab.token_gated ? "token-gated" :
    tab.role_required === "admin" ? "admin" :
    tab.invite_only ? "invite" :
    tab.member_only ? "member" :
    "public";
  return (
    <div className="px-3 py-2 rounded border border-slate-700/60 bg-slate-800/40 flex items-center gap-3 text-sm">
      <input
        type="radio"
        name="primary-tab"
        checked={isPrimary}
        disabled={disabled || savingId === `prim:${tab.slug}`}
        onChange={onSetPrimary}
        title="Make primary"
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-100 truncate">{tab.label}</div>
        <div className="text-xs text-slate-500 font-mono truncate">/{tab.slug} · {tab.type}</div>
      </div>
      <select
        value={currentVis}
        disabled={disabled || savingId === `vis:${tab.slug}`}
        onChange={(e) => onSetVisibility(e.target.value as TabVisibility)}
        className="px-2 py-1 rounded bg-slate-800/60 border border-slate-700 text-xs"
      >
        {(["public","member","admin","invite","token-gated"] as TabVisibility[]).map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-xs">
        <input
          type="checkbox"
          checked={tab.enabled}
          disabled={disabled || savingId === `en:${tab.slug}`}
          onChange={onToggleEnabled}
        />
        on
      </label>
    </div>
  );
}

function SpecialistsEditor({
  initial, disabled, savingId, onSave,
}: {
  initial: string[];
  disabled: boolean;
  savingId: string | null;
  onSave: (next: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>(initial);
  useEffect(() => setPicked(initial), [initial]);
  const dirty = JSON.stringify([...picked].sort()) !== JSON.stringify([...initial].sort());
  function toggle(s: string) {
    setPicked((p) => {
      if (p.includes(s)) return p.filter((x) => x !== s);
      if (p.length >= 3) return p;
      return [...p, s];
    });
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {SPECIALIST_OPTIONS.map((s) => {
          const on = picked.includes(s);
          const atCap = !on && picked.length >= 3;
          return (
            <button
              key={s}
              type="button"
              disabled={disabled || atCap}
              onClick={() => toggle(s)}
              className={`px-2 py-1 rounded-full border text-xs ${
                on ? "bg-violet-500/20 border-violet-500 text-violet-200" :
                atCap ? "bg-slate-800/40 border-slate-700/40 text-slate-500 cursor-not-allowed" :
                "bg-slate-800/60 border-slate-700 text-slate-300"
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={disabled || !dirty || savingId === "spec"}
          onClick={() => onSave(picked)}
          className="px-3 py-1.5 text-xs rounded bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-40"
        >
          {savingId === "spec" ? "Saving…" : "Save specialists"}
        </button>
      </div>
    </div>
  );
}

function TokenWhitelistEditor({
  initial, disabled, savingId, onSave,
}: {
  initial: string[];
  disabled: boolean;
  savingId: string | null;
  onSave: (tokens: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>(initial);
  useEffect(() => setPicked(initial), [initial]);
  const dirty = JSON.stringify([...picked].sort()) !== JSON.stringify([...initial].sort());
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {TOKEN_OPTIONS.map((t) => {
          const on = picked.includes(t);
          return (
            <button
              key={t}
              type="button"
              disabled={disabled}
              onClick={() => setPicked((p) => (on ? p.filter((x) => x !== t) : [...p, t]))}
              className={`px-2 py-1 rounded-full border text-xs ${
                on ? "bg-violet-500/20 border-violet-500 text-violet-200" : "bg-slate-800/60 border-slate-700 text-slate-300"
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={disabled || !dirty || savingId === "tok"}
          onClick={() => onSave(picked)}
          className="px-3 py-1.5 text-xs rounded bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-40"
        >
          {savingId === "tok" ? "Saving…" : "Save tokens"}
        </button>
      </div>
    </div>
  );
}

function MembershipsEditor({
  cartridgeSlug, memberships, disabled, onChanged,
}: {
  cartridgeSlug: string;
  memberships: Membership[];
  disabled: boolean;
  onChanged: () => void;
}) {
  const [invitePersonaId, setInvitePersonaId] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function doInvite() {
    if (!invitePersonaId.trim()) return;
    setInviting(true);
    setErr(null);
    try {
      const res = await personaFetch(`/api/cartridge/${encodeURIComponent(cartridgeSlug)}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId: invitePersonaId.trim(), role: inviteRole }),
      });
      const j = (await res.json()) as { ok: boolean; error?: string; detail?: string };
      if (!res.ok || !j.ok) throw new Error(j.detail || j.error || `invite failed (${res.status})`);
      setInvitePersonaId("");
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setInviting(false);
    }
  }

  async function doRevoke(personaIdToken: string | null) {
    if (!personaIdToken) return;
    setRevoking(personaIdToken);
    setErr(null);
    // The list view exposes a display token (8-char prefix); the
    // operator must paste the full id into the invite form to act.
    // Phase 7b will resolve display tokens server-side for one-click
    // revoke. For Phase 7, surface the deny clearly.
    setErr("Revoke by display token isn't supported yet — Phase 7b resolves the full personaId server-side. For now, use the persona inspector to get the full id and DELETE /api/cartridge/<slug>/members/<personaId> directly.");
    setRevoking(null);
  }

  return (
    <div className="space-y-3">
      {/* Invite form */}
      <div className="flex flex-wrap gap-2 items-center p-3 rounded border border-slate-700/60 bg-slate-800/40">
        <UserPlus className="w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="personaId (full id)"
          value={invitePersonaId}
          disabled={disabled}
          onChange={(e) => setInvitePersonaId(e.target.value)}
          className="flex-1 min-w-[200px] px-2 py-1 rounded bg-slate-900/60 border border-slate-700 text-xs font-mono"
        />
        <select
          value={inviteRole}
          disabled={disabled}
          onChange={(e) => setInviteRole(e.target.value)}
          className="px-2 py-1 rounded bg-slate-900/60 border border-slate-700 text-xs"
        >
          {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button
          type="button"
          disabled={disabled || inviting || invitePersonaId.trim().length === 0}
          onClick={doInvite}
          className="px-3 py-1 text-xs rounded bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-40"
        >
          {inviting ? "Inviting…" : "Invite"}
        </button>
      </div>

      {err && (
        <div className="px-3 py-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded">
          {err}
        </div>
      )}

      {/* Roster */}
      <ul className="space-y-1">
        {memberships.length === 0 && (
          <li className="text-xs text-slate-500">No members yet (other than you).</li>
        )}
        {memberships.map((m, i) => (
          <li
            key={`${m.personaDisplayToken}-${i}`}
            className="flex items-center gap-2 px-3 py-1.5 rounded border border-slate-700/60 bg-slate-800/40 text-sm"
          >
            <Sparkles className="w-3 h-3 text-violet-400" />
            <span className="font-mono text-xs text-slate-400 flex-1 truncate">
              {m.personaDisplayToken ?? "(unknown)"}
            </span>
            <Chip>{m.role}</Chip>
            {m.role !== "owner" && (
              <button
                type="button"
                disabled={disabled || revoking !== null}
                onClick={() => doRevoke(m.personaDisplayToken)}
                title="Revoke (Phase 7b — currently shows the manual delete path)"
                className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-300"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
