"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X, Save, Fingerprint, ChevronDown, ChevronUp,
  User, Mail, Phone, MapPin, Plus, Trash2,
  AlertCircle, CheckCircle2, Loader2, ShieldCheck,
} from "lucide-react";

// ─── Auth helper (same as PersonaIQubeDrawer) ─────────────────────────────────

function getAccessTokenFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.includes("auth-token")) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { access_token?: string };
      if (parsed?.access_token) return parsed.access_token;
    }
  } catch { /* ignore */ }
  return null;
}

function authHeaders(): Record<string, string> {
  const token = getAccessTokenFromStorage();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailEntry  { id: string; address: string; label: string; primary: boolean }
interface PhoneEntry  { id: string; number: string;  label: string; primary: boolean }
interface AddressEntry { id: string; street: string; city: string; state: string; country: string; postal: string; label: string; primary: boolean }
interface PersonaEntry { id: string; type: "knyt" | "qripto" | "custom"; label: string; uuid: string }

interface IdentityData {
  id?: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  date_of_birth: string;
  emails: EmailEntry[];
  phones: PhoneEntry[];
  addresses: AddressEntry[];
  personas: PersonaEntry[];
  driving_license_number: string;
  driving_license_state: string;
  driving_license_expiry: string;
  fio_handle: string;
}

const EMPTY: IdentityData = {
  first_name: "", last_name: "", middle_name: "", date_of_birth: "",
  emails: [], phones: [], addresses: [], personas: [],
  driving_license_number: "", driving_license_state: "", driving_license_expiry: "",
  fio_handle: "",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ icon, title, children, defaultOpen = true }: {
  icon: React.ReactNode; title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/5">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="flex w-full items-center justify-between px-4 py-2.5 hover:bg-white/5 transition">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          {icon}{title}
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-slate-500" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-500" />}
      </button>
      {open && <div className="px-4 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, optional }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; optional?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}{optional && <span className="ml-1 text-slate-600">(optional)</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:bg-white/8 transition" />
    </div>
  );
}

function uid() { return Math.random().toString(36).slice(2); }

// ─── Main component ───────────────────────────────────────────────────────────

interface RootDidState {
  rootDid: string | null;
  rootId: string | null;
  kycStatus: string | null;
  isNew?: boolean;
  personas: Array<{
    personaType: string;
    didPersonaId: string;
    fioHandle: string | null;
    evmAddress: string | null;
  }>;
}

export function IdentityIQubeDrawer({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<IdentityData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [rootDid, setRootDid] = useState<RootDidState | null>(null);
  const [bindLoading, setBindLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setBindLoading(true); setError(null);
    try {
      // Bind root DID + load identity in parallel
      const [bindRes, identityRes] = await Promise.all([
        fetch("/api/identity/root-did/bind", { method: "POST", headers: authHeaders() }),
        fetch("/api/iqube/identity", { headers: authHeaders() }),
      ]);
      if (bindRes.ok) {
        const bindJson = await bindRes.json() as RootDidState;
        setRootDid(bindJson);
      }
      setBindLoading(false);
      const json = await identityRes.json() as { exists?: boolean; data?: IdentityData; error?: string };
      if (!identityRes.ok) throw new Error(json.error ?? "Failed to load");
      setData(json.exists && json.data ? json.data : EMPTY);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally { setLoading(false); setBindLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const update = (patch: Partial<IdentityData>) => { setData(p => ({ ...p, ...patch })); setDirty(true); };

  const handleSave = async () => {
    setSaving(true); setSaveSuccess(false); setError(null);
    try {
      const res = await fetch("/api/iqube/identity", {
        method: "PATCH", headers: authHeaders(), body: JSON.stringify(data),
      });
      const json = await res.json() as { data?: IdentityData; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      if (json.data) setData(json.data);
      setSaveSuccess(true); setDirty(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  };

  // ── Emails helpers
  const addEmail = () => update({ emails: [...data.emails, { id: uid(), address: "", label: "personal", primary: data.emails.length === 0 }] });
  const updateEmail = (id: string, patch: Partial<EmailEntry>) => update({ emails: data.emails.map(e => e.id === id ? { ...e, ...patch } : e) });
  const removeEmail = (id: string) => update({ emails: data.emails.filter(e => e.id !== id) });

  // ── Phones helpers
  const addPhone = () => update({ phones: [...data.phones, { id: uid(), number: "", label: "mobile", primary: data.phones.length === 0 }] });
  const updatePhone = (id: string, patch: Partial<PhoneEntry>) => update({ phones: data.phones.map(p => p.id === id ? { ...p, ...patch } : p) });
  const removePhone = (id: string) => update({ phones: data.phones.filter(p => p.id !== id) });

  // ── Addresses helpers
  const addAddress = () => update({ addresses: [...data.addresses, { id: uid(), street: "", city: "", state: "", country: "", postal: "", label: "home", primary: data.addresses.length === 0 }] });
  const updateAddress = (id: string, patch: Partial<AddressEntry>) => update({ addresses: data.addresses.map(a => a.id === id ? { ...a, ...patch } : a) });
  const removeAddress = (id: string) => update({ addresses: data.addresses.filter(a => a.id !== id) });

  return (
    <div className="flex flex-col h-full bg-slate-950 border-r border-white/10 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-900/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Fingerprint className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-semibold text-slate-200">Identity iQube</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">DIDQube</span>
          {rootDid?.rootDid && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Root DID</span>
          )}
        </div>
        <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white transition">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
          </div>
        ) : (
          <>
            {error && (
              <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />{error}
              </div>
            )}

            {/* Core Identity */}
            <Section icon={<User className="h-3.5 w-3.5" />} title="Name">
              <Field label="First Name" value={data.first_name} onChange={v => update({ first_name: v })} />
              <Field label="Middle Name" value={data.middle_name} onChange={v => update({ middle_name: v })} optional />
              <Field label="Last Name" value={data.last_name} onChange={v => update({ last_name: v })} />
              <Field label="Date of Birth" value={data.date_of_birth} onChange={v => update({ date_of_birth: v })} type="date" optional />
            </Section>

            {/* Emails */}
            <Section icon={<Mail className="h-3.5 w-3.5" />} title="Email Addresses">
              {data.emails.map(e => (
                <div key={e.id} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1">
                    <input value={e.address} onChange={ev => updateEmail(e.id, { address: ev.target.value })}
                      placeholder="email@example.com" type="email"
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition" />
                    <div className="flex gap-2">
                      <select value={e.label} onChange={ev => updateEmail(e.id, { label: ev.target.value })}
                        className="flex-1 rounded bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-slate-400 focus:outline-none">
                        {["personal", "work", "other"].map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                      <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                        <input type="checkbox" checked={e.primary} onChange={() => updateEmail(e.id, { primary: true })} className="accent-cyan-500" />
                        primary
                      </label>
                    </div>
                  </div>
                  <button type="button" onClick={() => removeEmail(e.id)} className="mt-1.5 p-1 text-slate-500 hover:text-red-400 transition">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addEmail}
                className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition mt-1">
                <Plus className="h-3.5 w-3.5" />Add email
              </button>
            </Section>

            {/* Phones */}
            <Section icon={<Phone className="h-3.5 w-3.5" />} title="Phone Numbers">
              {data.phones.map(p => (
                <div key={p.id} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1">
                    <input value={p.number} onChange={ev => updatePhone(p.id, { number: ev.target.value })}
                      placeholder="+1 000 000 0000" type="tel"
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition" />
                    <div className="flex gap-2">
                      <select value={p.label} onChange={ev => updatePhone(p.id, { label: ev.target.value })}
                        className="flex-1 rounded bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-slate-400 focus:outline-none">
                        {["mobile", "home", "work", "other"].map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                      <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                        <input type="checkbox" checked={p.primary} onChange={() => updatePhone(p.id, { primary: true })} className="accent-cyan-500" />
                        primary
                      </label>
                    </div>
                  </div>
                  <button type="button" onClick={() => removePhone(p.id)} className="mt-1.5 p-1 text-slate-500 hover:text-red-400 transition">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addPhone}
                className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition mt-1">
                <Plus className="h-3.5 w-3.5" />Add phone
              </button>
            </Section>

            {/* Addresses */}
            <Section icon={<MapPin className="h-3.5 w-3.5" />} title="Addresses">
              {data.addresses.map(a => (
                <div key={a.id} className="space-y-1.5 pb-2 border-b border-white/5 last:border-0">
                  <div className="flex justify-between items-center">
                    <select value={a.label} onChange={ev => updateAddress(a.id, { label: ev.target.value })}
                      className="rounded bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-slate-400 focus:outline-none">
                      {["home", "work", "other"].map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <button type="button" onClick={() => removeAddress(a.id)} className="p-1 text-slate-500 hover:text-red-400 transition">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <input value={a.street} onChange={ev => updateAddress(a.id, { street: ev.target.value })}
                    placeholder="Street address"
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition" />
                  <div className="grid grid-cols-2 gap-2">
                    {(["city", "state", "postal", "country"] as const).map(f => (
                      <input key={f} value={a[f]} onChange={ev => updateAddress(a.id, { [f]: ev.target.value })}
                        placeholder={f.charAt(0).toUpperCase() + f.slice(1)}
                        className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition" />
                    ))}
                  </div>
                </div>
              ))}
              <button type="button" onClick={addAddress}
                className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition mt-1">
                <Plus className="h-3.5 w-3.5" />Add address
              </button>
            </Section>

            {/* Personas */}
            <Section icon={<ShieldCheck className="h-3.5 w-3.5" />} title="Personas" defaultOpen={false}>
              {data.personas.length === 0 ? (
                <p className="text-xs text-slate-600 italic">No personas linked yet. Your KNYT and Qripto personas will appear here once created.</p>
              ) : (
                data.personas.map(p => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                    <div>
                      <span className="text-xs font-medium text-slate-200">{p.label}</span>
                      <span className="ml-2 text-[10px] text-slate-500 capitalize">{p.type}</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-600 truncate max-w-[100px]">{p.uuid}</span>
                  </div>
                ))
              )}
            </Section>

            {/* State-issued ID */}
            <Section icon={<ShieldCheck className="h-3.5 w-3.5" />} title="State-Issued ID" defaultOpen={false}>
              <p className="text-[11px] text-slate-500 mb-2">Optional. Stored encrypted in your blakQube.</p>
              <Field label="Driving Licence Number" value={data.driving_license_number}
                onChange={v => update({ driving_license_number: v })} optional />
              <div className="grid grid-cols-2 gap-2">
                <Field label="State / Region" value={data.driving_license_state}
                  onChange={v => update({ driving_license_state: v })} optional />
                <Field label="Expiry" value={data.driving_license_expiry}
                  onChange={v => update({ driving_license_expiry: v })} type="date" optional />
              </div>
            </Section>

            {/* DIDQube — sovereign identity layer */}
            <Section icon={<Fingerprint className="h-3.5 w-3.5" />} title="DIDQube" defaultOpen={false}>
              <Field label="FIO Handle" value={data.fio_handle}
                onChange={v => update({ fio_handle: v })}
                placeholder="yourname@fio" />

              <div className="mt-3 rounded-xl bg-amber-950/20 ring-1 ring-amber-700/20 p-3 space-y-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-amber-400/70">Root Identity</span>
                  {bindLoading && <Loader2 className="h-3 w-3 animate-spin text-amber-500/40" />}
                  {!bindLoading && rootDid?.rootDid && (
                    <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded px-1.5 py-0.5">Bound</span>
                  )}
                  {!bindLoading && !rootDid?.rootDid && (
                    <span className="text-[9px] bg-slate-700/40 text-slate-500 border border-slate-700/40 rounded px-1.5 py-0.5">Unbound</span>
                  )}
                </div>

                {rootDid?.rootDid ? (
                  <>
                    {/* Root DID */}
                    <div className="flex items-start justify-between gap-2 py-1 border-b border-amber-900/20">
                      <span className="text-[11px] text-slate-500 shrink-0">Root DID</span>
                      <span className="text-[11px] font-mono text-amber-300/80 break-all text-right leading-tight">
                        {rootDid.rootDid}
                      </span>
                    </div>

                    {/* Kybe DID — dev stub, activates with proof-of-personhood */}
                    <div className="flex items-start justify-between gap-2 py-1 border-b border-amber-900/20">
                      <span className="text-[11px] text-slate-500 shrink-0">Kybe DID</span>
                      <div className="text-right">
                        <span className="text-[11px] font-mono text-slate-400">did:kybe:dev:stub:v1</span>
                        <span className="ml-1.5 text-[9px] bg-slate-700/50 text-slate-500 rounded px-1 py-0.5">dev stub</span>
                      </div>
                    </div>

                    {/* KYC status */}
                    <div className="flex items-center justify-between gap-2 py-1 border-b border-amber-900/20">
                      <span className="text-[11px] text-slate-500">KYC Status</span>
                      <span className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${
                        rootDid.kycStatus === "kycd"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                          : "bg-slate-700/40 text-slate-400 border border-slate-700/40"
                      }`}>
                        {rootDid.kycStatus ?? "unverified"}
                      </span>
                    </div>

                    {/* Linked personas */}
                    {rootDid.personas.length > 0 && (
                      <div className="pt-1 space-y-1">
                        <span className="text-[10px] uppercase tracking-wider text-slate-600">Linked Personas</span>
                        {rootDid.personas.map((p) => (
                          <div key={p.didPersonaId} className="rounded-lg bg-slate-900/60 border border-slate-800/40 p-2 space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-medium text-slate-300 capitalize">{p.personaType} Persona</span>
                              {p.fioHandle && (
                                <span className="text-[10px] font-mono text-cyan-400">{p.fioHandle}</span>
                              )}
                            </div>
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[10px] text-slate-600">Persona DID ID</span>
                              <span className="text-[10px] font-mono text-slate-500 break-all text-right leading-tight">
                                {p.didPersonaId}
                              </span>
                            </div>
                            {p.evmAddress && (
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-[10px] text-slate-600">EVM</span>
                                <span className="text-[10px] font-mono text-slate-500">
                                  {`${p.evmAddress.slice(0, 8)}…${p.evmAddress.slice(-6)}`}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {rootDid.isNew && (
                      <p className="text-[10px] text-amber-400/60 pt-1">Root identity created this session.</p>
                    )}
                  </>
                ) : !bindLoading ? (
                  <p className="text-[11px] text-slate-600">Open a persona iQube drawer to establish your root identity.</p>
                ) : (
                  <p className="text-[11px] text-slate-600">Resolving identity…</p>
                )}
              </div>
            </Section>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-white/10 px-4 py-3 flex items-center justify-between bg-slate-900/60">
        {saveSuccess && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />Saved
          </span>
        )}
        {!saveSuccess && <span />}
        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/10 transition">
            Close
          </button>
          <button type="button" onClick={handleSave} disabled={!dirty || saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-cyan-600 hover:bg-cyan-500 text-white transition disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
