"use client";

import { useState, useEffect } from "react";
import { X, ExternalLink, ShieldCheck, ClipboardList, Receipt, Star } from "lucide-react";
import { TrustPanel } from "./TrustPanel";
import { ValidationPanel } from "./ValidationPanel";
import type {
  RegistryAsset,
  TrustScore,
  ValidationQube,
  ReceiptQube,
  RegistryReview,
  TRUST_BAND_LABELS,
  POLICY_CLASS_LABELS,
} from "@/types/registryIngestion";
import {
  TRUST_BAND_LABELS as TBL,
  POLICY_CLASS_LABELS as PCL,
} from "@/types/registryIngestion";

interface AssetDetailPanelProps {
  assetId: string;
  onClose: () => void;
}

type DetailTab = "overview" | "validation" | "trust" | "receipts" | "reviews";

export function AssetDetailPanel({ assetId, onClose }: AssetDetailPanelProps) {
  const [asset, setAsset] = useState<RegistryAsset | null>(null);
  const [score, setScore] = useState<TrustScore | null>(null);
  const [validation, setValidation] = useState<ValidationQube | null>(null);
  const [receipts, setReceipts] = useState<ReceiptQube[]>([]);
  const [reviews, setReviews] = useState<RegistryReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [validating, setValidating] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    loadAsset();
  }, [assetId]);

  async function loadAsset() {
    setLoading(true);
    try {
      const [assetRes, trustRes, validationsRes, receiptsRes, reviewsRes] = await Promise.allSettled([
        fetch(`/api/registry/assets/${assetId}`).then((r) => r.json()),
        fetch(`/api/registry/assets/${assetId}/trust`).then((r) => r.json()),
        fetch(`/api/registry/assets/${assetId}/validate`).then(() => null), // just load latest
        fetch(`/api/registry/assets/${assetId}/receipts`).then((r) => r.json()),
        fetch(`/api/registry/assets/${assetId}/reviews`).then((r) => r.json()),
      ]);

      if (assetRes.status === "fulfilled" && assetRes.value.ok) setAsset(assetRes.value.data);
      if (trustRes.status === "fulfilled" && trustRes.value.ok) setScore(trustRes.value.data);
      if (receiptsRes.status === "fulfilled" && receiptsRes.value.ok) setReceipts(receiptsRes.value.data ?? []);
      if (reviewsRes.status === "fulfilled" && reviewsRes.value.ok) setReviews(reviewsRes.value.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunValidation() {
    setValidating(true);
    try {
      const res = await fetch(`/api/registry/assets/${assetId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggeredBy: "user" }),
      });
      const data = await res.json();
      if (data.ok) {
        setScore(data.data.score ?? null);
        // Reload asset for updated trust band
        const assetRes = await fetch(`/api/registry/assets/${assetId}`).then((r) => r.json());
        if (assetRes.ok) setAsset(assetRes.data);
      }
    } finally {
      setValidating(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch(`/api/registry/assets/${assetId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publishedBy: "user", force: true }),
      });
      const data = await res.json();
      if (!data.ok) {
        setPublishError(data.error);
      } else {
        await loadAsset();
      }
    } finally {
      setPublishing(false);
    }
  }

  const tabs: Array<{ id: DetailTab; label: string; icon: React.ReactNode }> = [
    { id: "overview",   label: "Overview",   icon: <ExternalLink className="h-3.5 w-3.5" /> },
    { id: "validation", label: "Validation", icon: <ClipboardList className="h-3.5 w-3.5" /> },
    { id: "trust",      label: "Trust",      icon: <ShieldCheck className="h-3.5 w-3.5" /> },
    { id: "receipts",   label: "Receipts",   icon: <Receipt className="h-3.5 w-3.5" /> },
    { id: "reviews",    label: "Reviews",    icon: <Star className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative h-full w-full max-w-2xl bg-slate-950 border-l border-white/10 overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 px-6 py-4 bg-slate-950/95 backdrop-blur border-b border-white/10">
          <div>
            {loading ? (
              <div className="h-5 w-48 rounded bg-white/5 animate-pulse" />
            ) : (
              <>
                <div className="text-[10px] uppercase tracking-widest text-cyan-300/80">
                  {asset?.assetClass}
                </div>
                <div className="mt-0.5 text-base font-semibold text-white">{asset?.name}</div>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  {asset?.trustBand && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30">
                      {TBL[asset.trustBand]}
                    </span>
                  )}
                  {asset?.publicationStatus && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ring-1 ${
                      asset.publicationStatus === "published"
                        ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30"
                        : "bg-slate-500/20 text-slate-400 ring-slate-500/30"
                    }`}>
                      {asset.publicationStatus}
                    </span>
                  )}
                  {asset?.policyClass && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-300 ring-1 ring-orange-500/20">
                      {PCL[asset.policyClass]}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-6 pt-3 pb-0 border-b border-white/10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors ${
                activeTab === tab.id
                  ? "text-white border-b-2 border-indigo-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 px-6 py-5 space-y-4">
          {activeTab === "overview" && (
            <div className="space-y-4">
              {asset?.description && (
                <p className="text-sm text-slate-300">{asset.description}</p>
              )}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <Detail label="Asset Class" value={asset?.assetClass} />
                <Detail label="Version" value={asset?.currentVersion} />
                <Detail label="Wrapper" value={asset?.wrapperStrategy} />
                <Detail label="Policy" value={asset?.policyClass ? PCL[asset.policyClass] : undefined} />
                <Detail label="Created" value={asset?.createdAt ? new Date(asset.createdAt).toLocaleDateString() : undefined} />
                <Detail label="Updated" value={asset?.updatedAt ? new Date(asset.updatedAt).toLocaleDateString() : undefined} />
              </div>
              {asset && asset.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {asset.tags.map((tag) => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {asset?.publicationStatus !== "published" && (
                <div className="pt-2">
                  {publishError && (
                    <div className="mb-2 text-xs text-red-400">{publishError}</div>
                  )}
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={publishing || !score}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-50 transition-colors"
                  >
                    {publishing ? "Publishing…" : "Publish Asset"}
                  </button>
                  {!score && (
                    <span className="ml-3 text-xs text-slate-500">Run validation first</span>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "validation" && (
            <ValidationPanel
              validation={validation}
              loading={loading}
              onRunValidation={handleRunValidation}
              running={validating}
            />
          )}

          {activeTab === "trust" && (
            <TrustPanel score={score} loading={loading} />
          )}

          {activeTab === "receipts" && (
            <div className="space-y-2">
              {receipts.length === 0 ? (
                <div className="text-sm text-slate-400">No receipts yet</div>
              ) : (
                receipts.map((r) => (
                  <div key={r.receiptId} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-cyan-300">{r.eventType}</span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(r.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono truncate">{r.receiptId}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "reviews" && (
            <div className="space-y-2">
              {reviews.length === 0 ? (
                <div className="text-sm text-slate-400">No reviews yet</div>
              ) : (
                reviews.map((r) => (
                  <div key={r.reviewId} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300">{r.reviewerId}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ring-1 ${
                        r.decision === "approved"
                          ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30"
                          : r.decision === "rejected"
                          ? "bg-red-500/20 text-red-300 ring-red-500/30"
                          : "bg-slate-500/20 text-slate-400 ring-slate-500/30"
                      }`}>
                        {r.decision ?? "pending"}
                      </span>
                    </div>
                    {r.notes && <div className="text-xs text-slate-400">{r.notes}</div>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-0.5 text-slate-200">{value ?? "—"}</div>
    </div>
  );
}
