"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle,
  Loader2,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { FioDomain } from "@/types/persona";
import { createPersona } from "@/services/wallet/personaService";
import { getPersonaFioService, isValidUsername, SUPPORTED_DOMAINS } from "@/services/wallet/personaFioService";
import { validatePassword } from "@/services/wallet/keyService";

interface PersonaQuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId?: string;
  onCreated: (personaId: string) => void;
  onAdvanced?: () => void;
}

const AVAILABLE_AGENTS = [
  {
    id: "aigent-z",
    name: "Aigent Z",
    fioHandle: "aigentz@aigent",
    description: "Primary operations agent for cross-chain transactions",
  },
  {
    id: "aigent-moneypenny",
    name: "Aigent MoneyPenny",
    fioHandle: "moneypenny@aigent",
    description: "Treasury and financial operations agent",
  },
  {
    id: "aigent-kn0w1",
    name: "Aigent Kn0w1",
    fioHandle: "kn0w1@aigent",
    description: "Knowledge and research agent",
  },
  {
    id: "aigent-nakamoto",
    name: "Aigent Nakamoto",
    fioHandle: "nakamoto@aigent",
    description: "Crypto operations and DeFi agent",
  },
];

type AvatarPreset = {
  id: string;
  label: string;
  uri: string;
};

type DiscoverablePersona = {
  id: string;
  displayName: string;
  fioHandle: string | null;
  avatarUri: string | null;
};

function makeAvatarDataUri(label: string, from: string, to: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${from}" />
          <stop offset="100%" stop-color="${to}" />
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="48" fill="url(#g)"/>
      <text x="50%" y="54%" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#ffffff" font-weight="700">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const AGENT_AVATAR_PRESETS: AvatarPreset[] = [
  { id: "emerald", label: "AZ", uri: makeAvatarDataUri("AZ", "#10b981", "#22d3ee") },
  { id: "amber", label: "MP", uri: makeAvatarDataUri("MP", "#f59e0b", "#f97316") },
  { id: "violet", label: "K1", uri: makeAvatarDataUri("K1", "#8b5cf6", "#ec4899") },
  { id: "slate", label: "NK", uri: makeAvatarDataUri("NK", "#64748b", "#0f172a") },
];

function getAuthProfileIdFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  return (
    window.localStorage.getItem("authProfileId") ||
    window.localStorage.getItem("agentiq_auth_profile_id") ||
    window.sessionStorage.getItem("authProfileId") ||
    window.sessionStorage.getItem("agentiq_auth_profile_id")
  );
}

function buildAuthHeaders(): Headers {
  const headers = new Headers({ "Content-Type": "application/json" });
  const authProfileId =
    getAuthProfileIdFromStorage() || process.env.NEXT_PUBLIC_DEV_AUTH_PROFILE_ID || "";
  if (authProfileId) headers.set("x-auth-profile-id", authProfileId);
  return headers;
}

function randomEvmAddress(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function PersonaQuickAddModal({
  isOpen,
  onClose,
  tenantId = "default",
  onCreated,
  onAdvanced,
}: PersonaQuickAddModalProps) {
  const [mode, setMode] = useState<"human" | "agent">("human");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [agentSearch, setAgentSearch] = useState("");
  const [customAgentHandle, setCustomAgentHandle] = useState("");
  const [customAgentName, setCustomAgentName] = useState("");
  const [agentAvatarUri, setAgentAvatarUri] = useState<string | null>(null);
  const [discoverableAgents, setDiscoverableAgents] = useState<DiscoverablePersona[]>([]);
  const [discoverableLoading, setDiscoverableLoading] = useState(false);
  const [discoverableError, setDiscoverableError] = useState<string | null>(null);
  const [selectedDiscoverable, setSelectedDiscoverable] = useState<DiscoverablePersona | null>(null);
  const [domain, setDomain] = useState<FioDomain>("qripto");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [checkingHandle, setCheckingHandle] = useState(false);
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setMode("human");
    setSelectedAgent(null);
    setAgentSearch("");
    setCustomAgentHandle("");
    setCustomAgentName("");
    setAgentAvatarUri(null);
    setDiscoverableAgents([]);
    setDiscoverableLoading(false);
    setDiscoverableError(null);
    setSelectedDiscoverable(null);
    setDomain("qripto");
    setUsername("");
    setDisplayName("");
    setPassword("");
    setConfirmPassword("");
    setIsLoading(false);
    setCheckingHandle(false);
    setHandleAvailable(null);
    setError(null);
  }, []);

  const filteredAgents = AVAILABLE_AGENTS.filter((agent) => {
    const term = agentSearch.trim().toLowerCase();
    if (!term) return true;
    return agent.name.toLowerCase().includes(term) || agent.fioHandle.toLowerCase().includes(term);
  });

  useEffect(() => {
    if (!isOpen || mode !== "agent") return;
    let active = true;
    const query = agentSearch.trim();
    const handle = setTimeout(async () => {
      if (!active) return;
      setDiscoverableLoading(true);
      setDiscoverableError(null);
      try {
        const qParam = query.length >= 2 ? `&q=${encodeURIComponent(query)}` : "";
        const res = await fetch(
          `/api/wallet/persona/discoverable?tenantId=${encodeURIComponent(tenantId)}${qParam}`
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "Failed to load discoverable personas");
        }
        if (active) {
          setDiscoverableAgents(Array.isArray(json.personas) ? json.personas : []);
        }
      } catch (err) {
        if (active) setDiscoverableError((err as Error).message || "Failed to load discoverable personas");
      } finally {
        if (active) setDiscoverableLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [agentSearch, isOpen, mode, tenantId]);

  useEffect(() => {
    if (!isOpen) resetState();
  }, [isOpen, resetState]);

  const handleCheck = async () => {
    if (mode !== "human") return;
    if (!username || !isValidUsername(username)) {
      setHandleAvailable(null);
      return;
    }
    setCheckingHandle(true);
    setHandleAvailable(null);
    setError(null);
    try {
      const fioService = getPersonaFioService();
      const result = await fioService.checkHandleAvailability(username, domain);
      setHandleAvailable(result.available);
      if (!result.available && result.error) setError(result.error);
    } catch (err) {
      setHandleAvailable(false);
      setError((err as Error).message);
    } finally {
      setCheckingHandle(false);
    }
  };

  const passwordValidation = validatePassword(password);
  const canSubmit =
    mode === "agent"
      ? !!selectedAgent || !!customAgentHandle.trim() || !!selectedDiscoverable
      : !!username &&
        isValidUsername(username) &&
        !!displayName.trim() &&
        handleAvailable === true &&
        passwordValidation.valid &&
        password === confirmPassword;

  const handleAddAgent = async () => {
    if (selectedDiscoverable) {
      onCreated(selectedDiscoverable.id);
      onClose();
      return;
    }
    if (!selectedAgent && !customAgentHandle.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      let fioHandle = "";
      let agentName = "";
      if (customAgentHandle.trim()) {
        fioHandle = customAgentHandle.trim().toLowerCase();
        if (!fioHandle.includes("@")) {
          throw new Error("Agent handle must include a domain (e.g., name@aigent)");
        }
        if (!fioHandle.endsWith("@aigent")) {
          throw new Error("Agent handle must use the @aigent domain");
        }
        agentName = customAgentName.trim() || fioHandle.split("@")[0];
      } else {
        const agent = AVAILABLE_AGENTS.find((entry) => entry.id === selectedAgent);
        if (!agent) throw new Error("Agent not found");
        fioHandle = agent.fioHandle;
        agentName = agent.name;
      }

      const resolveUrl = `/api/wallet/persona/resolve-handle?tenantId=${encodeURIComponent(
        tenantId
      )}&fioHandle=${encodeURIComponent(fioHandle)}`;
      const resolveRes = await fetch(resolveUrl);
      const resolveJson = await resolveRes.json().catch(() => ({}));
      if (resolveRes.ok && resolveJson?.personaId) {
        onCreated(resolveJson.personaId);
        onClose();
        return;
      }

      // Fallback: if persona is already associated with this auth profile but not discoverable,
      // resolve via owner-safe by-handle endpoint before attempting creation.
      const byHandleRes = await fetch(
        `/api/wallet/persona/by-handle/${encodeURIComponent(fioHandle)}?tenantId=${encodeURIComponent(tenantId)}`,
        { headers: buildAuthHeaders() }
      );
      const byHandleJson = await byHandleRes.json().catch(() => ({}));
      if (byHandleRes.ok && byHandleJson?.id) {
        onCreated(byHandleJson.id);
        onClose();
        return;
      }

      const now = new Date().toISOString();
      const payload = {
        id: crypto.randomUUID(),
        type: "PersonaQube",
        fioHandle,
        fioDomain: "aigent",
        rootDid: `did:fio:${fioHandle}`,
        displayName: agentName,
        avatarUri: agentAvatarUri,
        evmKey: { address: randomEvmAddress() },
        chainAddresses: {},
        reputationScore: 0,
        reputationBucket: 0,
        badges: [],
        status: "active",
        tenantId,
        createdAt: now,
        updatedAt: now,
        defaultIdentityState: "semi_anonymous",
        worldIdStatus: "agent_declared",
        appOrigin: "agentiq",
      };

      const createRes = await fetch("/api/wallet/persona", {
        method: "POST",
        headers: buildAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        // If handle already exists, try one more owner-safe resolve pass and activate it.
        if (createRes.status === 409) {
          const retryRes = await fetch(
            `/api/wallet/persona/by-handle/${encodeURIComponent(fioHandle)}?tenantId=${encodeURIComponent(tenantId)}`,
            { headers: buildAuthHeaders() }
          );
          const retryJson = await retryRes.json().catch(() => ({}));
          if (retryRes.ok && retryJson?.id) {
            onCreated(retryJson.id);
            onClose();
            return;
          }
          throw new Error("FIO handle already registered to another profile");
        }
        throw new Error(json?.error || json?.details || "Failed to create agent persona");
      }

      const personaId = json?.id || json?.persona?.id;
      if (!personaId) throw new Error("Agent persona created but ID missing");
      onCreated(personaId);
      onClose();
    } catch (err) {
      setError((err as Error).message || "Failed to add agent persona");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!canSubmit) return;
    if (mode === "agent") {
      await handleAddAgent();
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const result = await createPersona({
        username,
        domain,
        displayName: displayName.trim(),
        keySource: "generated",
        password,
        tenantId,
      });

      if (!result.success || !result.persona) {
        throw new Error(result.error || "Failed to create persona");
      }

      onCreated(result.persona.id);
      onClose();
    } catch (err) {
      setError((err as Error).message || "Failed to create persona");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[88vh] mx-4 bg-slate-900/95 rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Quick Add Persona</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setMode("human");
                setSelectedAgent(null);
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                mode === "human"
                  ? "border-emerald-500 bg-emerald-500/10 text-white"
                  : "border-white/10 bg-white/5 text-white/60 hover:text-white"
              }`}
            >
              <User className="w-4 h-4" />
              Human Persona
            </button>
            <button
              onClick={() => {
                setMode("agent");
                setHandleAvailable(null);
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                mode === "agent"
                  ? "border-emerald-500 bg-emerald-500/10 text-white"
                  : "border-white/10 bg-white/5 text-white/60 hover:text-white"
              }`}
            >
              <Bot className="w-4 h-4" />
              Agent Persona
            </button>
          </div>

          {mode === "human" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {SUPPORTED_DOMAINS.map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setDomain(d);
                      setHandleAvailable(null);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      domain === d
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-white/10 bg-white/5 hover:border-white/20"
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">@{d}</div>
                    <div className="text-xs text-slate-400">Persona domain</div>
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">FIO Handle</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value.toLowerCase());
                      setHandleAvailable(null);
                    }}
                    onBlur={handleCheck}
                    placeholder="username"
                    className="flex-1 px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                  <span className="text-slate-400">@{domain}</span>
                </div>
                <div className="h-5">
                  {checkingHandle && (
                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Checking availability...
                    </div>
                  )}
                  {handleAvailable === true && (
                    <div className="flex items-center gap-2 text-emerald-400 text-xs">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Handle is available
                    </div>
                  )}
                  {handleAvailable === false && !checkingHandle && (
                    <div className="flex items-center gap-2 text-red-400 text-xs">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Handle not available
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Confirm</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm"
                    className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
              </div>
              {!passwordValidation.valid && password.length > 0 && (
                <div className="text-xs text-red-400">{passwordValidation.errors[0]}</div>
              )}
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <div className="text-xs text-red-400">Passwords do not match.</div>
              )}
            </>
          )}

          {mode === "agent" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs uppercase tracking-wider text-white/50 mb-2">Avatar</div>
                <div className="flex gap-2 flex-wrap">
                  {AGENT_AVATAR_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setAgentAvatarUri(preset.uri)}
                      className={`w-12 h-12 rounded-full border-2 overflow-hidden transition-all ${
                        agentAvatarUri === preset.uri
                          ? "border-emerald-400"
                          : "border-white/10 hover:border-white/30"
                      }`}
                      aria-label={`Select ${preset.label} avatar`}
                    >
                      <img src={preset.uri} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                  <button
                    onClick={() => setAgentAvatarUri(null)}
                    className={`px-2 text-[11px] rounded-lg border ${
                      agentAvatarUri === null
                        ? "border-emerald-400 text-emerald-300"
                        : "border-white/10 text-white/50 hover:text-white/80"
                    }`}
                  >
                    None
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-white/50 mb-2">Search agents</label>
                <input
                  type="text"
                  value={agentSearch}
                  onChange={(e) => setAgentSearch(e.target.value)}
                  placeholder="Search by name or handle"
                  className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white/90 placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
              {filteredAgents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => {
                    setSelectedAgent(agent.id);
                    setCustomAgentHandle("");
                    setCustomAgentName("");
                    setSelectedDiscoverable(null);
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selectedAgent === agent.id
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{agent.name}</div>
                      <div className="text-xs text-white/50">{agent.fioHandle}</div>
                      <div className="text-[11px] text-white/40 mt-1">{agent.description}</div>
                    </div>
                  </div>
                </button>
              ))}
              {filteredAgents.length === 0 && (
                <div className="text-xs text-white/50 px-2">
                  No matching agents. Add a custom @aigent handle below.
                </div>
              )}
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs uppercase tracking-wider text-white/50 mb-2">Tenant directory</div>
                {discoverableLoading && (
                  <div className="text-xs text-white/50 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading discoverable agents...
                  </div>
                )}
                {discoverableError && (
                  <div className="text-xs text-red-400">{discoverableError}</div>
                )}
                {!discoverableLoading && !discoverableError && discoverableAgents.length === 0 && (
                  <div className="text-xs text-white/40">No discoverable agents in this tenant.</div>
                )}
                <div className="space-y-2 mt-2">
                  {discoverableAgents.map((persona) => (
                    <button
                      key={persona.id}
                      onClick={() => {
                        setSelectedDiscoverable(persona);
                        setSelectedAgent(null);
                        setCustomAgentHandle("");
                        setCustomAgentName("");
                        setAgentAvatarUri(persona.avatarUri || null);
                      }}
                      className={`w-full text-left p-2 rounded-lg border transition-all ${
                        selectedDiscoverable?.id === persona.id
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-white/10 bg-white/5 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center overflow-hidden">
                          {persona.avatarUri ? (
                            <img src={persona.avatarUri} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Bot className="w-4 h-4 text-amber-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm text-white truncate">{persona.displayName}</div>
                          <div className="text-xs text-white/50 truncate">
                            {persona.fioHandle || "discoverable"}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs uppercase tracking-wider text-white/50 mb-2">Custom agent</div>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={customAgentHandle}
                    onChange={(e) => {
                      setCustomAgentHandle(e.target.value.toLowerCase());
                      setSelectedAgent(null);
                      setSelectedDiscoverable(null);
                    }}
                    placeholder="agent-handle@aigent"
                    className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white/90 placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                  <input
                    type="text"
                    value={customAgentName}
                    onChange={(e) => {
                      setCustomAgentName(e.target.value);
                      setSelectedAgent(null);
                      setSelectedDiscoverable(null);
                    }}
                    placeholder="Display name (optional)"
                    className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white/90 placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                  <div className="text-[11px] text-white/40">
                    Use an @aigent handle for custom agent personas.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-white/5 border-t border-white/10 flex items-center justify-between">
          {onAdvanced && mode === "human" ? (
            <button
              onClick={onAdvanced}
              className="text-xs text-white/60 hover:text-white transition-colors"
              type="button"
            >
              Use advanced setup
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={handleCreate}
            disabled={!canSubmit || isLoading}
            className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                {mode === "agent" ? "Add Agent Persona" : "Create Persona"}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PersonaQuickAddModal;
