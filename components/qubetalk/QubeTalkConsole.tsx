"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshCcw,
  Plus,
  Send,
  Loader2,
  MessagesSquare,
  AlertTriangle,
} from "lucide-react";
import qubetalkFixtures from "@/docs/qubetalk/QUBETALK_FIXTURES.json";
import { getActivePersona } from "@/services/wallet/personaService";

type AgentRef = {
  id: string;
  role?: string;
  name?: string;
};

type Channel = {
  channel_id: string;
  tenant_id: string;
  participants: string[];
  created_at?: string;
  updated_at?: string;
};

type Message = {
  message_id: string;
  channel_id: string;
  in_reply_to?: string;
  from_agent: AgentRef;
  type: string;
  content: string;
  created_at: string;
  iqube_refs?: string[];
  receipt_ref?: any;
  metadata?: Record<string, any>;
};

type Delegation = {
  delegation_id: string;
  tenant_id: string;
  channel_id: string;
  request_id: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  from_agent: AgentRef;
  to_agent: AgentRef;
  task: {
    type: string;
    prompt: string;
    iqube_refs?: string[];
    parameters?: Record<string, any>;
    expected_output?: string;
  };
  receipt_ref?: any;
  result?: any;
};

type ReceiptItem = {
  id: string;
  category: string;
  subType: string;
  state: string;
  verified?: boolean;
  created_at: string;
  updated_at?: string;
  channel_id?: string;
  delegation_id?: string;
  from_agent?: string;
  to_agent?: string;
  source: "api" | "delegation" | "message" | "fixture";
  raw: any;
};

type ConsoleMode = "studio" | "admin";

const DEFAULT_TENANT = (qubetalkFixtures?.tenant_id as string) || "t_demo_001";

const CHANNEL_MARKER_LABELS: Record<string, string> = {
  "topic:group_agents_main": "Group Agents Main",
  "topic:bridge_inbound": "Bridge Inbound",
  "topic:bridge_outbound": "Bridge Outbound",
  "topic:openclaw_requests": "OpenClaw Requests",
  "topic:openclaw_responses": "OpenClaw Responses",
  "topic:dvn_receipts": "DVN Receipts",
  "topic:artifacts_minted": "Artifacts Minted",
  "topic:router_coordination": "Router Coordination",
  "logical:main": "Group Agents Main",
  "logical:bridgeInbound": "Bridge Inbound",
  "logical:bridgeOutbound": "Bridge Outbound",
  "logical:openclawRequests": "OpenClaw Requests",
  "logical:openclawResponses": "OpenClaw Responses",
  "logical:dvnReceipts": "DVN Receipts",
  "logical:artifactsMinted": "Artifacts Minted",
  "logical:router": "Router Coordination",
};

function getChannelLabel(channel: Channel): string {
  const participants = channel.participants || [];
  for (const participant of participants) {
    const label = CHANNEL_MARKER_LABELS[participant];
    if (label) return label;
  }
  return channel.channel_id;
}

function getChannelMarker(channel: Channel): string | null {
  const participants = channel.participants || [];
  const topicMarker = participants.find((participant) => participant.startsWith("topic:"));
  if (topicMarker) return topicMarker;
  const logicalMarker = participants.find((participant) => participant.startsWith("logical:"));
  return logicalMarker || null;
}

const fallbackChannel = (tenantId: string): Channel => ({
  channel_id: (qubetalkFixtures?.channel_id as string) || "ch_demo_001",
  tenant_id: tenantId,
  participants: [
    qubetalkFixtures?.agents?.system?.id,
    qubetalkFixtures?.agents?.tenant?.id,
  ].filter(Boolean) as string[],
  created_at: new Date().toISOString(),
});

const fallbackDelegation = (tenantId: string): Delegation => {
  const fixture = qubetalkFixtures?.delegation_request;
  return {
    delegation_id: "del_demo_001",
    tenant_id: tenantId,
    channel_id: fixture?.channel_id || "ch_demo_001",
    request_id: fixture?.request_id || "req_demo_001",
    status: "pending",
    from_agent: fixture?.from_agent || { id: "agent_system", role: "system" },
    to_agent: fixture?.to_agent || { id: "agent_tenant_001", role: "tenant" },
    task: fixture?.task || { type: "summarize", prompt: "Summarize item it_demo_001." },
    created_at: new Date().toISOString(),
  };
};

const fallbackMessages = (channelId: string): Message[] => {
  const response = qubetalkFixtures?.message_response;
  if (response?.channel_id) {
    return [
      {
        message_id: response.message_id || "msg_demo_001",
        channel_id: response.channel_id,
        in_reply_to: response.in_reply_to,
        from_agent: response.from_agent || { id: "agent_tenant_001", role: "tenant" },
        type: response.type || "response",
        content: response.content || "Sample message response.",
        created_at: response.created_at || new Date().toISOString(),
        iqube_refs: response.iqube_refs || [],
        receipt_ref: response.receipt_ref,
      },
    ];
  }
  return [
    {
      message_id: "msg_demo_001",
      channel_id: channelId,
      from_agent: { id: "agent_system", role: "system" },
      type: "request",
      content: "Delegation request created.",
      created_at: new Date().toISOString(),
    },
  ];
};

const normalizeReceipt = (raw: any, overrides: Partial<ReceiptItem>): ReceiptItem => {
  const rawType = raw?.type || {};
  const rawStatus = raw?.status || {};
  const receiptId =
    raw?.receiptId ||
    raw?.receipt_id ||
    raw?.id ||
    `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  return {
    id: receiptId,
    category: rawType.category || raw?.category || "qubetalk",
    subType: rawType.subType || rawType.sub_type || raw?.subType || raw?.sub_type || "delegation",
    state: rawStatus.state || raw?.state || "pending",
    verified: rawStatus.verified ?? raw?.verified,
    created_at: raw?.createdAt || raw?.created_at || new Date().toISOString(),
    updated_at: raw?.updatedAt || raw?.updated_at,
    channel_id: overrides.channel_id,
    delegation_id: overrides.delegation_id,
    from_agent: overrides.from_agent,
    to_agent: overrides.to_agent,
    source: overrides.source || "api",
    raw,
  };
};

export default function QubeTalkConsole({ mode }: { mode: ConsoleMode }) {
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT);
  const [tenantSource, setTenantSource] = useState<"auto" | "manual">("auto");
  const [activePersonaLabel, setActivePersonaLabel] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [apiReceipts, setApiReceipts] = useState<ReceiptItem[]>([]);
  const [channelParticipants, setChannelParticipants] = useState<string[]>([]);
  const [channelInput, setChannelInput] = useState("aigent-z,aigent-kn0w1");
  const [fromAgentId, setFromAgentId] = useState("aigent-z");
  const [messageType, setMessageType] = useState("request");
  const [messageContent, setMessageContent] = useState("");
  const [delegationPrompt, setDelegationPrompt] = useState("Summarize the selected item.");
  const [delegationTask, setDelegationTask] = useState("summarize");
  const [delegationToAgent, setDelegationToAgent] = useState("aigent-kn0w1");
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingDelegations, setLoadingDelegations] = useState(false);
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [receiptStatusFilter, setReceiptStatusFilter] = useState("all");
  const [receiptAgentFilter, setReceiptAgentFilter] = useState("all");
  const [receiptChannelFilter, setReceiptChannelFilter] = useState("all");
  const [streamStatus, setStreamStatus] = useState<"idle" | "connecting" | "open" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [statusInfo, setStatusInfo] = useState<{ state: string; message: string } | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.channel_id === selectedChannelId) || null,
    [channels, selectedChannelId]
  );
  const selectedChannelLabel = useMemo(
    () => (selectedChannel ? getChannelLabel(selectedChannel) : null),
    [selectedChannel]
  );

  useEffect(() => {
    let active = true;
    const loadPersona = async () => {
      try {
        const persona = await getActivePersona();
        if (!active || !persona) return;
        const label = persona.displayName || persona.fioHandle || persona.id;
        setActivePersonaLabel(label);
        if (tenantSource === "auto" && persona.tenantId) {
          setTenantId(persona.tenantId);
        }
      } catch {
        // Ignore persona lookup errors.
      }
    };
    loadPersona();
    return () => {
      active = false;
    };
  }, [tenantSource]);

  const loadChannels = useCallback(async () => {
    if (!tenantId) return;
    setLoadingChannels(true);
    setError(null);
    try {
      const res = await fetch(`/api/qubetalk/channels?tenant_id=${tenantId}`);
      if (!res.ok) throw new Error("Failed to load channels");
      const data = await res.json();
      const items: Channel[] = data.channels || [];
      const finalChannels = items.length ? items : [fallbackChannel(tenantId)];
      setChannels(finalChannels);
      if (!selectedChannelId && finalChannels[0]) {
        setSelectedChannelId(finalChannels[0].channel_id);
      }
    } catch (err: any) {
      setChannels([fallbackChannel(tenantId)]);
      setSelectedChannelId(fallbackChannel(tenantId).channel_id);
      setError(err.message || "Unable to load channels.");
    } finally {
      setLoadingChannels(false);
    }
  }, [tenantId, selectedChannelId]);

  const loadDelegations = useCallback(async () => {
    if (!tenantId) return;
    setLoadingDelegations(true);
    try {
      const res = await fetch(
        `/api/qubetalk/delegations?tenant_id=${tenantId}${
          selectedChannelId ? `&channel_id=${selectedChannelId}` : ""
        }`
      );
      if (!res.ok) throw new Error("Failed to load delegations");
      const data = await res.json();
      const items: Delegation[] = data.delegations || [];
      setDelegations(items.length ? items : [fallbackDelegation(tenantId)]);
    } catch {
      setDelegations([fallbackDelegation(tenantId)]);
    } finally {
      setLoadingDelegations(false);
    }
  }, [tenantId, selectedChannelId]);

  const loadMessages = useCallback(async () => {
    if (!tenantId || !selectedChannelId) return;
    setLoadingMessages(true);
    try {
      const res = await fetch(
        `/api/qubetalk/channels/${selectedChannelId}/messages?tenant_id=${tenantId}`
      );
      if (!res.ok) throw new Error("Failed to load messages");
      const data = await res.json();
      const items: Message[] = data.messages || [];
      setMessages(items.length ? items : fallbackMessages(selectedChannelId));
    } catch {
      setMessages(fallbackMessages(selectedChannelId));
    } finally {
      setLoadingMessages(false);
    }
  }, [tenantId, selectedChannelId]);

  const loadReceipts = useCallback(async () => {
    if (!tenantId) return;
    setLoadingReceipts(true);
    try {
      const res = await fetch(`/api/receipts?tenantId=${tenantId}&category=qubetalk`);
      if (!res.ok) throw new Error("Failed to load receipts");
      const data = await res.json();
      const items = Array.isArray(data.receipts) ? data.receipts : [];
      setApiReceipts(items.map((receipt: any) => normalizeReceipt(receipt, { source: "api" })));
    } catch {
      setApiReceipts([]);
    } finally {
      setLoadingReceipts(false);
    }
  }, [tenantId]);

  const refreshAll = useCallback(async () => {
    await loadChannels();
    await loadDelegations();
    await loadMessages();
    await loadReceipts();
  }, [loadChannels, loadDelegations, loadMessages, loadReceipts]);

  const startStream = useCallback(() => {
    if (!tenantId || !selectedChannelId) return;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setStreamStatus("connecting");
    const source = new EventSource(
      `/api/qubetalk/channels/${selectedChannelId}/stream?tenant_id=${tenantId}`
    );
    source.addEventListener("connect", () => setStreamStatus("open"));
    source.addEventListener("history", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        if (Array.isArray(payload.messages)) {
          const sorted = payload.messages.slice().sort((a: Message, b: Message) => {
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });
          setMessages(sorted);
        }
      } catch {
        // Ignore malformed history packets.
      }
    });
    source.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        const msg: Message | undefined = payload.message;
        if (!msg?.message_id) return;
        setMessages((prev) => {
          if (prev.some((item) => item.message_id === msg.message_id)) return prev;
          const next = [...prev, msg];
          next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          return next;
        });
      } catch {
        // Ignore malformed message packets.
      }
    });
    source.onerror = () => {
      setStreamStatus("error");
      source.close();
    };
    eventSourceRef.current = source;
  }, [tenantId, selectedChannelId]);

  useEffect(() => {
    refreshAll();
  }, [tenantId, refreshAll]);

  useEffect(() => {
    if (selectedChannel) {
      setChannelParticipants(selectedChannel.participants || []);
      setFromAgentId(selectedChannel.participants?.[0] || "aigent-z");
      setDelegationToAgent(selectedChannel.participants?.[1] || "aigent-kn0w1");
      loadMessages();
      loadDelegations();
      loadReceipts();
      startStream();
    }
    return () => {
      eventSourceRef.current?.close();
    };
  }, [selectedChannelId, selectedChannel, loadMessages, loadDelegations, loadReceipts, startStream]);

  useEffect(() => {
    if (mode !== "admin") return;
    let active = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/system/status");
        if (!res.ok) return;
        const data = await res.json();
        const qubetalk = data?.components?.qubetalk;
        if (active && qubetalk) {
          setStatusInfo({
            state: qubetalk.status || "unknown",
            message: qubetalk.message || "QubeTalk status unavailable",
          });
        }
      } catch {
        // Ignore status failures in admin view.
      }
    };
    fetchStatus();
    return () => {
      active = false;
    };
  }, [mode]);

  const derivedReceipts = useMemo(() => {
    const receipts: ReceiptItem[] = [];
    delegations.forEach((delegation) => {
      if (!delegation.receipt_ref) return;
      receipts.push(
        normalizeReceipt(delegation.receipt_ref, {
          source: "delegation",
          channel_id: delegation.channel_id,
          delegation_id: delegation.delegation_id,
          from_agent: delegation.from_agent?.id,
          to_agent: delegation.to_agent?.id,
        })
      );
    });

    messages.forEach((message) => {
      if (!message.receipt_ref) return;
      receipts.push(
        normalizeReceipt(message.receipt_ref, {
          source: "message",
          channel_id: message.channel_id,
          from_agent: message.from_agent?.id,
        })
      );
    });

    if (receipts.length === 0) {
      const fixtureReceipts = [
        qubetalkFixtures?.delegation_response?.receipt_ref,
        qubetalkFixtures?.message_response?.receipt_ref,
      ].filter(Boolean);

      fixtureReceipts.forEach((fixture: any) => {
        receipts.push(
          normalizeReceipt(fixture, {
            source: "fixture",
            channel_id: fixture?.metadata?.channel_id || qubetalkFixtures?.channel_id,
            delegation_id: fixture?.delegation_id,
          })
        );
      });
    }

    return receipts;
  }, [delegations, messages]);

  const receiptItems = useMemo(() => {
    const items = new Map<string, ReceiptItem>();
    apiReceipts.forEach((receipt) => items.set(receipt.id, receipt));
    derivedReceipts.forEach((receipt) => {
      if (!items.has(receipt.id)) items.set(receipt.id, receipt);
    });
    return Array.from(items.values()).sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [apiReceipts, derivedReceipts]);

  const filteredReceipts = useMemo(() => {
    return receiptItems.filter((receipt) => {
      const statusMatch = receiptStatusFilter === "all" || receipt.state === receiptStatusFilter;
      const agentMatch =
        receiptAgentFilter === "all" ||
        receipt.from_agent === receiptAgentFilter ||
        receipt.to_agent === receiptAgentFilter;
      const channelMatch =
        receiptChannelFilter === "all" || receipt.channel_id === receiptChannelFilter;
      return statusMatch && agentMatch && channelMatch;
    });
  }, [receiptItems, receiptStatusFilter, receiptAgentFilter, receiptChannelFilter]);

  const agentOptions = useMemo(() => {
    const set = new Set<string>();
    channelParticipants.forEach((agent) => set.add(agent));
    delegations.forEach((delegation) => {
      if (delegation.from_agent?.id) set.add(delegation.from_agent.id);
      if (delegation.to_agent?.id) set.add(delegation.to_agent.id);
    });
    messages.forEach((message) => {
      if (message.from_agent?.id) set.add(message.from_agent.id);
    });
    if (set.size === 0) {
      if (qubetalkFixtures?.agents?.system?.id) set.add(qubetalkFixtures.agents.system.id);
      if (qubetalkFixtures?.agents?.tenant?.id) set.add(qubetalkFixtures.agents.tenant.id);
    }
    return ["all", ...Array.from(set).sort()];
  }, [channelParticipants, delegations, messages]);

  const channelOptions = useMemo(() => {
    const list = channels.map((channel) => channel.channel_id);
    return ["all", ...list];
  }, [channels]);

  const handleCreateChannel = async () => {
    if (!tenantId) return;
    const participants = channelInput
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (!participants.length) return;
    try {
      const res = await fetch("/api/qubetalk/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, participants }),
      });
      if (!res.ok) throw new Error("Failed to create channel");
      await loadChannels();
      setChannelInput(participants.join(","));
    } catch (err: any) {
      setError(err.message || "Unable to create channel.");
    }
  };

  const handleSendMessage = async () => {
    if (!tenantId || !selectedChannelId || !messageContent.trim()) return;
    try {
      const res = await fetch("/api/qubetalk/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          channel_id: selectedChannelId,
          from_agent: { id: fromAgentId, role: "agent" },
          type: messageType,
          content: messageContent.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      setMessageContent("");
      loadMessages();
    } catch (err: any) {
      setError(err.message || "Unable to send message.");
    }
  };

  const handleCreateDelegation = async () => {
    if (!tenantId || !selectedChannelId) return;
    try {
      const res = await fetch("/api/qubetalk/delegations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          channel_id: selectedChannelId,
          request_id: `req_${Date.now()}`,
          from_agent: { id: fromAgentId, role: "agent" },
          to_agent: { id: delegationToAgent, role: "agent" },
          task: {
            type: delegationTask,
            prompt: delegationPrompt.trim() || "Summarize the request.",
            iqube_refs: [],
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to create delegation");
      setDelegationPrompt("");
      loadDelegations();
    } catch (err: any) {
      setError(err.message || "Unable to create delegation.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              {mode === "admin" ? "QubeTalk Admin" : "QubeTalk Studio"}
            </h1>
            <p className="text-sm text-slate-400">
              {mode === "admin"
                ? "Monitor agent handoffs, channels, and receipts."
                : "Compose delegations, send messages, and validate agent flows."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="h-9 rounded-lg bg-slate-900/70 px-3 text-sm text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
              value={tenantId}
              onChange={(event) => {
                setTenantId(event.target.value);
                setTenantSource("manual");
              }}
              placeholder="tenant_id"
            />
            <button
              onClick={refreshAll}
              className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80 ring-1 ring-white/10 hover:bg-white/10"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </header>
        {activePersonaLabel && (
          <div className="text-xs text-slate-500">
            Active persona: <span className="text-slate-300">{activePersonaLabel}</span>
          </div>
        )}

        {mode === "admin" && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-300">QubeTalk System Status</div>
              <div className="text-xs text-slate-500">{statusInfo?.state || "unknown"}</div>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {statusInfo?.message || "No status information returned."}
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[260px_1fr_320px]">
          <aside className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-200">Channels</div>
              {loadingChannels && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
            </div>
            <div className="space-y-2">
              {channels.map((channel) => (
                <button
                  key={channel.channel_id}
                  onClick={() => setSelectedChannelId(channel.channel_id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
                    channel.channel_id === selectedChannelId
                      ? "border-sky-400/50 bg-sky-500/10 text-sky-100"
                      : "border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-white"
                  }`}
                >
                  <div className="truncate font-medium">{getChannelLabel(channel)}</div>
                  <div className="text-[11px] text-slate-500">
                    {getChannelMarker(channel) || `${channel.participants?.length || 0} participants`}
                  </div>
                </button>
              ))}
            </div>

            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div className="text-xs font-semibold text-slate-300">Create channel</div>
              <input
                className="h-8 w-full rounded-lg bg-slate-900/70 px-2 text-xs text-white ring-1 ring-white/10"
                placeholder="participants (comma separated)"
                value={channelInput}
                onChange={(event) => setChannelInput(event.target.value)}
              />
              <button
                onClick={handleCreateChannel}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500/20 px-3 py-2 text-xs text-sky-100 ring-1 ring-sky-500/40 hover:bg-sky-500/30"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Channel
              </button>
            </div>
          </aside>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-200">Channel Messages</div>
                <div className="text-xs text-slate-500">
                  {selectedChannelId
                    ? `${selectedChannelLabel || "Channel"} (${selectedChannelId})`
                    : "Select a channel"}
                </div>
              </div>
              <div className="text-[11px] text-slate-500">
                Stream: {streamStatus === "open" ? "live" : streamStatus}
              </div>
            </div>

            <div className="mt-3 flex-1 space-y-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              {loadingMessages && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading messages…
                </div>
              )}
              {!loadingMessages && messages.length === 0 && (
                <div className="text-xs text-slate-500">No messages yet.</div>
              )}
              {messages.map((message) => (
                <div key={message.message_id} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{message.from_agent?.id || "unknown"}</span>
                    <span>{message.type}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-100">{message.content}</div>
                  {message.iqube_refs?.length ? (
                    <div className="mt-2 text-[11px] text-slate-500">
                      iQube refs: {message.iqube_refs.join(", ")}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-3 grid gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div className="text-xs font-semibold text-slate-300">Send message</div>
              <div className="flex gap-2">
                <select
                  className="h-8 flex-1 rounded-lg bg-slate-900/70 px-2 text-xs text-white ring-1 ring-white/10"
                  value={fromAgentId}
                  onChange={(event) => setFromAgentId(event.target.value)}
                >
                  {channelParticipants.map((participant) => (
                    <option key={participant} value={participant}>
                      {participant}
                    </option>
                  ))}
                </select>
                <select
                  className="h-8 rounded-lg bg-slate-900/70 px-2 text-xs text-white ring-1 ring-white/10"
                  value={messageType}
                  onChange={(event) => setMessageType(event.target.value)}
                >
                  <option value="request">request</option>
                  <option value="response">response</option>
                  <option value="event">event</option>
                  <option value="error">error</option>
                </select>
              </div>
              <textarea
                className="min-h-[64px] rounded-lg bg-slate-900/70 p-2 text-xs text-white ring-1 ring-white/10"
                placeholder="Message content"
                value={messageContent}
                onChange={(event) => setMessageContent(event.target.value)}
              />
              <button
                onClick={handleSendMessage}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500/20 px-3 py-2 text-xs text-emerald-100 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30"
              >
                <Send className="h-3.5 w-3.5" />
                Send
              </button>
            </div>
          </section>

          <aside className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-200">Delegations</div>
              {loadingDelegations && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
            </div>
            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-300">Receipts</div>
                {loadingReceipts && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />}
              </div>
              <div className="grid gap-2 text-[11px] text-slate-400">
                <select
                  className="h-8 rounded-lg bg-slate-900/70 px-2 text-xs text-white ring-1 ring-white/10"
                  value={receiptStatusFilter}
                  onChange={(event) => setReceiptStatusFilter(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="pending">pending</option>
                  <option value="completed">completed</option>
                  <option value="failed">failed</option>
                  <option value="expired">expired</option>
                </select>
                <select
                  className="h-8 rounded-lg bg-slate-900/70 px-2 text-xs text-white ring-1 ring-white/10"
                  value={receiptAgentFilter}
                  onChange={(event) => setReceiptAgentFilter(event.target.value)}
                >
                  {agentOptions.map((agent) => (
                    <option key={agent} value={agent}>
                      {agent === "all" ? "All agents" : agent}
                    </option>
                  ))}
                </select>
                <select
                  className="h-8 rounded-lg bg-slate-900/70 px-2 text-xs text-white ring-1 ring-white/10"
                  value={receiptChannelFilter}
                  onChange={(event) => setReceiptChannelFilter(event.target.value)}
                >
                  {channelOptions.map((channel) => (
                    <option key={channel} value={channel}>
                      {channel === "all" ? "All channels" : channel}
                    </option>
                  ))}
                </select>
              </div>

              <div className="max-h-64 space-y-2 overflow-y-auto">
                {filteredReceipts.length === 0 && (
                  <div className="text-xs text-slate-500">No receipts available.</div>
                )}
                {filteredReceipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-200"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{receipt.category}:{receipt.subType}</span>
                      <span className="uppercase">{receipt.state}</span>
                    </div>
                    <div className="mt-1 text-sm text-slate-100">
                      {receipt.from_agent ? `From ${receipt.from_agent}` : "Receipt"}
                      {receipt.to_agent ? ` → ${receipt.to_agent}` : ""}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {receipt.channel_id ? `Channel ${receipt.channel_id}` : "Channel n/a"} • {receipt.source}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {delegations.map((delegation) => (
                <div key={delegation.delegation_id} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{delegation.from_agent?.id}</span>
                    <span className="uppercase">{delegation.status}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-100">{delegation.task?.prompt}</div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    to {delegation.to_agent?.id} • {delegation.task?.type}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <MessagesSquare className="h-3.5 w-3.5" />
                New delegation
              </div>
              <div className="flex gap-2">
                <select
                  className="h-8 flex-1 rounded-lg bg-slate-900/70 px-2 text-xs text-white ring-1 ring-white/10"
                  value={fromAgentId}
                  onChange={(event) => setFromAgentId(event.target.value)}
                >
                  {channelParticipants.map((participant) => (
                    <option key={participant} value={participant}>
                      {participant}
                    </option>
                  ))}
                </select>
                <select
                  className="h-8 flex-1 rounded-lg bg-slate-900/70 px-2 text-xs text-white ring-1 ring-white/10"
                  value={delegationToAgent}
                  onChange={(event) => setDelegationToAgent(event.target.value)}
                >
                  {channelParticipants.map((participant) => (
                    <option key={participant} value={participant}>
                      {participant}
                    </option>
                  ))}
                </select>
              </div>
              <select
                className="h-8 rounded-lg bg-slate-900/70 px-2 text-xs text-white ring-1 ring-white/10"
                value={delegationTask}
                onChange={(event) => setDelegationTask(event.target.value)}
              >
                <option value="summarize">summarize</option>
                <option value="compare">compare</option>
                <option value="classify">classify</option>
                <option value="route">route</option>
                <option value="generate">generate</option>
                <option value="analyze">analyze</option>
              </select>
              <textarea
                className="min-h-[70px] rounded-lg bg-slate-900/70 p-2 text-xs text-white ring-1 ring-white/10"
                value={delegationPrompt}
                onChange={(event) => setDelegationPrompt(event.target.value)}
                placeholder="Delegation prompt"
              />
              <button
                onClick={handleCreateDelegation}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500/20 px-3 py-2 text-xs text-indigo-100 ring-1 ring-indigo-500/40 hover:bg-indigo-500/30"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Delegation
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
