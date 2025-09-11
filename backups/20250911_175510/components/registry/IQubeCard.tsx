"use client";
import React, { useEffect, useState } from "react";
import { Eye, Pencil, ShoppingCart, Trash2 } from "lucide-react";
import { Dots } from "./scoreUtils";

export interface IQubeTemplateCardProps {
  id: string;
  name: string;
  description: string;
  sensitivityScore?: number; // 0-10
  riskScore: number; // 0-10
  accuracyScore: number; // 0-10
  verifiabilityScore: number; // 0-10
  instanceCount?: number;
  onClick?: (id: string) => void;
  iQubeType?: 'DataQube' | 'ContentQube' | 'ToolQube' | 'ModelQube' | 'AigentQube';
  iQubeInstanceType?: 'template' | 'instance';
  businessModel?: 'Buy' | 'Sell' | 'Rent' | 'Lease' | 'Subscribe' | 'Stake' | 'License' | 'Donate';
  price?: number;
  provenance?: number;
  onEdit?: (id: string) => void;
  onAddToCart?: (id: string) => void;
  onDelete?: (id: string) => void;
}


export const IQubeCard: React.FC<IQubeTemplateCardProps> = ({
  id,
  name,
  description,
  sensitivityScore,
  riskScore,
  accuracyScore,
  verifiabilityScore,
  instanceCount,
  onClick,
  iQubeType,
  iQubeInstanceType,
  businessModel,
  price,
  provenance,
  onEdit,
  onAddToCart,
  onDelete,
}) => {
  const formatUSD = (v: number) => `$${v.toFixed(2)}`;
  // Fixed conversion: $0.01 = 10 sats => $1 = 1000 sats
  const toSats = (usd: number) => Math.round(usd * 1000);
  const formatSats = (s: number) => `${s.toLocaleString()} sats`;
  const [minted, setMinted] = useState(false);
  const [activePrivate, setActivePrivate] = useState(false);
  const [activeRegistry, setActiveRegistry] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      setMinted(localStorage.getItem(`minted_${id}`) === '1');
      setActivePrivate(localStorage.getItem(`active_private_${id}`) === '1');
      setActiveRegistry(localStorage.getItem(`active_registry_${id}`) === '1');
    } catch {}
  }, [id]);

  return (
    <div className="text-left w-full rounded-2xl p-5 bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition focus-within:ring-2 focus-within:ring-indigo-500">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-400">{iQubeInstanceType ? (iQubeInstanceType === 'template' ? 'Template' : 'Instance') : 'Template'}</div>
        {instanceCount !== undefined && (
          <div className="text-[12px] text-slate-400">{instanceCount} instances</div>
        )}
      </div>
      <div className="text-lg font-medium">{name}</div>
      {/* Badges + Price + Provenance + Status */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {iQubeType && (
            <span title="iQube Type" className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30">{iQubeType}</span>
          )}
          {iQubeInstanceType && (
            <span title="Instance Type" className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/30 capitalize">{iQubeInstanceType}</span>
          )}
          {businessModel && (
            <span title="Business Model" className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30">{businessModel}</span>
          )}
          <span title="Provenance depth (fork generations from origin)" className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/30">Prov {(typeof provenance === 'number' && provenance >= 0) ? provenance : 0}</span>
          {minted ? (
            <span title="Minted (published to registry)" className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30">Minted</span>
          ) : (
            <span title="Draft saved privately" className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/30">Private</span>
          )}
          {activeRegistry && (
            <span title="Active in registry" className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30">Active</span>
          )}
          {activePrivate && !activeRegistry && (
            <span title="Active in your instance" className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30">Active (Private)</span>
          )}
        </div>
        {typeof price === 'number' && !Number.isNaN(price) && (
          <div className="text-xs text-slate-200/90" title="Quoted using fixed rate: $1 = 1000 sats">
            <span className="font-medium">{formatSats(toSats(price))}</span>
            <span className="mx-1 text-slate-400">·</span>
            <span>{formatUSD(price)}</span>
          </div>
        )}
      </div>
      <p className="mt-2 text-slate-300 text-sm line-clamp-2">{description}</p>

      <div className="mt-4 text-slate-400 text-sm">
        <div className="grid grid-cols-4 gap-2">
          <div className="flex flex-col items-center">
            <div className="text-[11px]" title="Sensitivity: Low 1–4, Medium 5–7, High 8–10">Sensitivity</div>
            <Dots value={sensitivityScore ?? 0} kind='sensitivity' title="Sensitivity" />
          </div>
          <div className="flex flex-col items-center">
            <div className="text-[11px]" title="Accuracy: Poor 1–3, Moderate 4–6, High 7–10">Accuracy</div>
            <Dots value={accuracyScore} kind='accuracy' title="Accuracy" />
          </div>
          <div className="flex flex-col items-center">
            <div className="text-[11px]" title="Verifiability: Low 1–3, Moderate 4–6, High 7–10">Verifiability</div>
            <Dots value={verifiabilityScore} kind='verifiability' title="Verifiability" />
          </div>
          <div className="flex flex-col items-center">
            <div className="text-[11px]" title="Risk: Low 1–4, Medium 5–7, High 8–10">Risk</div>
            <Dots value={riskScore} kind='risk' title="Risk" />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          className="p-2 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white"
          title="View"
          onClick={() => onClick?.(id)}
        >
          <Eye size={16} />
        </button>
        <button
          className="p-2 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white"
          title="Edit"
          onClick={() => onEdit?.(id)}
        >
          <Pencil size={16} />
        </button>
        <button
          className="p-2 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white"
          title="Add to cart"
          onClick={() => onAddToCart?.(id)}
        >
          <ShoppingCart size={16} />
        </button>
        <button
          className="p-2 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white"
          title="Delete"
          onClick={() => onDelete?.(id)}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};
