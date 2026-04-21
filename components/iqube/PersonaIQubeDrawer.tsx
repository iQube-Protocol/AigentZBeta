"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X, Lock, Save, Shield, ChevronDown, ChevronUp,
  Wallet, Globe, User, Database, Settings, Eye, EyeOff,
  AlertCircle, CheckCircle2, Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PersonaType = "knyt" | "qripto";

interface IQubeData {
  metaQube: Record<string, unknown>;
  blakQube: Record<string, unknown>;
  tokenQube: Record<string, unknown>;
  _id: string;
}

interface Props {
  type: PersonaType;
  isAdmin?: boolean;
  onClose: () => void;
}

type Tab = "metaQube" | "blakQube" | "tokenQube" | "admin";

// ─── Field config (mirrors seed script definitions) ──────────────────────────

type FieldSource = "user" | "wallet" | "chain" | "oauth" | "csv" | "system" | "admin";

interface FieldDef {
  key: string;
  label: string;
  editable: boolean;
  locked_after_set?: boolean;
  admin_only?: boolean;
  source: FieldSource;
  wallet_connect?: "evm" | "btc" | "solana";
  isArray?: boolean;
}

const SOURCE_LABEL: Record<FieldSource, string> = {
  user: "User-entered",
  wallet: "Wallet / DIDQube",
  chain: "On-chain (read-only)",
  oauth: "OAuth (LinkedIn)",
  csv: "Ledger import",
  system: "System-generated",
  admin: "Admin-managed",
};

// ─── KNYT section/field map ───────────────────────────────────────────────────

const KNYT_SECTIONS: { title: string; icon: React.ReactNode; fields: FieldDef[] }[] = [
  {
    title: "Identity",
    icon: <User className="h-3.5 w-3.5" />,
    fields: [
      { key: "First-Name",        label: "First Name",       editable: true,  source: "user" },
      { key: "Last-Name",         label: "Last Name",        editable: true,  source: "user" },
      { key: "Email",             label: "Email",            editable: true,  source: "user" },
      { key: "Phone-Number",      label: "Phone",            editable: true,  source: "user" },
      { key: "Age",               label: "Age",              editable: true,  source: "user" },
      { key: "Address",           label: "Address",          editable: true,  source: "user" },
      { key: "Profession",        label: "Profession",       editable: true,  source: "user" },
      { key: "Local-City",        label: "City",             editable: true,  source: "user" },
      { key: "KNYT-ID",           label: "KNYT ID",          editable: false, source: "admin" },
    ],
  },
  {
    title: "Handles",
    icon: <Shield className="h-3.5 w-3.5" />,
    fields: [
      { key: "fio_handle",   label: "FIO Handle",   editable: false, locked_after_set: true, source: "wallet" },
      { key: "knyt_handle",  label: "KNYT Handle",  editable: false, locked_after_set: true, source: "wallet" },
    ],
  },
  {
    title: "Crypto Wallet",
    icon: <Wallet className="h-3.5 w-3.5" />,
    fields: [
      { key: "EVM-Public-Key",      label: "EVM Address",     editable: true,  source: "user", wallet_connect: "evm" },
      { key: "BTC-Public-Key",      label: "BTC Address",     editable: true,  source: "user", wallet_connect: "btc" },
      { key: "Solana-Public-Key",   label: "Solana Address",  editable: true,  source: "user", wallet_connect: "solana" },
      { key: "ThirdWeb-Public-Key", label: "ThirdWeb Key",    editable: false, source: "wallet" },
      { key: "MetaKeep-Public-Key", label: "MetaKeep Key",    editable: false, source: "wallet" },
      { key: "Chain-IDs",           label: "Chain IDs",       editable: false, source: "chain", isArray: true },
      { key: "Wallets-of-Interest", label: "Wallets",         editable: true,  source: "user",  isArray: true },
      { key: "Tokens-of-Interest",  label: "Tokens",          editable: true,  source: "user",  isArray: true },
      { key: "Web3-Interests",      label: "Web3 Interests",  editable: true,  source: "user",  isArray: true },
    ],
  },
  {
    title: "Social",
    icon: <Globe className="h-3.5 w-3.5" />,
    fields: [
      { key: "LinkedIn-ID",          label: "LinkedIn ID",        editable: false, source: "oauth" },
      { key: "LinkedIn-Profile-URL", label: "LinkedIn URL",       editable: false, source: "oauth" },
      { key: "Twitter-Handle",       label: "X (Twitter)",        editable: true,  source: "user" },
      { key: "Telegram-Handle",      label: "Telegram",           editable: true,  source: "user" },
      { key: "Discord-Handle",       label: "Discord",            editable: true,  source: "user" },
      { key: "Instagram-Handle",     label: "Instagram",          editable: true,  source: "user" },
      { key: "YouTube-ID",           label: "YouTube",            editable: true,  source: "user" },
      { key: "Facebook-ID",          label: "Facebook",           editable: true,  source: "user" },
      { key: "TikTok-Handle",        label: "TikTok",             editable: true,  source: "user" },
    ],
  },
  {
    title: "Membership",
    icon: <Shield className="h-3.5 w-3.5" />,
    fields: [
      { key: "OM-Member-Since",      label: "OM Member Since",      editable: false, source: "csv" },
      { key: "OM-Tier-Status",       label: "OM Tier",              editable: false, source: "admin" },
      { key: "Metaiye-Shares-Owned", label: "Metaiye Shares",       editable: false, source: "csv" },
      { key: "Total-Invested",       label: "Total Invested (USD)", editable: false, source: "csv" },
    ],
  },
  {
    title: "Crypto KNYT Holdings",
    icon: <Database className="h-3.5 w-3.5" />,
    fields: [
      { key: "KNYT-COYN-Owned",        label: "KNYT COYN (EVM Mainnet)", editable: false, source: "chain" },
      { key: "KNYT-COYN-Qripto-Owned", label: "KNYT COYN (Qripto)",      editable: false, source: "chain" },
      { key: "metaknyts_iqubes_owned",  label: "metaKnyts iQubes Owned",  editable: false, source: "chain" },
    ],
  },
  {
    title: "Non-Crypto KNYT Holdings",
    icon: <Database className="h-3.5 w-3.5" />,
    fields: [
      { key: "Motion-Comics-Owned",  label: "Motion Comics",  editable: true, source: "user" },
      { key: "Print-Comics-Owned",   label: "Print Comics",   editable: true, source: "user" },
      { key: "Digital-Comics-Owned", label: "Digital Comics", editable: true, source: "user" },
      { key: "KNYT-Posters-Owned",   label: "Posters",        editable: true, source: "user" },
      { key: "Print-Cards-Owned",    label: "Print Cards",    editable: true, source: "user" },
      { key: "Digital-Cards-Owned",  label: "Digital Cards",  editable: true, source: "user" },
      { key: "Characters-Owned",     label: "Characters",     editable: true, source: "user" },
      { key: "print_episodes_owned", label: "Print Episodes", editable: true, source: "user" },
    ],
  },
  {
    title: "Investment History",
    icon: <Database className="h-3.5 w-3.5" />,
    fields: [
      { key: "csv_investment_status",    label: "Status",            editable: false, source: "csv" },
      { key: "csv_first_committed_date", label: "First Committed",   editable: false, source: "csv" },
      { key: "csv_last_disbursed_date",  label: "Last Disbursed",    editable: false, source: "csv" },
      { key: "csv_transfer_methods",     label: "Transfer Methods",  editable: false, source: "csv" },
      { key: "csv_transaction_count",    label: "Transactions",      editable: false, source: "csv" },
      { key: "csv_metaknyt_nfts",        label: "metaKnyt NFTs",     editable: false, source: "csv" },
      { key: "csv_other_nfts",           label: "Other NFTs",        editable: false, source: "csv" },
    ],
  },
  {
    title: "Preferences",
    icon: <Settings className="h-3.5 w-3.5" />,
    fields: [
      { key: "preferred_channel_primary",   label: "Primary Channel",   editable: true,  source: "user" },
      { key: "preferred_channel_secondary", label: "Secondary Channel", editable: true,  source: "user" },
      { key: "investment_amount_band",      label: "Investment Band",   editable: false, source: "system" },
    ],
  },
  {
    title: "Platform",
    icon: <Settings className="h-3.5 w-3.5" />,
    fields: [
      { key: "platform_activated_at", label: "Platform Activated", editable: false, source: "system" },
    ],
  },
];

const QRIPTO_SECTIONS: typeof KNYT_SECTIONS = [
  {
    title: "Identity",
    icon: <User className="h-3.5 w-3.5" />,
    fields: [
      { key: "First-Name",        label: "First Name",    editable: true,  source: "user" },
      { key: "Last-Name",         label: "Last Name",     editable: true,  source: "user" },
      { key: "Email",             label: "Email",         editable: true,  source: "user" },
      { key: "Profession",        label: "Profession",    editable: true,  source: "user" },
      { key: "Local-City",        label: "City",          editable: true,  source: "user" },
      { key: "Qripto-ID",        label: "Qripto ID",     editable: false, source: "admin" },
    ],
  },
  {
    title: "Handles",
    icon: <Shield className="h-3.5 w-3.5" />,
    fields: [
      { key: "fio_handle",   label: "FIO Handle",   editable: false, locked_after_set: true, source: "wallet" },
      { key: "knyt_handle",  label: "KNYT Handle",  editable: false, locked_after_set: true, source: "wallet" },
    ],
  },
  {
    title: "Crypto Wallet",
    icon: <Wallet className="h-3.5 w-3.5" />,
    fields: [
      { key: "EVM-Public-Key",      label: "EVM Address",    editable: true,  source: "user", wallet_connect: "evm" },
      { key: "BTC-Public-Key",      label: "BTC Address",    editable: true,  source: "user", wallet_connect: "btc" },
      { key: "Solana-Public-Key",   label: "Solana Address", editable: true,  source: "user", wallet_connect: "solana" },
      { key: "Chain-IDs",           label: "Chain IDs",      editable: false, source: "chain", isArray: true },
      { key: "Wallets-of-Interest", label: "Wallets",        editable: true,  source: "user",  isArray: true },
      { key: "Tokens-of-Interest",  label: "Tokens",         editable: true,  source: "user",  isArray: true },
      { key: "Web3-Interests",      label: "Web3 Interests", editable: true,  source: "user",  isArray: true },
    ],
  },
  {
    title: "Social",
    icon: <Globe className="h-3.5 w-3.5" />,
    fields: [
      { key: "LinkedIn-ID",          label: "LinkedIn ID",   editable: false, source: "oauth" },
      { key: "LinkedIn-Profile-URL", label: "LinkedIn URL",  editable: false, source: "oauth" },
      { key: "Twitter-Handle",       label: "X (Twitter)",   editable: true,  source: "user" },
      { key: "Telegram-Handle",      label: "Telegram",      editable: true,  source: "user" },
      { key: "Discord-Handle",       label: "Discord",       editable: true,  source: "user" },
      { key: "Instagram-Handle",     label: "Instagram",     editable: true,  source: "user" },
      { key: "GitHub-Handle",        label: "GitHub",        editable: true,  source: "user" },
      { key: "YouTube-ID",           label: "YouTube",       editable: true,  source: "user" },
      { key: "Facebook-ID",          label: "Facebook",      editable: true,  source: "user" },
      { key: "TikTok-Handle",        label: "TikTok",        editable: true,  source: "user" },
    ],
  },
  {
    title: "Preferences",
    icon: <Settings className="h-3.5 w-3.5" />,
    fields: [
      { key: "preferred_channel_primary",   label: "Primary Channel",   editable: true, source: "user" },
      { key: "preferred_channel_secondary", label: "Secondary Channel", editable: true, source: "user" },
    ],
  },
  {
    title: "Platform",
    icon: <Settings className="h-3.5 w-3.5" />,
    fields: [
      { key: "platform_activated_at", label: "Platform Activated", editable: false, source: "system" },
    ],
  },
];

const ADMIN_FIELDS: FieldDef[] = [
  { key: "platform_auth_profile_id", label: "Auth Profile ID",       editable: false, admin_only: true, source: "system" },
  { key: "campaign_cohort",          label: "Campaign Cohort",        editable: true,  admin_only: true, source: "admin" },
  { key: "campaign_state",           label: "Campaign State",         editable: true,  admin_only: true, source: "admin" },
  { key: "offer_fit",                label: "Offer Fit",              editable: true,  admin_only: true, source: "admin" },
  { key: "message_angle",            label: "Message Angle",          editable: true,  admin_only: true, source: "admin" },
  { key: "reactivation_potential",   label: "Reactivation Potential", editable: true,  admin_only: true, source: "admin" },
  { key: "investor_priority_band",   label: "Priority Band",          editable: true,  admin_only: true, source: "admin" },
  { key: "kickstarter_clicked_at",   label: "KS Clicked At",          editable: false, admin_only: true, source: "system" },
  { key: "kickstarter_backed_at",    label: "KS Backed At",           editable: false, admin_only: true, source: "system" },
  { key: "last_campaign_sent_at",    label: "Last Campaign Sent",     editable: false, admin_only: true, source: "system" },
  { key: "last_campaign_sequence",   label: "Last Campaign Sequence", editable: false, admin_only: true, source: "system" },
  { key: "campaign_notes",           label: "Campaign Notes",         editable: true,  admin_only: true, source: "admin" },
  { key: "campaign_tags",            label: "Campaign Tags",          editable: true,  admin_only: true, source: "admin", isArray: true },
];

// ─── Field row ────────────────────────────────────────────────────────────────

function FieldRow({
  def,
  value,
  editValues,
  onChange,
}: {
  def: FieldDef;
  value: unknown;
  editValues: Record<string, string>;
  onChange: (key: string, val: string) => void;
}) {
  const displayVal = def.isArray
    ? Array.isArray(value) ? (value as string[]).join(", ") : String(value ?? "")
    : String(value ?? "");

  const isLocked = !def.editable || (def.locked_after_set && displayVal.trim() !== "");
  const editVal = editValues[def.key] ?? displayVal;

  return (
    <div className="grid grid-cols-[140px_1fr_auto] gap-2 items-start py-1.5 border-b border-slate-800/40">
      <div className="flex items-center gap-1 min-w-0">
        {isLocked && <Lock className="h-3 w-3 shrink-0 text-slate-500" />}
        <span className="text-[11px] text-slate-400 truncate">{def.label}</span>
      </div>

      {isLocked ? (
        <span className="text-[11px] text-slate-300 break-all">{displayVal || <span className="text-slate-600 italic">—</span>}</span>
      ) : (
        <input
          type="text"
          value={editVal}
          onChange={(e) => onChange(def.key, e.target.value)}
          placeholder={`Enter ${def.label.toLowerCase()}`}
          className="bg-slate-800/60 border border-slate-700/50 rounded px-2 py-0.5 text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 w-full"
        />
      )}

      <div className="flex items-center gap-1">
        {def.wallet_connect && !isLocked && (
          <span className="text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded px-1 py-0.5 whitespace-nowrap">
            {def.wallet_connect === "evm" ? "MetaMask" : def.wallet_connect === "btc" ? "BTC Wallet" : "Phantom"}
          </span>
        )}
        {isLocked && (
          <span
            title={SOURCE_LABEL[def.source]}
            className="text-[9px] bg-slate-700/40 text-slate-500 rounded px-1 py-0.5 whitespace-nowrap"
          >
            {def.source}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function Section({
  title,
  icon,
  fields,
  blakQube,
  editValues,
  onChange,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ReactNode;
  fields: FieldDef[];
  blakQube: Record<string, unknown>;
  editValues: Record<string, string>;
  onChange: (key: string, val: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-800/60 rounded-lg mb-2 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-900/60 hover:bg-slate-800/60 transition"
      >
        <div className="flex items-center gap-2 text-[11px] font-medium text-slate-300">
          <span className="text-slate-500">{icon}</span>
          {title}
        </div>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
        )}
      </button>
      {open && (
        <div className="px-3 py-1 bg-slate-950/40">
          {fields.map((f) => (
            <FieldRow
              key={f.key}
              def={f}
              value={blakQube[f.key]}
              editValues={editValues}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main drawer ──────────────────────────────────────────────────────────────

export function PersonaIQubeDrawer({ type, isAdmin = false, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("blakQube");
  const [iqubeData, setIqubeData] = useState<IQubeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const displayName = type === "knyt" ? "KNYT Persona" : "Qripto Persona";
  const sections = type === "knyt" ? KNYT_SECTIONS : QRIPTO_SECTIONS;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/iqube/persona/${type}`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      if (json.exists && json.data) {
        setIqubeData(json.data);
      } else {
        setIqubeData(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => { void load(); }, [load]);

  const handleChange = useCallback((key: string, val: string) => {
    setEditValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setError(null);
    try {
      const res = await fetch(`/api/iqube/persona/${type}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editValues),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setIqubeData(json.data);
      setEditValues({});
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleMint = async () => {
    setMinting(true);
    setError(null);
    try {
      const res = await fetch(`/api/iqube/persona/${type}/mint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Mint failed");
      alert(`iQube staged for minting (stub ID: ${json.stub_id}). Production minting wired to FIO PPK.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mint failed");
    } finally {
      setMinting(false);
    }
  };

  const blakQube = iqubeData?.blakQube ?? {};
  const metaQube = iqubeData?.metaQube ?? {};
  const tokenQube = iqubeData?.tokenQube ?? {};
  const hasDirty = Object.keys(editValues).length > 0;

  const tabs: { id: Tab; label: string }[] = [
    { id: "metaQube", label: "metaQube" },
    { id: "blakQube", label: "blakQube" },
    { id: "tokenQube", label: "tokenQube" },
    ...(isAdmin ? [{ id: "admin" as Tab, label: "Admin" }] : []),
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex flex-col w-full max-w-md h-full bg-slate-950 border-l border-slate-800/60 shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-4 py-3 border-b border-slate-800/60 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-white">{displayName} iQube</span>
            {iqubeData && (
              <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded px-1.5 py-0.5">
                Active
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-white hover:bg-white/10 transition"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 border-b border-slate-800/60 bg-slate-900/40">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-[11px] font-medium transition border-b-2 ${
                activeTab === t.id
                  ? "border-cyan-500 text-cyan-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              } ${t.id === "admin" ? "text-amber-400 hover:text-amber-300" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-40 gap-2 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-[12px]">Loading iQube…</span>
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-[12px] text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          ) : (
            <>
              {/* metaQube tab */}
              {activeTab === "metaQube" && (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-500 mb-3">
                    Public provenance and risk metadata — never contains PII.
                  </p>
                  {Object.entries(metaQube).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[160px_1fr] gap-2 py-1 border-b border-slate-800/40">
                      <span className="text-[11px] text-slate-500">{k}</span>
                      <span className="text-[11px] text-slate-300 break-all">
                        {Array.isArray(v) ? (v as string[]).join(", ") : String(v ?? "—")}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* blakQube tab */}
              {activeTab === "blakQube" && (
                <div>
                  {!iqubeData && (
                    <div className="mb-4 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-[12px] text-amber-300">
                      No {displayName} iQube found. Fill in your details below to create one.
                    </div>
                  )}
                  {sections.map((sec, i) => (
                    <Section
                      key={sec.title}
                      title={sec.title}
                      icon={sec.icon}
                      fields={sec.fields}
                      blakQube={blakQube}
                      editValues={editValues}
                      onChange={handleChange}
                      defaultOpen={i === 0}
                    />
                  ))}
                </div>
              )}

              {/* tokenQube tab */}
              {activeTab === "tokenQube" && (
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-500">
                    Ownership, wallet binding, and on-chain mint status.
                  </p>
                  {[
                    ["Settlement Network", String(tokenQube.settlementNetwork ?? "Ethereum Mainnet (chainId 0x1)")],
                    ["EVM Address", String(tokenQube.evmAddress ?? "—")],
                    ["FIO Handle", String(tokenQube.fioHandle ?? "—")],
                    ["KNYT Handle", String(tokenQube.knytHandle ?? "—")],
                    ["Mint Status", String(tokenQube.mintStatus ?? "unminted")],
                  ].map(([label, val]) => (
                    <div key={label} className="grid grid-cols-[140px_1fr] gap-2 py-1 border-b border-slate-800/40">
                      <span className="text-[11px] text-slate-500">{label}</span>
                      <span className="text-[11px] text-slate-300 break-all">{val}</span>
                    </div>
                  ))}
                  {tokenQube.walletRequired && (
                    <div className="mt-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 p-3 text-[12px] text-cyan-300">
                      Connect a wallet to enable on-chain balance reading and minting.
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleMint}
                    disabled={minting || !iqubeData}
                    className="mt-4 w-full rounded-lg bg-amber-500/20 border border-amber-500/30 px-4 py-2 text-[12px] font-medium text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    {minting ? (
                      <span className="flex items-center justify-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Staging…</span>
                    ) : "Stage for Minting"}
                  </button>
                  <p className="text-[10px] text-slate-600 text-center">
                    Autonomys Drive + chain write wired to FIO PPK in production.
                  </p>
                </div>
              )}

              {/* Admin tab */}
              {activeTab === "admin" && isAdmin && (
                <div>
                  <p className="text-[11px] text-amber-400/70 mb-3">
                    Admin-only fields — not visible to the user.
                  </p>
                  <div className="border border-slate-800/60 rounded-lg p-3">
                    {ADMIN_FIELDS.map((f) => (
                      <FieldRow
                        key={f.key}
                        def={f}
                        value={blakQube[f.key]}
                        editValues={editValues}
                        onChange={handleChange}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="shrink-0 border-t border-slate-800/60 bg-slate-900/60 px-4 py-3 flex items-center justify-between gap-3">
          {saveSuccess && (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Saved
            </div>
          )}
          {!saveSuccess && <div />}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded text-[11px] text-slate-400 hover:text-slate-200 transition"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !hasDirty}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/80 hover:bg-cyan-600 text-white text-[11px] font-medium disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {saving ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
              ) : (
                <><Save className="h-3.5 w-3.5" /> Save Changes</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
