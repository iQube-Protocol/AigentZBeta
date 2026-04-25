import React, { useEffect, useMemo, useRef, useState } from "react";
import { Database, Loader2, MessageSquarePlus, Paperclip, Send, X } from "lucide-react";
import Navbar from "../../components/Navbar";
import { useWallet } from "../../context/WalletContext";
import { streamAgentChat, type AgentChatMessage } from "../../utilities/agentClient";
import {
  resolveSelectedIqubeContexts,
  MAX_CONTEXT_TOKENS_PER_REQUEST,
} from "../../utilities/chatContextResolver";
import { isSupabaseConfigured, supabase } from "../../utilities/supabase";

interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: AgentChatMessage[];
  selectedContextTokenIds: number[];
}

interface ContextIQube {
  token_id: number;
  title: string;
  iqube_type: string;
  is_encrypted?: boolean;
}

function makeConversation(): Conversation {
  const now = Date.now();
  const id =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${now}-${Math.random().toString(16).slice(2)}`;
  return {
    id,
    title: "New chat",
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        role: "assistant",
        content:
          "Agent is ready. Add iQubes as context (optional), then send your prompt.",
      },
    ],
    selectedContextTokenIds: [],
  };
}

export default function AgentChat() {
  const { address } = useWallet();
  const [conversations, setConversations] = useState<Conversation[]>(() => [makeConversation()]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [availableIqubes, setAvailableIqubes] = useState<ContextIQube[]>([]);
  const [isLoadingIqubes, setIsLoadingIqubes] = useState(false);
  const [iqubesError, setIqubesError] = useState("");
  const [showIqubePicker, setShowIqubePicker] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isResolvingContext, setIsResolvingContext] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const iqubePickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!activeConversationId && conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    }
  }, [activeConversationId, conversations]);

  useEffect(() => {
    if (!address || !isSupabaseConfigured() || !supabase) {
      setAvailableIqubes([]);
      setIqubesError("");
      return;
    }
    setIsLoadingIqubes(true);
    setIqubesError("");
    supabase
      .from("iqubes")
      .select("token_id,title,iqube_type,is_encrypted")
      .eq("owner_address", address)
      .order("created_at", { ascending: false })
      .then(({ data, error: queryError }) => {
        if (queryError) {
          setIqubesError(queryError.message);
          setAvailableIqubes([]);
        } else {
          setAvailableIqubes((data as ContextIQube[]) ?? []);
        }
      })
      .finally(() => setIsLoadingIqubes(false));
  }, [address]);

  const activeConversation = useMemo(() => {
    if (conversations.length === 0) return null;
    return conversations.find((item) => item.id === activeConversationId) ?? conversations[0];
  }, [activeConversationId, conversations]);

  const canSend = useMemo(
    () => Boolean(address && draft.trim() && !isStreaming && !isResolvingContext && activeConversation),
    [activeConversation, address, draft, isResolvingContext, isStreaming]
  );
  const selectedEncryptedCount = useMemo(() => {
    if (!activeConversation) return 0;
    return activeConversation.selectedContextTokenIds.filter((tokenId) => {
      const item = availableIqubes.find((qube) => qube.token_id === tokenId);
      return Boolean(item?.is_encrypted);
    }).length;
  }, [activeConversation, availableIqubes]);
  const selectedContextCount = activeConversation?.selectedContextTokenIds.length ?? 0;
  const hasAnyAttachment = selectedContextCount > 0 || attachedFiles.length > 0;
  const attachmentButtonClass = `h-9 w-9 rounded-lg border transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed ${
    hasAnyAttachment
      ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
      : "border-gray-300 text-gray-700 hover:bg-gray-50"
  }`;
  const attachmentChipClass =
    "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs bg-blue-600 border border-blue-600 text-white";

  const updateConversation = (conversationId: string, updater: (conversation: Conversation) => Conversation) => {
    setConversations((prev) =>
      prev.map((conversation) => {
        if (conversation.id !== conversationId) return conversation;
        const updated = updater(conversation);
        return { ...updated, updatedAt: Date.now() };
      })
    );
  };

  const createConversation = () => {
    const next = makeConversation();
    setConversations((prev) => [next, ...prev]);
    setActiveConversationId(next.id);
    setShowIqubePicker(false);
    setAttachedFiles([]);
    setError("");
    setDraft("");
  };

  const toggleContextToken = (tokenId: number) => {
    if (!activeConversation) return;
    updateConversation(activeConversation.id, (conversation) => {
      const hasToken = conversation.selectedContextTokenIds.includes(tokenId);
      if (
        !hasToken &&
        conversation.selectedContextTokenIds.length >= MAX_CONTEXT_TOKENS_PER_REQUEST
      ) {
        setError(
          `You can attach up to ${MAX_CONTEXT_TOKENS_PER_REQUEST} iQubes as context in one request.`
        );
        return conversation;
      }
      const selectedContextTokenIds = hasToken
        ? conversation.selectedContextTokenIds.filter((id) => id !== tokenId)
        : [...conversation.selectedContextTokenIds, tokenId].sort((a, b) => a - b);
      return { ...conversation, selectedContextTokenIds };
    });
  };

  const removeContextToken = (tokenId: number) => {
    if (!activeConversation) return;
    updateConversation(activeConversation.id, (conversation) => ({
      ...conversation,
      selectedContextTokenIds: conversation.selectedContextTokenIds.filter((id) => id !== tokenId),
    }));
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files ?? []);
    if (nextFiles.length === 0) return;
    setAttachedFiles((prev) => {
      const existingKeys = new Set(prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const uniqueIncoming = nextFiles.filter(
        (file) => !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`)
      );
      return [...prev, ...uniqueIncoming];
    });
    event.target.value = "";
  };

  const removeAttachedFile = (targetFile: File) => {
    setAttachedFiles((prev) =>
      prev.filter(
        (file) =>
          !(
            file.name === targetFile.name &&
            file.size === targetFile.size &&
            file.lastModified === targetFile.lastModified
          )
      )
    );
  };

  const handleAttachIqube = (tokenId: number) => {
    toggleContextToken(tokenId);
    setShowIqubePicker(false);
  };

  useEffect(() => {
    if (!showIqubePicker) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (iqubePickerRef.current && !iqubePickerRef.current.contains(target)) {
        setShowIqubePicker(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [showIqubePicker]);

  const sendMessage = async () => {
    if (!address) {
      setError("Connect your wallet to use the agent.");
      return;
    }
    if (!activeConversation) return;
    const content = draft.trim();
    if (!content) return;

    setError("");

    const conversationId = activeConversation.id;
    const contextTokenIds = activeConversation.selectedContextTokenIds;
    let contextSystemMessage: AgentChatMessage | undefined;
    let hasEncryptedContext = false;

    setIsResolvingContext(true);
    try {
      if (contextTokenIds.length > 0) {
        const contextBundle = await resolveSelectedIqubeContexts({
          tokenIds: contextTokenIds,
          walletAddress: address,
        });
        contextSystemMessage = contextBundle.systemMessage;
        hasEncryptedContext = contextBundle.hasEncryptedContext;
      }
    } catch (contextError) {
      setError(contextError instanceof Error ? contextError.message : String(contextError));
      setIsResolvingContext(false);
      return;
    }
    setIsResolvingContext(false);
    const attachedFileSummary =
      attachedFiles.length > 0
        ? attachedFiles
            .map((file) => `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`)
            .join(", ")
        : "";
    const userMessageContent = attachedFileSummary
      ? `${content}\n\nAttached files: ${attachedFileSummary}`
      : content;
    setDraft("");
    setAttachedFiles([]);

    const nextHistory: AgentChatMessage[] = [
      ...activeConversation.messages,
      { role: "user", content: userMessageContent },
    ];
    const requestMessages = contextSystemMessage
      ? [contextSystemMessage, ...nextHistory]
      : nextHistory;
    updateConversation(conversationId, (conversation) => {
      const title = conversation.title === "New chat" ? content.slice(0, 40) : conversation.title;
      return {
        ...conversation,
        title: title || "New chat",
        messages: [...nextHistory, { role: "assistant", content: "" }],
      };
    });
    setIsStreaming(true);

    try {
      await streamAgentChat(
        {
          walletAddress: address,
          messages: requestMessages,
          contextTokenIds,
        },
        {
          onToken: (token) => {
            updateConversation(conversationId, (conversation) => {
              const copy = [...conversation.messages];
              const last = copy[copy.length - 1];
              if (!last || last.role !== "assistant") return conversation;
              copy[copy.length - 1] = { ...last, content: `${last.content}${token}` };
              return { ...conversation, messages: copy };
            });
          },
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      updateConversation(conversationId, (conversation) => ({ ...conversation, messages: nextHistory }));
    } finally {
      setIsStreaming(false);
      if (hasEncryptedContext) {
        setShowIqubePicker(false);
      }
    }
  };

  return (
    <div className="h-screen bg-slate-50 overflow-hidden">
      <Navbar />
      <div className="h-full pt-24 pb-6 px-8">
        <div className="max-w-7xl mx-auto h-full flex flex-col min-h-0">
          <div className="mb-4 shrink-0">
            <h1 className="text-2xl font-bold text-slate-900 mb-1 tracking-tight">Agent Chat</h1>
            <p className="text-slate-500 text-sm">
              Local-first chat with multi-thread windows and optional iQube context.
            </p>
          </div>

          {!address && (
            <div className="mb-4 px-5 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm shrink-0">
              Connect your wallet to start chatting.
            </div>
          )}

          <div className="flex-1 min-h-0 rounded-2xl border border-slate-200 bg-white overflow-hidden flex shadow-sm">
            <aside className="w-[320px] border-r border-slate-200 bg-slate-50/80 flex flex-col">
              <div className="p-4 border-b border-slate-200">
                <button
                  onClick={createConversation}
                  disabled={isStreaming}
                  className="w-full h-11 rounded-xl text-sm font-semibold bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <MessageSquarePlus size={16} />
                  New chat
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {conversations.map((conversation) => {
                  const isActive = conversation.id === activeConversation?.id;
                  const lastMessage = conversation.messages[conversation.messages.length - 1];
                  return (
                    <button
                      key={conversation.id}
                      onClick={() => {
                        setActiveConversationId(conversation.id);
                        setShowIqubePicker(false);
                      }}
                      className={`w-full text-left rounded-xl border px-3 py-3 transition-colors ${
                        isActive
                          ? "bg-white border-gray-300"
                          : "bg-transparent border-transparent hover:bg-white/80"
                      }`}
                    >
                      <div className="text-sm font-semibold text-gray-800 truncate">{conversation.title}</div>
                      <div className="text-xs text-gray-500 mt-1 truncate">
                        {lastMessage?.content || "No messages yet"}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-2">
                        {conversation.selectedContextTokenIds.length} iQube context
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="flex-1 flex flex-col min-w-0">
              <div className="px-5 py-4 border-b border-slate-200 bg-white">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {activeConversation?.title || "Chat"}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    {activeConversation?.messages.length ?? 0} messages
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 bg-slate-50/60">
                <div className="space-y-3">
                  {activeConversation?.messages.map((message, idx) => (
                    <div
                      key={`${activeConversation.id}-${message.role}-${idx}`}
                      className={`rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${
                        message.role === "user"
                          ? "bg-black text-white ml-10"
                          : "bg-white text-gray-900 border border-gray-200 mr-10"
                      }`}
                    >
                      <div className="text-[11px] uppercase tracking-wide opacity-60 mb-1">
                        {message.role === "assistant" ? "Agent" : "You"}
                      </div>
                      {message.content ||
                        (isStreaming && idx === (activeConversation.messages.length ?? 0) - 1 ? "..." : "")}
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="mx-5 mt-3 px-5 py-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="px-5 py-4 border-t border-slate-200 bg-white">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileInputChange}
                />
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 relative" ref={iqubePickerRef}>
                    <button
                      type="button"
                      onClick={() => setShowIqubePicker((prev) => !prev)}
                      disabled={!address || isLoadingIqubes || !isSupabaseConfigured()}
                      title="Attach iQube context"
                      aria-label="Attach iQube context"
                      className={attachmentButtonClass}
                    >
                      <Database size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Upload files"
                      aria-label="Upload files"
                      className={attachmentButtonClass}
                    >
                      <Paperclip size={15} />
                    </button>
                    {showIqubePicker && (
                      <div className="absolute left-0 bottom-11 z-20 w-[320px] max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg p-2">
                        {!address && (
                          <p className="px-2 py-1 text-xs text-gray-500">Connect wallet for iQube context.</p>
                        )}
                        {address && !isSupabaseConfigured() && (
                          <p className="px-2 py-1 text-xs text-red-700">Supabase not configured.</p>
                        )}
                        {address && isSupabaseConfigured() && isLoadingIqubes && (
                          <p className="px-2 py-1 text-xs text-gray-500">Loading iQubes...</p>
                        )}
                        {address &&
                          isSupabaseConfigured() &&
                          !isLoadingIqubes &&
                          availableIqubes.filter(
                            (iqube) => !activeConversation?.selectedContextTokenIds.includes(iqube.token_id)
                          ).length === 0 && (
                            <p className="px-2 py-1 text-xs text-gray-500">No available iQubes to attach.</p>
                          )}
                        {availableIqubes
                          .filter((iqube) => !activeConversation?.selectedContextTokenIds.includes(iqube.token_id))
                          .map((iqube) => (
                            <button
                              key={iqube.token_id}
                              type="button"
                              onClick={() => handleAttachIqube(iqube.token_id)}
                              className="group w-full text-left px-2 py-2 rounded-lg bg-white hover:bg-blue-50 transition-colors"
                            >
                              <div className="text-xs font-medium text-gray-800 truncate group-hover:text-blue-700">
                                {iqube.title || `iQube #${iqube.token_id}`}
                              </div>
                              <div className="text-[11px] text-gray-500 group-hover:text-blue-600">
                                #{iqube.token_id} · {iqube.iqube_type}
                                {iqube.is_encrypted ? " · Encrypted" : ""}
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                  {attachedFiles.length > 0 && (
                    <p className="text-xs text-gray-500">
                      {attachedFiles.length} file{attachedFiles.length === 1 ? "" : "s"} selected
                    </p>
                  )}
                </div>
                {(activeConversation?.selectedContextTokenIds.length ?? 0) > 0 || attachedFiles.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {activeConversation?.selectedContextTokenIds.map((tokenId) => {
                      const matching = availableIqubes.find((item) => item.token_id === tokenId);
                      return (
                        <span
                          key={`iqube-${tokenId}`}
                          className={attachmentChipClass}
                        >
                          {matching?.title || "iQube"} #{tokenId}
                          <button
                            type="button"
                            onClick={() => removeContextToken(tokenId)}
                            className="hover:opacity-80"
                            aria-label={`Remove iQube ${tokenId}`}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      );
                    })}
                    {attachedFiles.map((file) => (
                      <span
                        key={`file-${file.name}-${file.size}-${file.lastModified}`}
                        className={attachmentChipClass}
                      >
                        {file.name}
                        <button
                          type="button"
                          onClick={() => removeAttachedFile(file)}
                          className="hover:opacity-70"
                          aria-label={`Remove file ${file.name}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                {iqubesError && <p className="mb-2 text-xs text-red-700">{iqubesError}</p>}
                {selectedEncryptedCount > 0 && (
                  <p className="mb-2 text-xs text-amber-700">
                    {selectedEncryptedCount} selected iQube(s) are encrypted and require wallet-authorized
                    decryption.
                  </p>
                )}
                <div className="flex items-end gap-3">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendMessage();
                      }
                    }}
                    placeholder="Ask your local agent..."
                    rows={2}
                    className="flex-1 px-4 py-3 rounded-xl bg-white border-2 border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black transition-colors resize-none"
                  />
                  <button
                    onClick={() => void sendMessage()}
                    disabled={!canSend}
                    title="Send message"
                    aria-label="Send message"
                    className="h-[50px] w-[50px] rounded-xl bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {isResolvingContext ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : isStreaming ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
