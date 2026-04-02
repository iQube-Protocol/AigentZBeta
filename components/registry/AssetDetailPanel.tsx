"use client";

import { useState, useEffect } from "react";
import { X, ExternalLink, ShieldCheck, ClipboardList, Receipt, Star, Plus } from "lucide-react";
import { TrustPanel } from "./TrustPanel";
import { ValidationPanel } from "./ValidationPanel";
import type {
  RegistryAsset,
  TrustScore,
  ValidationQube,
  ReceiptQube,
  RegistryReview,
  TrustBand,
} from "@/types/registryIngestion";
import {
  TRUST_BAND_LABELS as TBL,
  POLICY_CLASS_LABELS as PCL,
  TRUST_BAND_ORDER,
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
  // Review creation
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewBand, setReviewBand] = useState<TrustBand>("L2_VERIFIED_COMMUNITY");
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    loadAll();
  }, [assetId]);

  async function loadAll() {
    setLoading(true);
    try {
      const [assetRes, trustRes, valRes, receiptsRes, reviewsRes] = await Promise.allSettled([
        fetch(`/api/registry/assets/${assetId}`).then((r) => r.json()),
        fetch(`/api/registry/assets/${assetId}/trust`).then((r) => r.json()),
        fetch(`/api/registry/assets/${assetId}/validate`).then((r) => r.json()),
        fetch(`/api/registry/assets/${assetId}/receipts`).then((r) => r.json()),
        fetch(`/api/registry/assets/${assetId}/reviews`).then((r) => r.json()),
      ]);

      if (assetRes.status === "fulfilled" && assetRes.value.ok) setAsset(assetRes.value.data);
      if (trustRes.status === "fulfilled" && trustRes.value.ok) setScore(trustRes.value.data);
      if (valRes.status === "fulfilled" && valRes.value.ok) setValidation(valRes.value.data);
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
        setValidation(null); // clear while reloading
        // Reload asset + validation
        const [assetRes, valRes] = await Promise.allSettled([
          fetch(`/api/registry/assets/${assetId}`).then((r) => r.json()),
          fetch(`/api/registry/assets/${assetId}/validate`).then((r) => r.json()),
        ]);
        if (assetRes.status === "fulfilled" && assetRes.value.ok) setAsset(assetRes.value.data);
        if (valRes.status === "fulfilled" && valRes.value.ok) setValidation(valRes.value.data);
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
        await loadAll();
      }
    } finally {
      setPublishing(false);
    }
  }

  async function handleCreateReview() {
    setSubmittingReview(true);
    try {
      const res = await fetch(`/api/registry/assets/${assetId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          reviewerId: "user",
          reviewerType: "human",
          requestedTrustBand: reviewBand,
          notes: reviewNotes || undefined,
          validationId: validation?.validationId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowReviewForm(false);
        setReviewNotes("");
        const reviewsRes = await fetch(`/api/registry/assets/${assetId}/reviews`).then((r) => r.json());
        if (reviewsRes.ok) setReviews(reviewsRes.data ?? []);
      }
    } finally {
      setSubmittingReview(false);
    }
  }

  async function handleReviewDecide(reviewId: string, decision: "approved" | "rejected") {
    await fetch(`/api/registry/assets/${assetId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "decide",
        reviewId,
        decision,
        tenantId: "default",
        notes: undefined,
      }),
    });
    const reviewsRes = await fetch(`/api/registry/assets/${assetId}/reviews`).then((r) => r.json());
    if (reviewsRes.ok) setReviews(reviewsRes.data ?? []);
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
          <div className="min-w-0">
            {loading ? (
              <div className="h-5 w-48 rounded bg-white/5 animate-pulse" />
            ) : (
              <>
                <div className="text-[10px] uppercase tracking-widest text-cyan-300/80">
                  {asset?.assetClass}
                </div>
                <div className="mt-0.5 text-base font-semibold text-white truncate">{asset?.name}</div>
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
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-6 pt-3 pb-0 border-b border-white/10 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors ${
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

          {/* ── Overview ──────────────────────────────────────────────── */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {loading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-4 w-3/4 rounded bg-white/5" />
                  <div className="h-4 w-1/2 rounded bg-white/5" />
                </div>
              ) : (
                <>
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
                  {asset && asset.capabilities.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Capabilities</div>
                      <div className="space-y-1">
                        {asset.capabilities.map((cap, i) => (
                          <div key={i} className="text-xs text-slate-300 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                            <span className="font-medium">{cap.name}</span>
                            {cap.description && <span className="text-slate-500 ml-2">{cap.description}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                    <div className="pt-2 border-t border-white/10">
                      {publishError && (
                        <div className="mb-2 text-xs text-red-400">{publishError}</div>
                      )}
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handlePublish}
                          disabled={publishing || !score}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-50 transition-colors"
                        >
                          {publishing ? "Publishing…" : "Publish Asset"}
                        </button>
                        {!score && (
                          <span className="text-xs text-slate-500">Run validation first</span>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Validation ─────────────────────────────────────────────── */}
          {activeTab === "validation" && (
            <ValidationPanel
              validation={validation}
              loading={loading}
              onRunValidation={handleRunValidation}
              running={validating}
            />
          )}

          {/* ── Trust ──────────────────────────────────────────────────── */}
          {activeTab === "trust" && (
            <TrustPanel score={score} loading={loading} />
          )}

          {/* ── Receipts ───────────────────────────────────────────────── */}
          {activeTab === "receipts" && (
            <div className="space-y-2">
              {loading ? (
                <div className="space-y-1.5 animate-pulse">
                  {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-xl bg-white/5" />)}
                </div>
              ) : receipts.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-center text-slate-400">
                  No receipts yet
                </div>
              ) : (
                receipts.map((r) => (
                  <div key={r.receiptId} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-cyan-300">{r.eventType}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {new Date(r.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-600 font-mono truncate">{r.receiptId}</div>
                    {r.contentHash && (
                      <div className="text-[10px] text-slate-600 font-mono truncate">sha256: {r.contentHash.slice(0, 16)}…</div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Reviews ────────────────────────────────────────────────── */}
          {activeTab === "reviews" && (
            <div className="space-y-4">
              {/* Create review button */}
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  {reviews.length} review{reviews.length !== 1 ? "s" : ""}
                </div>
                <button
                  type="button"
                  onClick={() => setShowReviewForm((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30 hover:bg-indigo-500/30 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Request Review
                </button>
              </div>

              {/* Review creation form */}
              {showReviewForm && (
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4 space-y-3">
                  <div className="text-xs font-medium text-indigo-300">Request Trust Band Review</div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 block">
                      Requesting Promotion To
                    </label>
                    <select
                      value={reviewBand}
                      onChange={(e) => setReviewBand(e.target.value as TrustBand)}
                      className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    >
                      {TRUST_BAND_ORDER.map((b) => (
                        <option key={b} value={b}>{TBL[b]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 block">
                      Notes (optional)
                    </label>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      rows={3}
                      placeholder="Describe the evidence or rationale for promotion…"
                      className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCreateReview}
                      disabled={submittingReview}
                      className="px-4 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/30 text-indigo-300 ring-1 ring-indigo-500/40 hover:bg-indigo-500/40 disabled:opacity-50 transition-colors"
                    >
                      {submittingReview ? "Submitting…" : "Submit Review Request"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReviewForm(false)}
                      className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Review list */}
              {reviews.length === 0 && !showReviewForm ? (
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-center text-slate-400">
                  No reviews yet
                </div>
              ) : (
                <div className="space-y-2">
                  {reviews.map((r) => (
                    <div key={r.reviewId} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs text-slate-300 truncate">{r.reviewerId}</div>
                        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ring-1 ${
                          r.decision === "approved"
                            ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30"
                            : r.decision === "rejected"
                            ? "bg-red-500/20 text-red-300 ring-red-500/30"
                            : "bg-amber-500/10 text-amber-300 ring-amber-500/20"
                        }`}>
                          {r.decision ?? "pending"}
                        </span>
                      </div>
                      {r.requestedTrustBand && (
                        <div className="text-[10px] text-indigo-300">
                          Requesting: {TBL[r.requestedTrustBand]}
                        </div>
                      )}
                      {r.notes && <div className="text-xs text-slate-400">{r.notes}</div>}
                      {/* Approve / Reject actions for pending reviews */}
                      {!r.decision && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleReviewDecide(r.reviewId, "approved")}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReviewDecide(r.reviewId, "rejected")}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-red-500/10 text-red-300 ring-1 ring-red-500/20 hover:bg-red-500/20 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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
