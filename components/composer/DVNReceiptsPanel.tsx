"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Receipt,
  CheckCircle2, 
  AlertCircle, 
  Clock,
  RefreshCw,
  Download,
} from "lucide-react";

interface DVNReceipt {
  receipt_id: string;
  tenant_id: string;
  timestamp: string;
  receipt_type: string;
  payload: {
    experience_id?: string;
    thread_key?: string;
    request_id?: string;
    provider?: string;
    provider_thread_id?: string;
    provider_message_id?: string;
    payload_hash?: string;
    tool_id?: string;
    args_hash?: string;
    result_hash?: string;
    iqube_id?: string;
    artifact_type?: string;
    content_hash?: string;
    version?: number;
    capsule_id?: string;
    surface_plan_id?: string;
    publish_target?: string;
  };
}

interface DVNReceiptsPanelProps {
  experienceId?: string;
  requestId?: string;
  tenantId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
}

const RECEIPT_TYPE_COLORS: Record<string, string> = {
  "bridge.inbound_received": "bg-blue-500/10 text-blue-400 border-blue-500/30",
  "bridge.outbound_posted": "bg-green-500/10 text-green-400 border-green-500/30",
  "tool.invoked": "bg-purple-500/10 text-purple-400 border-purple-500/30",
  "artifact.minted": "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  "artifact.versioned": "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
  "capsule.published": "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30",
  // SmartTriad / DPR receipts
  "design_parity_pipeline_run": "bg-violet-500/10 text-violet-400 border-violet-500/30",
  "design_parity_pipeline_error": "bg-red-500/10 text-red-400 border-red-500/30",
  "design_parity_remedy_proposed": "bg-amber-500/10 text-amber-400 border-amber-500/30",
  "design_parity_remedy_applied": "bg-green-500/10 text-green-400 border-green-500/30",
  "design_parity_remedy_rejected": "bg-orange-500/10 text-orange-400 border-orange-500/30",
  "create_experience_qube": "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  "delete_experience_qube": "bg-red-500/10 text-red-400 border-red-500/30",
};

const RECEIPT_TYPE_ICONS: Record<string, React.ComponentType<any>> = {
  "bridge.inbound_received": Clock,
  "bridge.outbound_posted": CheckCircle2,
  "tool.invoked": AlertCircle,
  "artifact.minted": CheckCircle2,
  "artifact.versioned": CheckCircle2,
  "capsule.published": CheckCircle2,
};

function isReceiptShape(value: unknown): value is DVNReceipt {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DVNReceipt>;
  return (
    candidate.receipt_id !== undefined &&
    candidate.tenant_id !== undefined &&
    candidate.timestamp !== undefined &&
    candidate.receipt_type !== undefined &&
    candidate.payload !== undefined
  );
}

// Normalize a SmartTriadReceipt / BaseReceipt (camelCase) to the DVNReceipt wire format.
function normalizeToReceiptShape(value: unknown): DVNReceipt | null {
  if (!value || typeof value !== "object") return null;
  // Already in DVN wire format
  if (isReceiptShape(value)) return value as DVNReceipt;
  // SmartTriadReceipt / BaseReceipt (camelCase)
  const src = value as Record<string, any>;
  const receiptId = src.receiptId ?? src.receipt_id;
  if (!receiptId) return null;
  return {
    receipt_id: String(receiptId),
    tenant_id: String(src.tenantId ?? src.tenant_id ?? ""),
    timestamp: String(src.createdAt ?? src.timestamp ?? new Date().toISOString()),
    receipt_type: String(src.action ?? src.receipt_type ?? src.type?.subType ?? "unknown"),
    payload: {
      experience_id: src.result?.experienceId ?? src.metadata?.experienceId ?? undefined,
      request_id: src.result?.requestId ?? undefined,
      provider: src.component ?? undefined,
      tool_id: src.action ?? undefined,
      iqube_id: src.result?.iQubeId ?? undefined,
      artifact_type: src.result?.artifactType ?? undefined,
      content_hash: src.result?.contentHash ?? undefined,
    },
  };
}

function parseReceiptFromMessage(message: any): DVNReceipt | null {
  if (!message?.content || typeof message.content !== "string") {
    return null;
  }
  try {
    const parsed = JSON.parse(message.content);
    return normalizeToReceiptShape(parsed);
  } catch {
    return null;
  }
}

async function resolveDvnChannelId(tenantId: string): Promise<string | null> {
  const params = new URLSearchParams({ tenant_id: tenantId, limit: "250" });
  const response = await fetch(`/api/qubetalk/channels?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }
  const payload = await response.json();
  const channels = Array.isArray(payload?.channels) ? payload.channels : [];
  const match = channels.find((channel: any) =>
    Array.isArray(channel?.participants) &&
    channel.participants.includes("topic:dvn_receipts")
  );
  return typeof match?.channel_id === "string" ? match.channel_id : null;
}

function dedupeReceipts(receipts: DVNReceipt[]) {
  const next = new Map<string, DVNReceipt>();
  receipts.forEach((receipt) => {
    if (typeof receipt?.receipt_id === "string" && receipt.receipt_id.trim()) {
      next.set(receipt.receipt_id.trim(), receipt);
    }
  });
  return Array.from(next.values());
}

export default function DVNReceiptsPanel({
  experienceId,
  requestId,
  tenantId = "tnt_clawhack",
  autoRefresh = false,
  refreshInterval = 5000,
}: DVNReceiptsPanelProps) {
  const [receipts, setReceipts] = useState<DVNReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    loadReceipts();
    
    if (autoRefresh) {
      const interval = setInterval(loadReceipts, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [experienceId, requestId, tenantId, autoRefresh, refreshInterval]);

  const loadReceipts = async () => {
    setLoading(true);
    try {
      const localReceiptsPromise = experienceId
        ? fetch(`/api/composer/experiences/${experienceId}`, { cache: "no-store" })
            .then(async (response) => {
              if (!response.ok) return [];
              const payload = await response.json();
              const metadata = payload?.experience_qube?.metadata || {};
              const dprReceipts = Array.isArray(metadata?.dprReceipts)
                ? metadata.dprReceipts
                : [];
              const generatedReceipts = metadata?.generated_receipts && typeof metadata.generated_receipts === "object"
                ? Object.values(metadata.generated_receipts)
                : [];
              return [...dprReceipts, ...generatedReceipts]
                .map(normalizeToReceiptShape)
                .filter((item): item is DVNReceipt => item !== null);
            })
            .catch(() => [] as DVNReceipt[])
        : Promise.resolve([] as DVNReceipt[]);

      const resolvedChannelId =
        process.env.NEXT_PUBLIC_QT_CHANNEL_DVN_RECEIPTS_ID ||
        (await resolveDvnChannelId(tenantId));

      const localReceipts = await localReceiptsPromise;

      if (!resolvedChannelId) {
        const localFiltered = requestId
          ? localReceipts.filter((receipt) => receipt.payload.request_id === requestId)
          : experienceId
            ? localReceipts.filter((receipt) => receipt.payload?.experience_id === experienceId)
            : localReceipts;
        localFiltered.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setReceipts(dedupeReceipts(localFiltered));
        setLastRefresh(new Date());
        return;
      }

      const params = new URLSearchParams({
        tenant_id: tenantId,
        limit: "200",
        order: "desc",
      });
      const messageResponse = await fetch(
        `/api/qubetalk/channels/${encodeURIComponent(resolvedChannelId)}/messages?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!messageResponse.ok) {
        throw new Error(`Failed loading DVN messages (${messageResponse.status})`);
      }

      const payload = await messageResponse.json();
      const messages: unknown[] = Array.isArray(payload?.messages) ? payload.messages : [];
      const parsed: DVNReceipt[] = messages
        .map((message) => parseReceiptFromMessage(message))
        .filter((item): item is DVNReceipt => Boolean(item));

      // Merge with existing receipts so auto-refresh accumulates new ones rather than overwriting
      setReceipts((prev) => {
        const mergedReceipts = dedupeReceipts([...localReceipts, ...parsed, ...prev]);
        const filteredByRequest: DVNReceipt[] = requestId
          ? mergedReceipts.filter((receipt) => receipt.payload.request_id === requestId)
          : experienceId
            ? mergedReceipts.filter((receipt) => receipt.payload?.experience_id === experienceId)
            : mergedReceipts;
        filteredByRequest.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        return filteredByRequest;
      });
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Failed to load DVN receipts:", error);
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredReceipts = filterType
    ? receipts.filter((r) => r.receipt_type === filterType)
    : receipts;

  const receiptTypes = Array.from(new Set(receipts.map((r) => r.receipt_type)));

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}.${date
      .getMilliseconds()
      .toString()
      .padStart(3, "0")}`;
  };

  const exportReceipts = () => {
    const data = JSON.stringify(filteredReceipts, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dvn-receipts-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={filterType === null ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterType(null)}
          className="text-xs"
        >
          All
        </Button>
        {receiptTypes.map((type) => (
          <Button
            key={type}
            variant={filterType === type ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType(type)}
            className="text-xs"
          >
            {type.split(".")[1]}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="border-cyan-400/40 text-xs text-cyan-200">
            {filteredReceipts.length} receipts
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={loadReceipts}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportReceipts}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Receipts Timeline */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader className="pb-3">
          <CardDescription className="text-xs text-slate-400">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {filteredReceipts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Receipt className="h-12 w-12 mb-3 opacity-50" />
                  <p className="text-sm">No receipts found</p>
                </div>
              ) : (
                filteredReceipts.map((receipt, index) => {
                  const Icon = RECEIPT_TYPE_ICONS[receipt.receipt_type] || Receipt;
                  const colorClass = RECEIPT_TYPE_COLORS[receipt.receipt_type] || "bg-slate-500/10 text-slate-400 border-slate-500/30";
                  
                  return (
                    <div
                      key={receipt.receipt_id}
                      className="relative pl-6 pb-3 border-l-2 border-slate-700 last:border-l-0"
                    >
                      {/* Timeline dot */}
                      <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-slate-800 border-2 border-cyan-500 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-cyan-500" />
                      </div>

                      <div className="space-y-2">
                        {/* Receipt header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-cyan-400" />
                            <Badge className={`text-xs ${colorClass}`}>
                              {receipt.receipt_type}
                            </Badge>
                          </div>
                          <span className="text-xs text-slate-500 font-mono">
                            {formatTimestamp(receipt.timestamp)}
                          </span>
                        </div>

                        {/* Receipt details */}
                        <div className="text-xs space-y-1 text-slate-400">
                          {receipt.payload.request_id && (
                            <div className="flex gap-2">
                              <span className="text-slate-500">Request:</span>
                              <span className="font-mono text-slate-300">
                                {receipt.payload.request_id}
                              </span>
                            </div>
                          )}
                          {receipt.payload.tool_id && (
                            <div className="flex gap-2">
                              <span className="text-slate-500">Tool:</span>
                              <span className="font-mono text-purple-300">
                                {receipt.payload.tool_id}
                              </span>
                            </div>
                          )}
                          {receipt.payload.iqube_id && (
                            <div className="flex gap-2">
                              <span className="text-slate-500">Artifact:</span>
                              <span className="font-mono text-cyan-300">
                                {receipt.payload.iqube_id}
                              </span>
                            </div>
                          )}
                          {receipt.payload.provider && (
                            <div className="flex gap-2">
                              <span className="text-slate-500">Provider:</span>
                              <span className="font-mono text-blue-300">
                                {receipt.payload.provider}
                              </span>
                            </div>
                          )}
                          {receipt.payload.publish_target && (
                            <div className="flex gap-2">
                              <span className="text-slate-500">Target:</span>
                              <span className="font-mono text-fuchsia-300">
                                {receipt.payload.publish_target}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Receipt ID */}
                        <div className="text-xs text-slate-600 font-mono">
                          {receipt.receipt_id}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-400">
                {receipts.filter((r) => r.receipt_type.startsWith("bridge.")).length}
              </div>
              <div className="text-xs text-slate-500">Bridge Events</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">
                {receipts.filter((r) => r.receipt_type === "tool.invoked").length}
              </div>
              <div className="text-xs text-slate-500">Tools Invoked</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">
                {receipts.filter((r) => r.receipt_type.startsWith("artifact.")).length}
              </div>
              <div className="text-xs text-slate-500">Artifacts</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
