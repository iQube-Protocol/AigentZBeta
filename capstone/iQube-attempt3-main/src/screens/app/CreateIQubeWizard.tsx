import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Database, FileText, Wrench, Brain, Bot,
  Lock, ChevronRight, ChevronLeft, Plus, Trash2,
  Eye, EyeOff, AlertTriangle, CheckCircle, XCircle,
  Check, GitFork,
} from "lucide-react";
import { useWallet } from "../../context/WalletContext";
import { useMintQube } from "../../hooks/contractHooks";
import { pinata } from "../../utilities/pinata-config";
import EncryptionModule from "../../utilities/encryption";
import { authorizeDekStorage } from "../../utilities/keyWrapping";
import { supabase, isSupabaseConfigured } from "../../utilities/supabase";
import { getTokenIdFromMintReceipt } from "../../utilities/contractUtils";
import {
  type IQubeType, type IQubeCategory,
  type BusinessModel, type AccessPolicy, type BlakQubeField,
  type RiskLevel,
  calculateRiskScore, getRiskLevel, getDefaultSensitivity, getDefaultFields,
} from "../../types/iqube";

import Navbar from "../../components/Navbar";

// ─────────────────────────────────────────────────────────────────────────────
// Steps
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = ["Asset Type", "Details & Access", "Private Data", "Review"] as const;
type Step = 0 | 1 | 2 | 3;

// ─────────────────────────────────────────────────────────────────────────────
// Type options
// ─────────────────────────────────────────────────────────────────────────────

interface TypeOption {
  type: IQubeType;
  label: string;
  description: string;
  examples: string[];
  icon: React.ReactNode;
  iconColor: string;
  borderColor: string;
  bgColor: string;
  categories: IQubeCategory[];
}

const TYPE_OPTIONS: TypeOption[] = [
  {
    type: "DataQube",
    label: "Data Asset",
    description: "Credentials, profiles, personal information",
    examples: ["Password manager", "Identity vault", "Contact list"],
    icon: <Database size={28} />,
    iconColor: "#2563eb",
    borderColor: "#3b82f6",
    bgColor: "#eff6ff",
    categories: ["Credentials", "Profile", "Financial", "Health", "Other"],
  },
  {
    type: "ContentQube",
    label: "Content Asset",
    description: "Documents, media, creative works",
    examples: ["Research papers", "Images", "Articles"],
    icon: <FileText size={28} />,
    iconColor: "#9333ea",
    borderColor: "#a855f7",
    bgColor: "#faf5ff",
    categories: ["Article", "Research", "Video", "Image", "Other"],
  },
  {
    type: "ToolQube",
    label: "Tool Asset",
    description: "APIs, scripts, utilities",
    examples: ["REST APIs", "Automation scripts", "Plugins"],
    icon: <Wrench size={28} />,
    iconColor: "#ea580c",
    borderColor: "#f97316",
    bgColor: "#fff7ed",
    categories: ["REST API", "Function", "Script", "Plugin", "Other"],
  },
  {
    type: "ModelQube",
    label: "Model Asset",
    description: "AI/ML models, algorithms",
    examples: ["Neural networks", "Classifiers", "Predictors"],
    icon: <Brain size={28} />,
    iconColor: "#db2777",
    borderColor: "#ec4899",
    bgColor: "#fdf2f8",
    categories: ["LLM", "Classifier", "Neural Network", "Predictor", "Other"],
  },
  {
    type: "AgentQube",
    label: "Agent Asset",
    description: "Autonomous agents, bots",
    examples: ["Trading bots", "Chatbots", "Task automation"],
    icon: <Bot size={28} />,
    iconColor: "#059669",
    borderColor: "#10b981",
    bgColor: "#ecfdf5",
    categories: ["Trading Bot", "Chatbot", "Task Automation", "Orchestrator", "Other"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Wizard state
// ─────────────────────────────────────────────────────────────────────────────

interface WizardState {
  iQubeType: IQubeType | null;
  category: IQubeCategory | null;
  title: string;
  description: string;
  fields: BlakQubeField[];
  accessPolicy: AccessPolicy;
  allowedAddresses: string;
  businessModel: BusinessModel;
  price: string;
  canView: boolean;
  canUse: boolean;
  canEdit: boolean;
  canDecrypt: boolean;
  canFork: boolean;
}

type StorageProvider = "pinata" | "autodrive";
const API_BASE_URL = import.meta.env.VITE_AGENT_API_BASE_URL || "http://localhost:4000";

const INITIAL_STATE: WizardState = {
  iQubeType: null,
  category: null,
  title: "",
  description: "",
  fields: [],
  accessPolicy: "only-me",
  allowedAddresses: "",
  businessModel: "Free",
  price: "",
  canView: true,
  canUse: true,
  canEdit: false,
  canDecrypt: true,
  canFork: false,
};

// Derive visibility from access policy for backward compatibility
function accessPolicyToVisibility(policy: AccessPolicy): string {
  if (policy === "only-me") return "private";
  if (policy === "specific") return "semi-private";
  return "public";
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress bar
// ─────────────────────────────────────────────────────────────────────────────

function StepBar({ current }: { current: Step }) {
  return (
    <div className="w-full mb-12">
      <div className="h-1 w-full bg-gray-200 rounded-full mb-6">
        <div
          className="h-1 bg-black rounded-full transition-all duration-500"
          style={{ width: `${((current + 1) / STEPS.length) * 100}%` }}
        />
      </div>
      <div className="flex justify-between">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-col items-center gap-2">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all ${
              i < current
                ? "bg-black border-black text-white"
                : i === current
                ? "bg-white border-black text-black"
                : "bg-white border-gray-300 text-gray-400"
            }`}>
              {i < current ? <Check size={15} /> : i + 1}
            </div>
            <span className={`text-xs font-medium ${i === current ? "text-black" : i < current ? "text-gray-500" : "text-gray-400"}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Nav buttons
// ─────────────────────────────────────────────────────────────────────────────

function NavButtons({ step, onBack, onNext, nextLabel = "Continue", nextDisabled = false }: {
  step: Step; onBack: () => void; onNext: () => void; nextLabel?: string; nextDisabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between mt-12 pt-8 border-t border-gray-200">
      {step > 0 ? (
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={16} /> Back
        </button>
      ) : <div />}
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-semibold bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {nextLabel} <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Asset Type
// ─────────────────────────────────────────────────────────────────────────────

function Step1AssetType({ state, onChange }: { state: WizardState; onChange: (s: Partial<WizardState>) => void }) {
  const selectedOption = TYPE_OPTIONS.find(o => o.type === state.iQubeType);

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-2">What are you creating?</h2>
      <p className="text-gray-500 text-base mb-10">Choose the type that best describes your asset.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "40px" }}>
        {TYPE_OPTIONS.map((opt) => {
          const selected = state.iQubeType === opt.type;
          return (
            <div
              key={opt.type}
              onClick={() => onChange({ iQubeType: opt.type, category: null, fields: [] })}
              style={{
                padding: "28px",
                borderRadius: "16px",
                border: selected ? `2px solid` : "2px solid #e5e7eb",
                borderColor: selected ? opt.borderColor : "#e5e7eb",
                backgroundColor: selected ? opt.bgColor : "#ffffff",
                cursor: "pointer",
                boxSizing: "border-box",
              }}
            >
              <div style={{ color: opt.iconColor, marginBottom: "16px" }}>{opt.icon}</div>
              <div style={{ fontWeight: 700, fontSize: "18px", color: "#111827", marginBottom: "6px" }}>{opt.label}</div>
              <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "16px" }}>{opt.description}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {opt.examples.map(ex => (
                  <span key={ex} style={{ padding: "4px 10px", borderRadius: "8px", fontSize: "12px", backgroundColor: "#f3f4f6", color: "#4b5563" }}>{ex}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selectedOption && (
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">Pick a category</p>
          <div className="flex flex-wrap gap-3">
            {selectedOption.categories.map((cat) => (
              <button
                key={cat}
                onClick={() => onChange({ category: cat, fields: getDefaultFields(selectedOption.type, cat) })}
                style={{
                  padding: "8px 20px",
                  borderRadius: "12px",
                  border: `2px solid ${state.category === cat ? selectedOption.borderColor : "#e5e7eb"}`,
                  backgroundColor: state.category === cat ? selectedOption.bgColor : "#ffffff",
                  color: state.category === cat ? selectedOption.iconColor : "#4b5563",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Details & Access (merged Basic Details + Access Control)
// ─────────────────────────────────────────────────────────────────────────────

const ACCESS_OPTIONS: Array<{ value: AccessPolicy; label: string; desc: string }> = [
  { value: "only-me",      label: "Just me",           desc: "Only you can see and access this" },
  { value: "specific",     label: "Specific people",   desc: "Shared with chosen wallet addresses" },
  { value: "requirements", label: "Public",             desc: "Anyone can discover this on the marketplace" },
];

const BUSINESS_MODELS: Array<{ value: BusinessModel; label: string; desc: string; hasPrice: boolean; placeholder?: string }> = [
  { value: "Free",      label: "Free",      desc: "No cost",          hasPrice: false },
  { value: "Buy",       label: "Buy",       desc: "One-time payment", hasPrice: true,  placeholder: "Price (e.g. 9.99)" },
  { value: "Subscribe", label: "Subscribe", desc: "Monthly fee",      hasPrice: true,  placeholder: "Price/month" },
  { value: "Rent",      label: "Rent",      desc: "Pay per use",      hasPrice: true,  placeholder: "Price per use" },
  { value: "License",   label: "License",   desc: "License fee",      hasPrice: true,  placeholder: "License fee" },
  { value: "Donate",    label: "Donate",    desc: "Voluntary",        hasPrice: false },
];

function Step2DetailsAndAccess({ state, onChange }: { state: WizardState; onChange: (s: Partial<WizardState>) => void }) {
  const selectedType = TYPE_OPTIONS.find(o => o.type === state.iQubeType);
  const selectedBM = BUSINESS_MODELS.find(o => o.value === state.businessModel)!;
  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Details & Access</h2>
      <p className="text-gray-500 text-base mb-10">Describe your {selectedType?.label ?? "asset"} and set who can access it.</p>

      <div className="space-y-10">
        {/* Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
          <input
            type="text"
            value={state.title}
            onChange={e => onChange({ title: e.target.value })}
            placeholder={
              state.iQubeType === "DataQube" ? "e.g. Gmail Account" :
              state.iQubeType === "ContentQube" ? "e.g. AI Ethics Research Paper" :
              "e.g. Weather API Service"
            }
            className="w-full px-5 py-4 rounded-xl bg-white border-2 border-gray-200 text-gray-900 placeholder-gray-400 text-base focus:outline-none focus:border-black transition-colors"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
          <textarea
            value={state.description}
            onChange={e => onChange({ description: e.target.value })}
            rows={3}
            placeholder="What is this asset? What does it contain or do?"
            className="w-full px-5 py-4 rounded-xl bg-white border-2 border-gray-200 text-gray-900 placeholder-gray-400 text-base resize-none focus:outline-none focus:border-black transition-colors"
          />
        </div>

        {/* Access policy */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">Who can access this?</label>
          <div className="space-y-3">
            {ACCESS_OPTIONS.map(opt => (
              <label key={opt.value}
                className={`flex items-center gap-5 p-5 rounded-xl border-2 cursor-pointer transition-colors ${
                  state.accessPolicy === opt.value ? "bg-gray-50 border-black" : "bg-white border-gray-200 hover:border-gray-400"
                }`}>
                <input type="radio" name="accessPolicy" checked={state.accessPolicy === opt.value}
                  onChange={() => onChange({ accessPolicy: opt.value })} className="w-4 h-4 accent-black" />
                <div>
                  <div className="text-sm font-semibold text-gray-900">{opt.label}</div>
                  <div className="text-sm text-gray-500 mt-0.5">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
          {state.accessPolicy === "specific" && (
            <input type="text" value={state.allowedAddresses}
              onChange={e => onChange({ allowedAddresses: e.target.value })}
              placeholder="0xabc..., 0xdef... (comma-separated)"
              className="mt-4 w-full px-5 py-4 rounded-xl bg-white border-2 border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-black transition-colors"
            />
          )}
        </div>

        {/* Pricing — only shown for non-private iQubes */}
        {state.accessPolicy !== "only-me" && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Pricing model</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              {BUSINESS_MODELS.map(opt => (
                <button key={opt.value} onClick={() => onChange({ businessModel: opt.value })}
                  className={`text-left px-5 py-4 rounded-xl text-sm border-2 transition-colors ${
                    state.businessModel === opt.value
                      ? "bg-gray-50 border-black text-gray-900"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"
                  }`}>
                  <div className="font-semibold">{opt.label}</div>
                  <div className="text-gray-400 text-xs mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
            {selectedBM.hasPrice && (
              <input type="number" min={0} value={state.price}
                onChange={e => onChange({ price: e.target.value })}
                placeholder={selectedBM.placeholder}
                className="mt-4 w-full px-5 py-4 rounded-xl bg-white border-2 border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-black transition-colors"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Private Data
// ─────────────────────────────────────────────────────────────────────────────

function FieldRow({ field, index, onChange, onRemove }: {
  field: BlakQubeField; index: number;
  onChange: (i: number, f: BlakQubeField) => void; onRemove: (i: number) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <input
        type="text"
        value={field.label}
        onChange={e => onChange(index, { ...field, label: e.target.value, key: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
        placeholder="Field name"
        className="w-44 px-4 py-3 rounded-xl bg-white border-2 border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-black transition-colors"
      />
      <div className="flex-1 relative">
        <input
          type={field.isSecret && !show ? "password" : "text"}
          value={field.value}
          onChange={e => onChange(index, { ...field, value: e.target.value })}
          placeholder="Value"
          className="w-full px-4 py-3 pr-11 rounded-xl bg-white border-2 border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-black transition-colors"
        />
        {field.isSecret && (
          <button type="button" onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      <button type="button"
        onClick={() => onChange(index, { ...field, isSecret: !field.isSecret })}
        title={field.isSecret ? "Marked secret" : "Mark as secret"}
        className={`p-3 rounded-xl border-2 transition-colors ${
          field.isSecret ? "bg-amber-50 border-amber-400 text-amber-600" : "bg-white border-gray-200 text-gray-400 hover:border-gray-400"
        }`}>
        <Lock size={16} />
      </button>
      <button type="button" onClick={() => onRemove(index)}
        className="p-3 rounded-xl border-2 border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-colors">
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function Step3PrivateData({ state, onChange }: { state: WizardState; onChange: (s: Partial<WizardState>) => void }) {
  const updateField = (i: number, f: BlakQubeField) => {
    const fields = [...state.fields]; fields[i] = f; onChange({ fields });
  };
  const removeField = (i: number) => onChange({ fields: state.fields.filter((_, idx) => idx !== i) });
  const addField = () => onChange({
    fields: [...state.fields, { key: `field_${state.fields.length}`, label: "", value: "", isSecret: false }],
  });

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Private Data</h2>
      <p className="text-gray-500 text-base mb-4">This data will be encrypted. Only you (and those you authorize) can decrypt it.</p>

      <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm mb-10">
        <Lock size={15} />
        All fields are encrypted with your key before being stored on IPFS.
      </div>

      {state.fields.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm rounded-2xl border-2 border-dashed border-gray-200">
          No private fields yet.
          <br />
          <span className="text-gray-300 text-xs">Skip this if your asset has no sensitive data.</span>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-xs text-gray-400 px-1 mb-2">
            <span className="w-44">Field name</span>
            <span className="flex-1">Value</span>
            <span className="w-11 text-center">Secret</span>
            <span className="w-11" />
          </div>
          {state.fields.map((f, i) => (
            <FieldRow key={i} field={f} index={i} onChange={updateField} onRemove={removeField} />
          ))}
        </div>
      )}

      <button onClick={addField}
        className="mt-6 flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-gray-600 border-2 border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-colors">
        <Plus size={16} /> Add field
      </button>
    </div>
  );
}

// Step 4 (Access Control) has been merged into Step 2 above.

// ─────────────────────────────────────────────────────────────────────────────
// Step 5 — Review
// ─────────────────────────────────────────────────────────────────────────────

const RISK_META: Record<RiskLevel, { label: string; textColor: string; bg: string; border: string; icon: React.ReactNode }> = {
  low:      { label: "Low Risk",      textColor: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-300", icon: <CheckCircle size={18} /> },
  medium:   { label: "Medium Risk",   textColor: "text-yellow-700",  bg: "bg-yellow-50",  border: "border-yellow-300",  icon: <AlertTriangle size={18} /> },
  high:     { label: "High Risk",     textColor: "text-orange-700",  bg: "bg-orange-50",  border: "border-orange-300",  icon: <AlertTriangle size={18} /> },
  critical: { label: "Critical Risk", textColor: "text-red-700",     bg: "bg-red-50",     border: "border-red-300",     icon: <XCircle size={18} /> },
};

function Step5Review({ state, onMintPinata, onMintAutoDrive, isSubmitting, mintError, txHash, keyStored }: {
  state: WizardState;
  onMintPinata: () => void;
  onMintAutoDrive: () => void;
  isSubmitting: boolean;
  mintError: string;
  txHash: string;
  keyStored: boolean | null;
}) {
  const sensitivity = state.iQubeType ? getDefaultSensitivity(state.iQubeType, state.category ?? "Other" as IQubeCategory) : 5;
  const riskScore = calculateRiskScore(sensitivity, 5, 5);
  const riskLevel = getRiskLevel(riskScore);
  const rm = RISK_META[riskLevel];
  const typeMeta = TYPE_OPTIONS.find(o => o.type === state.iQubeType);

  const rows = [
    { label: "Type",          value: `${state.iQubeType} · ${state.category}` },
    { label: "Name",          value: state.title || "—" },
    { label: "Access",        value: state.accessPolicy === "only-me" ? "Just me" : state.accessPolicy === "specific" ? "Specific people" : "Public" },
    { label: "Private fields",value: `${state.fields.length} field${state.fields.length !== 1 ? "s" : ""}` },
    ...(state.accessPolicy !== "only-me" ? [{ label: "Pricing", value: `${state.businessModel}${state.price ? ` · $${state.price}` : ""}` }] : []),
  ];

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Review your iQube</h2>
      <p className="text-gray-500 text-base mb-10">Confirm the details before minting on-chain.</p>

      <div className={`flex items-center gap-3 px-6 py-5 rounded-2xl border-2 mb-8 ${rm.bg} ${rm.border}`}>
        <span className={`flex items-center gap-2 font-bold text-base ${rm.textColor}`}>
          {rm.icon} {rm.label}
        </span>
        <span className="text-gray-400 text-sm">({riskScore}/10, auto-calculated)</span>
      </div>

      <div className="rounded-2xl border-2 border-gray-200 divide-y divide-gray-100 mb-8">
        {rows.map(row => (
          <div key={row.label} className="flex justify-between items-center px-6 py-4">
            <span className="text-sm text-gray-500">{row.label}</span>
            <span className={`text-sm font-semibold text-gray-900 capitalize flex items-center gap-2`}>
              {row.label === "Type" && <span style={{ color: typeMeta?.iconColor }}>{typeMeta?.icon}</span>}
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {mintError && (
        <div className="mb-6 px-5 py-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{mintError}</div>
      )}
      {txHash && (
        <div className="mb-6 space-y-3">
          <div className="px-5 py-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
            Minted!{" "}
            <a
              href={`https://amoy.polygonscan.com/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold"
            >
              View transaction ↗
            </a>
          </div>
          {keyStored === true && (
            <div className="px-5 py-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
              Protected decryption key stored in Supabase. Your data is recoverable without MetaMask decrypt RPCs.
            </div>
          )}
          {keyStored === false && state.fields.length > 0 && (
            <div className="px-5 py-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              Key storage failed. Your encrypted data may not be recoverable.
            </div>
          )}
          {keyStored === null && state.fields.length === 0 && (
            <div className="px-5 py-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-sm">
              No private fields added — nothing to encrypt or store. Add private fields in Step 3 to encrypt data and store keys in Supabase.
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onMintPinata}
          disabled={isSubmitting || !!txHash}
          className="flex-1 py-5 rounded-2xl text-base font-bold bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Minting to Pinata…" : txHash ? "Minted ✓" : "Mint to Pinata"}
        </button>
        <button
          onClick={onMintAutoDrive}
          disabled={isSubmitting || !!txHash}
          className="flex-1 py-5 rounded-2xl text-base font-bold bg-white text-black border-2 border-black hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Minting to Auto-Drive…" : txHash ? "Minted ✓" : "Mint to Auto-Drive"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export default function CreateIQubeWizard() {
  const { address } = useWallet();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>(0);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mintError, setMintError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [keyStored, setKeyStored] = useState<boolean | null>(null);

  const isFork = searchParams.get("fork") === "true";
  const sourceTokenId = searchParams.get("sourceTokenId");

  const { mintQube, transactionResult, transactionError } = useMintQube();

  // Pre-fill wizard from fork query params
  useEffect(() => {
    if (!isFork) return;
    const iQubeType = searchParams.get("iQubeType") as IQubeType | null;
    const category = searchParams.get("category") as IQubeCategory | null;
    const title = searchParams.get("title") || "";
    const description = searchParams.get("description") || "";

    if (iQubeType) {
      const fields = category ? getDefaultFields(iQubeType, category) : [];
      setState(s => ({
        ...s,
        iQubeType,
        category,
        title,
        description,
        fields,
      }));
      // Jump to step 1 (details) since type is pre-filled
      setStep(1);
    }
  }, [isFork, searchParams]);

  useEffect(() => {
    if (transactionResult?.transactionHash) setTxHash(transactionResult.transactionHash);
  }, [transactionResult]);

  useEffect(() => {
    if (transactionError) setMintError(transactionError.message);
  }, [transactionError]);

  const update = (partial: Partial<WizardState>) => setState(s => ({ ...s, ...partial }));

  const canAdvance = useMemo(() => {
    if (step === 0) return !!state.iQubeType && !!state.category;
    if (step === 1) return !!state.title.trim();
    return true;
  }, [step, state.iQubeType, state.category, state.title]);

  const next = () => setStep(s => Math.min(3, s + 1) as Step);
  const back = () => setStep(s => Math.max(0, s - 1) as Step);

  const uploadMetadata = async (
    provider: StorageProvider,
    metadataJson: Record<string, unknown>
  ): Promise<{ metaQubeLocation: string; storageHash: string }> => {
    if (provider === "pinata") {
      const upload = await pinata.upload.json(metadataJson);
      const metaQubeLocation = `${import.meta.env.VITE_GATEWAY_URL}/ipfs/${upload.IpfsHash}`;
      return { metaQubeLocation, storageHash: upload.IpfsHash };
    }

    const response = await fetch(`${API_BASE_URL}/api/autodrive-upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metadata: metadataJson }),
    });

    if (!response.ok) {
      let message = `Auto-Drive upload failed with status ${response.status}`;
      try {
        const body = await response.json();
        if (body?.error) message = String(body.error);
      } catch {
        // ignore JSON parse errors
      }
      throw new Error(message);
    }

    const body = await response.json() as { url: string; cid: string };
    if (!body.url || !body.cid) {
      throw new Error("Auto-Drive response missing url or cid");
    }
    return { metaQubeLocation: body.url, storageHash: body.cid };
  };

  const handleSubmit = async (provider: StorageProvider) => {
    if (!address) { setMintError("Please connect your wallet first."); return; }
    setIsSubmitting(true);
    setMintError("");
    setKeyStored(null);
    try {
      const blakQubePayload: Record<string, string> = {};
      for (const f of state.fields) blakQubePayload[f.key] = f.value;

      let encryptedBlakQube: string;
      let dekHex: string | null = null;

      if (state.fields.length > 0) {
        // Client-side encryption with AES-256-GCM
        const encrypted = await EncryptionModule.Encrypt(blakQubePayload);
        encryptedBlakQube = JSON.stringify({
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          encryptedData: encrypted.encryptedData,
        });
        dekHex = encrypted.key;
      } else {
        encryptedBlakQube = "";
      }

      const sensitivity = state.iQubeType ? getDefaultSensitivity(state.iQubeType, state.category ?? "Other" as IQubeCategory) : 5;
      const riskScore = calculateRiskScore(sensitivity, 5, 5);

      // Parse allowed addresses for \"specific\" access policy
      let parsedAllowedAddresses: string[] = [];
      if (state.accessPolicy === "specific" && state.allowedAddresses.trim()) {
        parsedAllowedAddresses = state.allowedAddresses
          .split(",")
          .map((addr) => addr.trim())
          .filter((addr) => addr.length > 0);
      }

      const metadataJson = {
        name: state.title || `iQube #${Date.now()}`,
        description: state.description,
        image: "",
        attributes: [
          { trait_type: "iQubeType",    value: state.iQubeType },
          { trait_type: "category",     value: state.category },
          { trait_type: "visibility",   value: accessPolicyToVisibility(state.accessPolicy) },
          { trait_type: "riskScore",    value: riskScore },
          { trait_type: "accessPolicy", value: state.accessPolicy },
          { trait_type: "businessModel",value: state.businessModel },
          { trait_type: "isEncrypted",  value: state.fields.length > 0 },
          { trait_type: "blakQube",     value: encryptedBlakQube },
          ...(parsedAllowedAddresses.length > 0
            ? [{ trait_type: "allowedAddresses", value: parsedAllowedAddresses }] as const
            : []),
          ...(isFork && sourceTokenId
            ? [{ trait_type: "forkedFrom", value: Number(sourceTokenId) }] as const
            : []),
        ],
      };

      const { metaQubeLocation, storageHash } = await uploadMetadata(
        provider,
        metadataJson
      );

      if (state.fields.length > 0 && dekHex && !isSupabaseConfigured()) {
        setMintError("Supabase is not configured. Encrypted iQubes require the key service to store the AES key.");
        return;
      }

      const hash = await mintQube(address as `0x${string}`, metaQubeLocation);
      if (!hash) return;

      // Store metadata + protected key in Supabase
      try {
        const tokenId = await getTokenIdFromMintReceipt(hash);

        // Always store iQube metadata so My iQubes / Registry can find it
        if (supabase) {
          const { error: metaErr } = await supabase.from("iqubes").insert({
            token_id: Number(tokenId),
            owner_address: address,
            minter_address: address,
            tx_hash: hash,
            ipfs_url: metaQubeLocation,
            ipfs_hash: storageHash,
            title: state.title || `iQube #${Date.now()}`,
            description: state.description,
            iqube_type: state.iQubeType,
            category: state.category,
            visibility: accessPolicyToVisibility(state.accessPolicy),
            access_policy: state.accessPolicy,
            business_model: state.businessModel,
            price: state.price || null,
            risk_score: riskScore,
            is_encrypted: state.fields.length > 0,
            allowed_addresses:
              parsedAllowedAddresses.length > 0 ? parsedAllowedAddresses : null,
          });
          if (metaErr) {
            console.error("Failed to store iQube metadata:", metaErr.message);
          }
        }

        // Persist per-address access list for \"Specific addresses\" policy
        if (supabase && parsedAllowedAddresses.length > 0) {
          try {
            const rows = parsedAllowedAddresses.map((addr) => ({
              token_id: Number(tokenId),
              address: addr.toLowerCase(),
              granted_by: address.toLowerCase(),
            }));
            const { error: accessErr } = await supabase
              .from("iqube_access_list")
              .insert(rows);
            if (accessErr) {
              console.error("Failed to store iQube access list:", accessErr.message);
            }
          } catch (listErr: unknown) {
            console.error("Unexpected error while storing access list:", listErr);
          }
        }

        // Store encrypted DEK via Edge Function (only for encrypted iQubes)
        if (state.fields.length > 0 && dekHex && supabase) {
          try {
            await authorizeDekStorage({
              tokenId: Number(tokenId),
              address,
              dekHex,
              ipfsHash: storageHash,
            });
            setKeyStored(true);
          } catch (supaErr: unknown) {
            const msg = supaErr instanceof Error ? supaErr.message : String(supaErr);
            setMintError(`Mint succeeded but key storage failed: ${msg}. Your encrypted data may not be recoverable until the key is stored.`);
            setKeyStored(false);
          }
        } else if (state.fields.length === 0) {
          setKeyStored(null);
        }
      } catch (receiptErr: unknown) {
        setMintError(
          `Mint succeeded but could not get token ID: ${receiptErr instanceof Error ? receiptErr.message : String(receiptErr)}. Key not stored.`
        );
        setKeyStored(false);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setMintError(err.message);
      } else if (typeof err === "object" && err !== null) {
        // Some libraries throw plain objects (e.g. { message: "...", code: ... })
        const obj = err as Record<string, unknown>;
        setMintError(obj.message ? String(obj.message) : JSON.stringify(err));
      } else {
        setMintError(String(err));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="pt-28 pb-16 px-8">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl border border-slate-200 bg-white px-8 py-8 shadow-sm">
          {isFork && sourceTokenId && (
            <div className="mb-8 px-5 py-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm flex items-center gap-2">
              <GitFork size={16} /> Forking from iQube #{sourceTokenId}. Customize the details below and mint your own version.
            </div>
          )}
          {!address && (
            <div className="mb-8 px-5 py-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              Connect your wallet before minting. You can fill in the form first.
            </div>
          )}
          <StepBar current={step} />
          <div className="min-h-96">
            {step === 0 && <Step1AssetType state={state} onChange={update} />}
            {step === 1 && <Step2DetailsAndAccess state={state} onChange={update} />}
            {step === 2 && <Step3PrivateData state={state} onChange={update} />}
            {step === 3 && (
              <Step5Review
                state={state}
                onMintPinata={() => handleSubmit("pinata")}
                onMintAutoDrive={() => handleSubmit("autodrive")}
                isSubmitting={isSubmitting}
                mintError={mintError}
                txHash={txHash}
                keyStored={keyStored}
              />
            )}
          </div>
          {step < 3 && (
            <NavButtons step={step} onBack={back} onNext={next}
              nextLabel={step === 2 ? "Review" : "Continue"} nextDisabled={!canAdvance} />
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
