/**
 * CodexCopilotLayer - Enhanced floating copilot drawer for the Codex
 */

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useMetaAvatar } from "@/app/contexts/MetaAvatarContext";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { useCopilotHost } from "./CopilotHostContext";
import { buildCodexUrl } from "@/utils/codex-nav";
import { personaFetch } from "@/utils/personaSpine";
import type { SmartTriadDeepLink, SmartTriadOperation } from "@/types/smartTriadContext";
const SmartWalletDrawer = dynamic(() => import("../content/SmartWalletDrawer"), { ssr: false });
import { CopilotInferenceBodyRenderer, type PromptSuggestionMeta } from "./CopilotInferenceBodyRenderer";
import {
  Bot,
  User,
  MessageSquare,
  ChevronDown,
  Send,
  Loader2,
  BookOpen,
  Sparkles,
  Wallet,
  CheckSquare,
  Trophy,
  Gift,
  CreditCard,
  PanelRightClose,
  PanelRightOpen,
  PanelBottomClose,
  Hexagon,
  Mic,
  MicOff,
  Volume2,
  Pause,
  Play,
} from "lucide-react";

interface CodexCopilotLayerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  variant?: "floating" | "embedded";
  className?: string;
  hideAvatarToggle?: boolean;
  contextOptions?: Array<{ id: string; label: string }>;
  contextId?: string;
  onContextChange?: (contextId: string) => void;
  inputPanelClassName?: string;
  inputPanelInputClassName?: string;
  promptMaxHeight?: string;
  quickPrompts?: Array<
    | string
    | {
        id?: string;
        label: string;
        prompt?: string;
        icon?: React.ReactNode;
        iconOnly?: boolean;
        skipInference?: boolean;
      }
  >;
  onPrompt?: (prompt: string) => void;
  onUserPrompt?: (
    prompt: string
  ) => Promise<
    | string
    | React.ReactNode
    | {
        content: React.ReactNode;
        walletActions?: WalletActionPayload[];
      }
    | void
  >;
  getChatRequestContext?: (prompt: string) => Record<string, unknown> | undefined;
  /**
   * Optional right-pane ground truth (DCIR observation seam, CFS-020).
   * When present, it is forwarded verbatim as the `groundContext` field of
   * the /api/codex/chat POST body — the same field name and shape
   * SmartTriadCopilotLayer sends — so the server needs no new contract.
   * Defaults to undefined: cartridges that don't pass it get a byte-identical
   * request body (zero behavior change). Purely additive; observation only —
   * it never gates or alters anything in this layer.
   */
  groundContext?: Record<string, unknown>;
  initialMessage?: string;
  seedMessages?: CopilotMessage[];
  messages?: CopilotMessage[];
  onMessagesChange?: (messages: CopilotMessage[]) => void;
  promptPlaceholder?: string;
  /**
   * Floating-copilot dedupe role (CopilotHostContext). 'tab' (default) —
   * a specialized tab-level copilot; registers itself so the shell's generic
   * copilot yields. 'panel' — the cartridge shell's generic copilot; renders
   * nothing while any tab-level host is mounted.
   */
  hostRole?: 'tab' | 'panel';
  /** Deterministic navigation chips (SmartTriad PRD §5) rendered above the
   *  prompt input — same-cartridge tabs + cross-cartridge deep links. */
  deepLinks?: SmartTriadDeepLink[];
  /** Copilot-invocable operations (Phase 3 Actions) — confirm-gated chips;
   *  every route re-gates server-side (admin/entitlement). */
  operations?: SmartTriadOperation[];
  footerContent?: React.ReactNode;
  panelClassName?: string;
  floatingInput?: boolean;
  disablePromptInput?: boolean;
  disableActivationButton?: boolean;
  showQuickPromptsToggle?: boolean;
  enableInferenceRendering?: boolean;
  showTrustIndicators?: boolean;
  isProcessing?: boolean;
  trustProvider?: "openai" | "venice" | "chaingpt" | "thirdweb" | "anthropic";
  showNavMenu?: boolean;
  showWalletMenu?: boolean;
  walletBalance?: number;
  nftCount?: number;
  isFirstVisit?: boolean;
  visitCount?: number;
  panelBorder?: boolean;
  density?: "narrow" | "wide" | "extra-wide";
  walletEmbeddedAnchor?: "left" | "right";
  walletAllowWideLayout?: boolean;
  agent?: {
    id: string;
    name: string;
    evmSepolia?: `0x${string}`;
    evmArb?: `0x${string}`;
    btcAddress?: string;
    fioHandle?: string;
    walletAddress?: string;
  };
  personaId?: string;
  accentColor?: 'cyan' | 'fuchsia' | 'rose' | 'amber' | 'emerald' | 'green' | 'indigo' | string;
  /**
   * When this signal increments AND `isOpen` is true, open the embedded
   * wallet panel pinned to the 'wallet' tab. Used by sign-in CTAs to land
   * an anonymous user on the auth surface inside the cartridge instead of
   * the parallel SmartWalletDrawer (which has z-index conflicts).
   */
  walletTabSignal?: number;
}

type CopilotMode = "chat" | "avatar";

type WalletTab = "wallet" | "library" | "tasks" | "reputation" | "rewards" | "payments";
type WalletActionId = "checkout" | "wallet" | "library" | "tasks" | "rewards" | "reputation";

type WalletActionPayload = {
  id: WalletActionId;
  label: string;
  prompt: string;
  tab: WalletTab;
};

export type CopilotMessage = {
  id: string;
  role: "user" | "assistant";
  content: React.ReactNode;
  timestamp: Date;
  variant?: "bubble" | "panel";
  walletActions?: WalletActionPayload[];
};

type CodexChatResponse = {
  response?: string;
  wallet_actions?: unknown;
};

export function CodexCopilotLayer({
  isOpen,
  onClose,
  onOpen,
  variant = "floating",
  className,
  hideAvatarToggle = false,
  contextOptions,
  contextId,
  onContextChange,
  inputPanelClassName,
  inputPanelInputClassName,
  promptMaxHeight,
  onPrompt,
  onUserPrompt,
  getChatRequestContext,
  groundContext,
  initialMessage,
  seedMessages,
  messages,
  onMessagesChange,
  promptPlaceholder = "Ask a question...",
  hostRole = 'tab',
  deepLinks,
  operations,
  footerContent,
  panelClassName,
  floatingInput = false,
  disablePromptInput = false,
  disableActivationButton = false,
  enableInferenceRendering = false,
  showTrustIndicators = true,
  isProcessing: externalIsProcessing,
  trustProvider,
  showNavMenu = true,
  showWalletMenu = true,
  panelBorder = true,
  density = "narrow",
  walletEmbeddedAnchor = "right",
  walletAllowWideLayout = true,
  agent,
  personaId,
  accentColor = 'cyan',
  walletTabSignal,
}: CodexCopilotLayerProps) {
  // Floating-copilot dedupe (CopilotHostContext): a 'tab'-role floating layer
  // registers itself; the shell's 'panel'-role generic layer yields (renders
  // null, below, after all hooks) while any tab-level host is mounted — so a
  // tab's specialized copilot always wins over the generic shell one.
  const { tabHosts, registerTabHost } = useCopilotHost();
  useEffect(() => {
    if (variant === 'floating' && hostRole === 'tab') return registerTabHost();
    return undefined;
  }, [variant, hostRole, registerTabHost]);
  const yieldToTabHost = variant === 'floating' && hostRole === 'panel' && tabHosts > 0;

  // Operation execution (Phase 3 Actions): confirm → personaFetch (Bearer) →
  // one-line outcome note. The route is the authority (admin/entitlement
  // re-gated server-side); the chip is only a convenience.
  const [opBusy, setOpBusy] = useState<string | null>(null);
  const [opNote, setOpNote] = useState<string | null>(null);
  const runOperation = useCallback(async (op: SmartTriadOperation) => {
    if (!window.confirm(op.confirm)) return;
    setOpBusy(op.id);
    setOpNote(null);
    try {
      const res = await personaFetch(op.route, {
        method: op.method ?? 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(op.body ? { body: JSON.stringify(op.body) } : {}),
      });
      const data = await res.json().catch(() => ({}));
      setOpNote(
        res.ok && data?.ok !== false
          ? `${op.label}: done ✓`
          : `${op.label}: ${data?.error ?? data?.message ?? `HTTP ${res.status}`}`,
      );
    } catch (err) {
      setOpNote(`${op.label}: ${err instanceof Error ? err.message : 'failed'}`);
    } finally {
      setOpBusy(null);
    }
  }, []);

  // Deep-link chip navigation (SmartTriad PRD §5): same-cartridge tabs switch
  // via the codex:navigate-tab seam; cross-cartridge targets navigate via
  // buildCodexUrl (identity-propagating — personaId travels with the link).
  const navigateDeepLink = useCallback((dl: SmartTriadDeepLink) => {
    try {
      if (dl.codexSlug) {
        window.location.href = buildCodexUrl(dl.codexSlug, {
          tab: dl.codexTab,
          personaId: personaId || undefined,
        });
        return;
      }
      if (dl.tab) {
        window.dispatchEvent(new CustomEvent('codex:navigate-tab', { detail: { tab: dl.tab } }));
      }
    } catch { /* non-fatal */ }
  }, [personaId]);

  // Full accent palette — every cyan-* class in this component is derived
  // from these tokens so a single accentColor prop fully re-themes the
  // surface (e.g. emerald for metaMe / Aigent Me).
  type AccentPalette = {
    hex: string;
    bot: string;
    bubble: string;
    pillBorder: string;
    pillBg: string;
    pillText: string;
    pillHoverBg: string;
    softBg: string;
    softText: string;
    softHoverBg: string;
    highlightBg: string;
    highlightText: string;
    highlightTextStrong: string;
    inputFocusBorder: string;
    btnBg: string;
    btnHoverBg: string;
  };
  const ACCENT_PALETTES: Record<string, AccentPalette> = {
    cyan: {
      hex: 'text-cyan-400/90', bot: 'text-cyan-300', bubble: 'bg-cyan-500/20 text-cyan-100 ring-cyan-500/30',
      pillBorder: 'border-cyan-400/40', pillBg: 'bg-cyan-500/15', pillText: 'text-cyan-100', pillHoverBg: 'hover:bg-cyan-500/25',
      softBg: 'bg-cyan-500/20', softText: 'text-cyan-100', softHoverBg: 'hover:bg-cyan-500/30',
      highlightBg: 'bg-cyan-500/15', highlightText: 'text-cyan-200', highlightTextStrong: 'text-cyan-400',
      inputFocusBorder: 'focus:border-cyan-500',
      btnBg: 'bg-cyan-500', btnHoverBg: 'hover:bg-cyan-600',
    },
    fuchsia: {
      hex: 'text-fuchsia-400/90', bot: 'text-fuchsia-300', bubble: 'bg-fuchsia-500/20 text-fuchsia-100 ring-fuchsia-500/30',
      pillBorder: 'border-fuchsia-400/40', pillBg: 'bg-fuchsia-500/15', pillText: 'text-fuchsia-100', pillHoverBg: 'hover:bg-fuchsia-500/25',
      softBg: 'bg-fuchsia-500/20', softText: 'text-fuchsia-100', softHoverBg: 'hover:bg-fuchsia-500/30',
      highlightBg: 'bg-fuchsia-500/15', highlightText: 'text-fuchsia-200', highlightTextStrong: 'text-fuchsia-400',
      inputFocusBorder: 'focus:border-fuchsia-500',
      btnBg: 'bg-fuchsia-500', btnHoverBg: 'hover:bg-fuchsia-600',
    },
    rose: {
      hex: 'text-rose-400/90', bot: 'text-rose-300', bubble: 'bg-rose-500/20 text-rose-100 ring-rose-500/30',
      pillBorder: 'border-rose-400/40', pillBg: 'bg-rose-500/15', pillText: 'text-rose-100', pillHoverBg: 'hover:bg-rose-500/25',
      softBg: 'bg-rose-500/20', softText: 'text-rose-100', softHoverBg: 'hover:bg-rose-500/30',
      highlightBg: 'bg-rose-500/15', highlightText: 'text-rose-200', highlightTextStrong: 'text-rose-400',
      inputFocusBorder: 'focus:border-rose-500',
      btnBg: 'bg-rose-500', btnHoverBg: 'hover:bg-rose-600',
    },
    amber: {
      hex: 'text-amber-400/90', bot: 'text-amber-300', bubble: 'bg-amber-500/20 text-amber-100 ring-amber-500/30',
      pillBorder: 'border-amber-400/40', pillBg: 'bg-amber-500/15', pillText: 'text-amber-100', pillHoverBg: 'hover:bg-amber-500/25',
      softBg: 'bg-amber-500/20', softText: 'text-amber-100', softHoverBg: 'hover:bg-amber-500/30',
      highlightBg: 'bg-amber-500/15', highlightText: 'text-amber-200', highlightTextStrong: 'text-amber-400',
      inputFocusBorder: 'focus:border-amber-500',
      btnBg: 'bg-amber-500', btnHoverBg: 'hover:bg-amber-600',
    },
    emerald: {
      hex: 'text-emerald-400/90', bot: 'text-emerald-300', bubble: 'bg-emerald-500/20 text-emerald-100 ring-emerald-500/30',
      pillBorder: 'border-emerald-400/40', pillBg: 'bg-emerald-500/15', pillText: 'text-emerald-100', pillHoverBg: 'hover:bg-emerald-500/25',
      softBg: 'bg-emerald-500/20', softText: 'text-emerald-100', softHoverBg: 'hover:bg-emerald-500/30',
      highlightBg: 'bg-emerald-500/15', highlightText: 'text-emerald-200', highlightTextStrong: 'text-emerald-400',
      inputFocusBorder: 'focus:border-emerald-500',
      btnBg: 'bg-emerald-500', btnHoverBg: 'hover:bg-emerald-600',
    },
    green: {
      hex: 'text-green-400/90', bot: 'text-green-300', bubble: 'bg-green-500/20 text-green-100 ring-green-500/30',
      pillBorder: 'border-green-400/40', pillBg: 'bg-green-500/15', pillText: 'text-green-100', pillHoverBg: 'hover:bg-green-500/25',
      softBg: 'bg-green-500/20', softText: 'text-green-100', softHoverBg: 'hover:bg-green-500/30',
      highlightBg: 'bg-green-500/15', highlightText: 'text-green-200', highlightTextStrong: 'text-green-400',
      inputFocusBorder: 'focus:border-green-500',
      btnBg: 'bg-green-500', btnHoverBg: 'hover:bg-green-600',
    },
    indigo: {
      hex: 'text-indigo-400/90', bot: 'text-indigo-300', bubble: 'bg-indigo-500/20 text-indigo-100 ring-indigo-500/30',
      pillBorder: 'border-indigo-400/40', pillBg: 'bg-indigo-500/15', pillText: 'text-indigo-100', pillHoverBg: 'hover:bg-indigo-500/25',
      softBg: 'bg-indigo-500/20', softText: 'text-indigo-100', softHoverBg: 'hover:bg-indigo-500/30',
      highlightBg: 'bg-indigo-500/15', highlightText: 'text-indigo-200', highlightTextStrong: 'text-indigo-400',
      inputFocusBorder: 'focus:border-indigo-500',
      btnBg: 'bg-indigo-500', btnHoverBg: 'hover:bg-indigo-600',
    },
    pink: {
      hex: 'text-pink-400/90', bot: 'text-pink-300', bubble: 'bg-pink-500/20 text-pink-100 ring-pink-500/30',
      pillBorder: 'border-pink-400/40', pillBg: 'bg-pink-500/15', pillText: 'text-pink-100', pillHoverBg: 'hover:bg-pink-500/25',
      softBg: 'bg-pink-500/20', softText: 'text-pink-100', softHoverBg: 'hover:bg-pink-500/30',
      highlightBg: 'bg-pink-500/15', highlightText: 'text-pink-200', highlightTextStrong: 'text-pink-400',
      inputFocusBorder: 'focus:border-pink-500',
      btnBg: 'bg-pink-500', btnHoverBg: 'hover:bg-pink-600',
    },
  };
  const ACCENT: AccentPalette = ACCENT_PALETTES[accentColor] ?? ACCENT_PALETTES.cyan;
  // Pre-extract the ring-* class from the bubble token so nested template
  // literals don't trip swc's parser. `bubble` is space-separated; the only
  // ring-prefixed token in every palette is the ring color class.
  const ACCENT_RING = ACCENT.bubble.split(' ').find((c) => c.startsWith('ring-')) ?? '';
  // Pre-compute every accent-derived class combination used inside JSX
  // attributes. swc's parser fails on template literals nested inside
  // another template literal's `${…}` interpolation; consts let JSX use
  // flat `${…}` substitution instead.
  const ACCENT_BUBBLE_MINE       = `${ACCENT.bubble} rounded-br-sm text-sm`;
  const ACCENT_PANEL_ACTIVE      = `${ACCENT.softBg} ${ACCENT_RING} ${ACCENT.highlightText}`;
  const ACCENT_HIGHLIGHT_SOFT    = `${ACCENT.highlightBg} ${ACCENT.highlightText}`;
  const ACCENT_HIGHLIGHT_STRONG  = `${ACCENT.softBg} ${ACCENT.highlightTextStrong}`;
  const isMobile = useIsMobile();
  const { requestAvatar, releaseAvatar } = useMetaAvatar();

  const [copilotMode, setCopilotMode] = useState<CopilotMode>("chat");
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<CopilotMessage[]>([]);
  const displayMessages = messages ?? chatMessages;
  const [showActivationButton, setShowActivationButton] = useState(false);
  const [walletPanelOpen, setWalletPanelOpen] = useState(false);
  const [walletPanelCollapsed, setWalletPanelCollapsed] = useState(false);
  const [walletCopilotOpen, setWalletCopilotOpen] = useState(false);
  const [walletActionsCollapsed, setWalletActionsCollapsed] = useState(false);

  // Auto-reopen the embedded wallet panel on return from a wallet-launched
  // cartridge close. SmartWalletDrawer's navigateToKnytTab appends
  // ?reopenWallet=1 to its returnTo URL; the codex-closed route lands
  // the user back here. Consume + strip the param so the panel re-opens
  // on the Tasks tab exactly where they left off pre-cartridge-launch.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('reopenWallet') !== '1') return;
    setWalletPanelOpen(true);
    setWalletPanelCollapsed(false);
    params.delete('reopenWallet');
    const search = params.toString();
    const newUrl =
      window.location.pathname +
      (search ? `?${search}` : '') +
      window.location.hash;
    try { window.history.replaceState(null, '', newUrl); } catch { /* non-fatal */ }
  }, []);
  const [walletPanelTab, setWalletPanelTab] = useState<WalletTab>("wallet");
  const [walletMenuVisible, setWalletMenuVisible] = useState(true);
  const [walletMenuHover, setWalletMenuHover] = useState(false);
  const [inputPanelVisible, setInputPanelVisible] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarOffset, setSidebarOffset] = useState(64);

  useEffect(() => {
    if (hideAvatarToggle && copilotMode !== "chat") {
      setCopilotMode("chat");
    }
  }, [hideAvatarToggle, copilotMode]);
  const [inputPanelHover, setInputPanelHover] = useState(false);

  // ── Marketa voice (Vapi) ────────────────────────────────────────────────────
  type VapiState = "idle" | "connecting" | "active" | "speaking" | "error";
  const [vapiState, setVapiState] = useState<VapiState>("idle");
  const [vapiPaused, setVapiPaused] = useState(false);
  const vapiPausedRef = useRef(false);
  const vapiRef = useRef<{ start: (cfg: unknown) => Promise<unknown>; stop: () => void } | null>(null);

  useEffect(() => {
    let vapi: typeof vapiRef.current = null;
    import("@vapi-ai/web").then(({ default: Vapi }) => {
      const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
      if (!publicKey) return;
      const instance = new Vapi(publicKey) as unknown as {
        start: (cfg: unknown) => Promise<unknown>;
        stop: () => void;
        on: (event: string, cb: (...args: unknown[]) => void) => void;
      };
      instance.on("call-start", () => setVapiState("active"));
      instance.on("call-end", () => setVapiState("idle"));
      instance.on("speech-start", () => setVapiState("speaking"));
      instance.on("speech-end", () => setVapiState("active"));
      instance.on("error", () => { setVapiState("error"); setVapiPaused(false); vapiPausedRef.current = false; });
      instance.on("message", (msg: unknown) => {
        const m = msg as Record<string, unknown>;
        if (m.type === "transcript" && m.transcriptType === "final" && typeof m.transcript === "string") {
          if (!vapiPausedRef.current) {
            setInputValue((prev) => (prev ? `${prev} ${m.transcript as string}` : (m.transcript as string)));
          }
        }
      });
      vapi = instance;
      vapiRef.current = instance;
    }).catch(() => { /* SDK load failure — voice unavailable */ });
    return () => { vapi?.stop(); };
  }, []);

  const toggleMarketa = useCallback(async () => {
    if (!vapiRef.current) return;
    if (vapiState !== "idle" && vapiState !== "error") {
      vapiRef.current.stop();
      setVapiState("idle");
      setVapiPaused(false);
      vapiPausedRef.current = false;
      return;
    }
    setVapiPaused(false);
    vapiPausedRef.current = false;
    setVapiState("connecting");
    try {
      await vapiRef.current.start({
        name: "Marketa",
        firstMessage: "Hey! I'm Marketa, your voice co-pilot. What would you like to do?",
        transcriber: { provider: "deepgram", model: "nova-2", language: "en-US" },
        voice: {
          provider: "cartesia",
          voiceId: "694f9389-aac1-45b6-b726-9d9369183238",
          model: "sonic-english",
        },
        model: {
          provider: "openai",
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are Marketa, a creative AI co-pilot in the iQube platform. Help users with their questions and tasks. Be concise, helpful, and friendly. Keep responses to 2-3 sentences max.",
            },
          ],
        },
      });
    } catch {
      setVapiState("idle");
    }
  }, [vapiState]);
  // ── end Marketa voice ───────────────────────────────────────────────────────

  const headerHeight = 44;
  const resolvedHeaderHeight = showTrustIndicators ? headerHeight : 0;
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerMeasuredHeight, setFooterMeasuredHeight] = useState(floatingInput ? 100 : 80);
  const resolvedFooterHeight = disablePromptInput ? 0 : footerMeasuredHeight;
  const seededRef = useRef(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialActivationShownRef = useRef(false);
  const copilotPanelRef = useRef<HTMLDivElement>(null);
  const walletLayoutNotifiedRef = useRef(false);
  const metaAvatarFrameRef = useRef<HTMLDivElement>(null);
  const scrollChatToBottom = () => {
    if (!chatContainerRef.current) return;
    requestAnimationFrame(() => {
      if (!chatContainerRef.current) return;
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    });
  };

  // Scroll the most recently added capsule/article panel into view at its
  // top so the user lands on the hero, not the bottom of the article.
  // Used in place of scrollChatToBottom whenever the newest message is a
  // panel — chat-style messages still auto-scroll to bottom below.
  const scrollPanelToTop = (panelId: string) => {
    if (!chatContainerRef.current) return;
    requestAnimationFrame(() => {
      const container = chatContainerRef.current;
      if (!container) return;
      const panel = container.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(panelId)}"]`);
      if (!panel) return;
      const containerTop = container.getBoundingClientRect().top;
      const panelTop = panel.getBoundingClientRect().top;
      container.scrollTop += panelTop - containerTop;
    });
  };

  useEffect(() => {
    if (messages) return;
    if (seededRef.current) return;
    if (seedMessages && seedMessages.length > 0) {
      setChatMessages(seedMessages);
      seededRef.current = true;
      return;
    }
    if (!initialMessage) return;
    setChatMessages([
      {
        id: "welcome-message",
        role: "assistant",
        content: initialMessage,
        timestamp: new Date(0),
      },
    ]);
    seededRef.current = true;
  }, [initialMessage, seedMessages, messages]);

  const showActivationButtonWithTimeout = (timeoutMs: number = 4000) => {
    if (activationTimeoutRef.current) clearTimeout(activationTimeoutRef.current);
    setShowActivationButton(true);
    activationTimeoutRef.current = setTimeout(() => {
      setShowActivationButton(false);
    }, timeoutMs);
  };

  useEffect(() => {
    if (isOpen) {
      if (activationTimeoutRef.current) clearTimeout(activationTimeoutRef.current);
      setShowActivationButton(false);
    }
  }, [isOpen]);

  // Honor sign-in CTA: when an external surface (e.g. KnytTab cart click) bumps
  // walletTabSignal, open the embedded wallet panel pinned to the wallet tab.
  // This is the unified persona entry point inside the cartridge — replaces
  // direct SmartWalletDrawer triggers which have z-index conflicts in embeds.
  useEffect(() => {
    if (walletTabSignal === undefined) return;
    setWalletPanelOpen(true);
    setWalletPanelCollapsed(false);
    setWalletPanelTab('wallet');
  }, [walletTabSignal]);

  useEffect(() => {
    if (variant !== "floating" || disableActivationButton || isOpen) return;
    if (initialActivationShownRef.current) return;
    initialActivationShownRef.current = true;
    showActivationButtonWithTimeout(4000);
  }, [variant, disableActivationButton, isOpen]);

  useEffect(() => {
    return () => {
      if (activationTimeoutRef.current) clearTimeout(activationTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const readSidebarWidth = () => {
      const sidebar = document.querySelector("aside");
      if (!sidebar) {
        setSidebarOffset(0);
        return;
      }
      const width = Math.max(0, Math.round(sidebar.getBoundingClientRect().width));
      setSidebarOffset(width);
    };

    readSidebarWidth();
    const sidebar = document.querySelector("aside");
    const observer =
      sidebar && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => readSidebarWidth())
        : null;
    if (sidebar && observer) observer.observe(sidebar);
    window.addEventListener("resize", readSidebarWidth);

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener("resize", readSidebarWidth);
    };
  }, []);

  useEffect(() => {
    const el = footerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setFooterMeasuredHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxH = parseInt(promptMaxHeight ?? "160", 10);
    const newH = Math.min(el.scrollHeight, maxH);
    el.style.height = `${newH}px`;
    el.style.overflowY = el.scrollHeight > maxH ? "auto" : "hidden";
  }, [inputValue, promptMaxHeight]);

  useEffect(() => {
    if (!isOpen) return;
    setWalletMenuVisible(true);
    const timeoutId = setTimeout(() => setWalletMenuVisible(false), 4000);
    return () => clearTimeout(timeoutId);
  }, [isOpen]);

  useEffect(() => {
    if (copilotMode === "avatar" && isOpen) {
      requestAvatar("codexCopilot", agent?.id || "aigent-z");
      return () => releaseAvatar("codexCopilot");
    }
    releaseAvatar("codexCopilot");
  }, [copilotMode, isOpen, requestAvatar, releaseAvatar, agent?.id]);

  useEffect(() => {
    if (!copilotPanelRef.current) return;

    const updateAnchor = () => {
      const node = copilotPanelRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const root = document.documentElement;
      root.style.setProperty("--metaavatar-codex-x", `${Math.round(rect.left)}px`);
      root.style.setProperty("--metaavatar-codex-y", `${Math.round(rect.top)}px`);
      const frame = metaAvatarFrameRef.current?.getBoundingClientRect();
      const width = frame?.width ?? 320;
      const height = frame?.height ?? 240;
      root.style.setProperty("--metaavatar-codex-w", `${Math.round(width)}px`);
      root.style.setProperty("--metaavatar-codex-h", `${Math.round(height)}px`);
    };

    updateAnchor();
    let id = 0;
    const tick = () => {
      updateAnchor();
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [copilotMode]);

  useEffect(() => {
    // When the latest message is a capsule/article panel, land the user
    // at the top of it (the hero/article opening) instead of the bottom
    // of the chat. Otherwise (chat-style assistant/user messages) keep
    // the normal scroll-to-bottom behaviour.
    const last = displayMessages[displayMessages.length - 1];
    if (last?.variant === "panel") {
      scrollPanelToTop(last.id);
    } else {
      scrollChatToBottom();
    }
  }, [displayMessages]);

  const updateMessages = (updater: (prev: CopilotMessage[]) => CopilotMessage[]) => {
    if (messages) {
      const next = updater([...messages]);
      onMessagesChange?.(next);
    } else {
      setChatMessages(updater);
    }
  };

  const showWalletMenuWithTimeout = (timeoutMs: number = 4000) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setWalletMenuVisible(true);
    hoverTimeoutRef.current = setTimeout(() => setWalletMenuVisible(false), timeoutMs);
  };

  const showInputPanelWithTimeout = (timeoutMs: number = 4000) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setInputPanelVisible(true);
    hoverTimeoutRef.current = setTimeout(() => setInputPanelVisible(false), timeoutMs);
  };

  const resolveProvider = (): "openai" | "venice" | "chaingpt" | "thirdweb" | "anthropic" => {
    if (trustProvider) return trustProvider;
    const name = agent?.name?.toLowerCase() || "";
    if (name.includes("anthropic") || name.includes("claude")) return "anthropic";
    if (name.includes("venice")) return "venice";
    if (name.includes("chaingpt") || name.includes("chain")) return "chaingpt";
    if (name.includes("thirdweb") || name.includes("web3")) return "thirdweb";
    return "openai";
  };

  const clampScore = (value: number) => Math.max(1, Math.min(10, value));

  const getBaseScore = () => {
    const provider = resolveProvider();
    if (provider === "anthropic") return 8.3;
    if (provider === "venice") return 7.8;
    if (provider === "chaingpt") return 8.0;
    if (provider === "thirdweb") return 7.6;
    return 5.0;
  };

  const getReliabilityScore = () => {
    const provider = resolveProvider();
    let score = getBaseScore();
    if (provider === "anthropic" || provider === "venice" || provider === "chaingpt" || provider === "thirdweb") score += 0.8;
    if (isLoading) score -= 0.3;
    return clampScore(score);
  };

  const getTrustScore = () => {
    let score = getBaseScore();
    if (isLoading) score -= 0.3;
    return clampScore(score);
  };

  const renderDots = (
    value: number,
    type: "trust" | "reliability" | "risk",
    isProcessing: boolean
  ) => {
    const dotCount = Math.ceil(value / 2);
    const dots = Array.from({ length: 5 }, (_, index) => {
      let colorClass = "bg-gray-400";
      if (index < dotCount) {
        if (type === "trust") {
          colorClass = value <= 3 ? "bg-red-500" : value <= 6 ? "bg-yellow-500" : "bg-green-500";
        } else if (type === "reliability") {
          colorClass = value <= 3 ? "bg-red-500" : value <= 6 ? "bg-yellow-500" : "bg-purple-500";
        } else {
          colorClass = value <= 4 ? "bg-green-500" : value <= 7 ? "bg-yellow-500" : "bg-red-500";
        }
      }
      return (
        <span
          key={`${type}-${index}`}
          className={`h-1.5 w-1.5 rounded-full ${colorClass} ${
            isProcessing ? "animate-pulse transition-all duration-700" : "transition-all duration-300"
          }`}
          style={isProcessing ? { animationDelay: `${index * 0.15}s` } : undefined}
        />
      );
    });
    return <div className="flex items-center gap-0.5">{dots}</div>;
  };

  const handleWalletMenuEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setWalletMenuHover(true);
    setWalletMenuVisible(true);
  };

  const handleWalletMenuLeave = () => {
    setWalletMenuHover(false);
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setWalletMenuVisible(false), 4000);
  };

  const shouldBypassInference = (message: string, skipInference?: boolean) => {
    if (skipInference) return true;
    const normalized = message.trim().toLowerCase();
    return (
      normalized.startsWith("__runtime_") ||
      normalized === "reset runtime" ||
      normalized === "refresh runtime"
    );
  };

  const normalizeWalletActions = (value: unknown): WalletActionPayload[] => {
    if (!Array.isArray(value)) return [];
    const normalized: WalletActionPayload[] = [];
    const seen = new Set<string>();

    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const record = item as Partial<WalletActionPayload>;
      if (
        typeof record.id !== "string" ||
        typeof record.label !== "string" ||
        typeof record.prompt !== "string" ||
        typeof record.tab !== "string"
      ) {
        continue;
      }

      const tab = record.tab as WalletTab;
      const id = record.id as WalletActionId;
      if (!["wallet", "library", "tasks", "reputation", "rewards"].includes(tab)) continue;
      if (!["checkout", "wallet", "library", "tasks", "rewards", "reputation"].includes(id)) continue;
      if (seen.has(id) || normalized.length >= 3) continue;

      seen.add(id);
      normalized.push({
        id,
        label: record.label.trim(),
        prompt: record.prompt.trim(),
        tab,
      });
    }

    return normalized;
  };

  const walletActionIcon = (action: WalletActionPayload): React.ReactNode => {
    if (action.id === "checkout" || action.id === "wallet") return <Wallet className="h-3.5 w-3.5" />;
    if (action.id === "library") return <BookOpen className="h-3.5 w-3.5" />;
    if (action.id === "tasks") return <CheckSquare className="h-3.5 w-3.5" />;
    if (action.id === "rewards") return <Gift className="h-3.5 w-3.5" />;
    return <Trophy className="h-3.5 w-3.5" />;
  };

  const normalizePromptForRouting = (prompt: string): string =>
    prompt
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[`*_#>]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const resolveWalletPromptTab = (prompt: string): WalletTab | null => {
    const normalized = normalizePromptForRouting(prompt);
    if (/(checkout|purchase|buy|unlock|pay|wallet|balance|funds|spendable|q¢|qct|token|send|receive|verify|usdc|knyt)/.test(normalized)) return "wallet";
    if (/(library|owned|entitlement|collection|inventory)/.test(normalized)) return "library";
    if (/(task|quest|mission|todo)/.test(normalized)) return "tasks";
    if (/(reward|claim|earn|payout|bonus)/.test(normalized)) return "rewards";
    if (/(reputation|trust|score|credibility)/.test(normalized)) return "reputation";
    return null;
  };

  const handlePromptSuggestion = (prompt: string, _meta?: PromptSuggestionMeta) => {
    const matchedTab = resolveWalletPromptTab(prompt);
    if (matchedTab) {
      setWalletPanelTab(matchedTab);
      setWalletPanelOpen(true);
      setWalletPanelCollapsed(false);
      showWalletMenuWithTimeout(6000);
      return;
    }
    void sendMessage(prompt);
  };

  const sendMessage = async (override?: string, options?: { skipInference?: boolean }) => {
    const message = (override ?? inputValue).trim();
    if (!message || isLoading) return;

    updateMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "user", content: message, timestamp: new Date() },
    ]);
    scrollChatToBottom();
    setInputValue("");
    onPrompt?.(message);
    if (shouldBypassInference(message, options?.skipInference)) {
      return;
    }
    setIsLoading(true);

    try {
      if (onUserPrompt) {
        const localResponse = await onUserPrompt(message);
        if (localResponse !== undefined) {
          const responseContent =
            typeof localResponse === "string" ||
            typeof localResponse === "number" ||
            typeof localResponse === "boolean" ||
            localResponse === null ||
            localResponse === undefined ||
            !("content" in (localResponse as any))
              ? (localResponse as React.ReactNode)
              : (localResponse as { content: React.ReactNode }).content;
          const responseWalletActions =
            localResponse &&
            typeof localResponse === "object" &&
            "walletActions" in localResponse &&
            Array.isArray((localResponse as { walletActions?: WalletActionPayload[] }).walletActions)
              ? (localResponse as { walletActions?: WalletActionPayload[] }).walletActions
              : undefined;

          updateMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: responseContent ?? "I can help with that.",
              timestamp: new Date(),
              walletActions: responseWalletActions,
            },
          ]);
          return;
        }
      }

      const chatHistory = displayMessages
        .map((entry) => {
          if (typeof entry.content === "string") {
            return { role: entry.role, content: entry.content };
          }
          if (typeof entry.content === "number" || typeof entry.content === "boolean") {
            return { role: entry.role, content: String(entry.content) };
          }
          return null;
        })
        .filter(Boolean);

      const extraContext = getChatRequestContext?.(message) || {};

      const response = await fetch("/api/codex/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          persona: personaId || "kn0w1",
          personaId: personaId || null,
          contextId: contextId || null,
          chatHistory,
          // DCIR observation seam (optional, additive): omitted entirely when
          // the host cartridge doesn't pass the groundContext prop, so every
          // existing caller's request body is unchanged.
          ...(groundContext ? { groundContext } : {}),
          ...extraContext,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as CodexChatResponse;
      const structuredWalletActions = normalizeWalletActions(data?.wallet_actions);
      updateMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data?.response || "I can help with that.",
          timestamp: new Date(),
          walletActions: structuredWalletActions.length > 0 ? structuredWalletActions : undefined,
        },
      ]);
    } catch {
      updateMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const buildWalletActionCards = (content: string): WalletActionPayload[] => {
    const normalized = content.toLowerCase();
    const cards: WalletActionPayload[] = [];
    const seen = new Set<string>();

    const register = (card: WalletActionPayload) => {
      if (seen.has(card.id) || cards.length >= 3) return;
      seen.add(card.id);
      cards.push(card);
    };

    const registerPreset = (preset: string) => {
      if (preset === "checkout") {
        register({
          id: "checkout",
          label: "Open Checkout",
          prompt: "Open wallet checkout for the selected item.",
          tab: "wallet",
        });
      } else if (preset === "wallet" || preset === "balance") {
        register({
          id: "wallet",
          label: "Wallet Balance",
          prompt: "Show wallet balance and spendable funds.",
          tab: "wallet",
        });
      } else if (preset === "library") {
        register({
          id: "library",
          label: "Open Library",
          prompt: "Open the wallet library tab.",
          tab: "library",
        });
      } else if (preset === "tasks") {
        register({
          id: "tasks",
          label: "View Tasks",
          prompt: "Open the wallet tasks tab.",
          tab: "tasks",
        });
      } else if (preset === "rewards") {
        register({
          id: "rewards",
          label: "Claim Rewards",
          prompt: "Open the wallet rewards tab.",
          tab: "rewards",
        });
      } else if (preset === "reputation") {
        register({
          id: "reputation",
          label: "View Reputation",
          prompt: "Open the wallet reputation tab.",
          tab: "reputation",
        });
      }
    };

    const actionTags = Array.from(content.matchAll(/\[wallet_action:([a-z_-]+)\]/gi));
    actionTags.forEach((match) => {
      registerPreset(match[1].toLowerCase());
    });

    if (/(checkout|purchase|buy|unlock|pay)/.test(normalized)) {
      registerPreset("checkout");
    }
    if (/(wallet|balance|funds|spendable|q¢|qct)/.test(normalized)) {
      registerPreset("wallet");
    }
    if (/(reward|claim|earn)/.test(normalized)) {
      registerPreset("rewards");
    }
    if (/(task|quest|mission)/.test(normalized)) {
      registerPreset("tasks");
    }
    if (/(library|owned|entitlement)/.test(normalized)) {
      registerPreset("library");
    }
    if (/(reputation|trust|score)/.test(normalized)) {
      registerPreset("reputation");
    }

    return cards;
  };

  if (!isOpen && variant !== "floating") return null;

  const defaultPanelWidthClass =
    density === "extra-wide"
      ? "w-full md:w-[40rem]"
      : density === "wide"
        ? "w-full md:w-[32rem]"
        : "w-full md:w-[22rem]";
  const widthClass = panelClassName ?? defaultPanelWidthClass;
  const walletPanelWidthClass =
    density === "extra-wide"
      ? "w-full md:w-[40.25rem]"
      : !walletAllowWideLayout
        ? "w-full md:w-[22.25rem]"
        : density === "wide" || (density === "narrow" && walletCopilotOpen)
        ? "w-full md:w-[32.25rem]"
        : "w-full md:w-[22.25rem]";
  const walletEmbeddedWidth = "fixed";
  const walletMenuBottomClass = floatingInput ? "bottom-[93px]" : "bottom-[89px]";
  const embeddedContainerClass = `relative h-full w-full overflow-hidden flex flex-col ${
    walletEmbeddedAnchor === "left" ? "md:flex-row-reverse" : "md:flex-row"
  } gap-2`;
  const embeddedPanelClass = "flex-1 min-w-0 h-full";
  const currentWalletLayout: "narrow" | "wide" =
    walletAllowWideLayout && (walletCopilotOpen || (density === "wide" || density === "extra-wide"))
      ? "wide"
      : "narrow";

  useEffect(() => {
    if (variant !== "embedded") return;
    if (typeof window === "undefined") return;
    if (window.parent === window) return;
    const isWalletVisible = walletPanelOpen && !walletPanelCollapsed;
    if (isWalletVisible) {
      const widthPx = currentWalletLayout === "wide" ? 516 : 356;
      window.parent.postMessage(
        {
          type: "wallet-layout-change",
          layout: currentWalletLayout,
          width_px: widthPx,
          anchor: walletEmbeddedAnchor,
          source: "runtime-embedded-wallet",
        },
        "*"
      );
      walletLayoutNotifiedRef.current = true;
      return;
    }

    if (walletLayoutNotifiedRef.current) {
      window.parent.postMessage(
        {
          type: "wallet-layout-change",
          layout: "narrow",
          width_px: 356,
          anchor: walletEmbeddedAnchor,
          source: "runtime-embedded-wallet",
        },
        "*"
      );
      walletLayoutNotifiedRef.current = false;
    }
  }, [currentWalletLayout, variant, walletEmbeddedAnchor, walletPanelCollapsed, walletPanelOpen]);

  // Placed after every hook (rules of hooks): the shell's generic copilot
  // yields entirely while a tab-level specialized copilot is mounted.
  if (yieldToTabHost) return null;

  return (
    <>
      {variant === "floating" && !isOpen && !disableActivationButton && !showActivationButton && (
        <div
          className={`fixed bottom-0 z-[110] ${
            isMobile ? "right-0 h-36 w-36" : "right-0 h-52 w-52"
          }`}
          onMouseEnter={() => showActivationButtonWithTimeout(4000)}
        />
      )}

      {variant === "floating" && !isOpen && showActivationButton && !disableActivationButton && (
        <button
          onClick={onOpen || (() => {})}
          className={`fixed bottom-4 z-[130] p-0 bg-transparent ring-0 shadow-none transition-all duration-300 hover:scale-110 ${
            isMobile ? "right-4" : "right-4"
          }`}
          aria-label="Open Copilot"
        >
          <span className="relative flex h-12 w-12 items-center justify-center md:h-14 md:w-14">
            <Hexagon className={`absolute inset-0 h-full w-full ${ACCENT.hex}`} strokeWidth={1.1} />
            <Bot className={`relative h-5 w-5 ${ACCENT.bot} md:h-6 md:w-6`} />
          </span>
        </button>
      )}

      {isOpen && (
        <div
          className={
            variant === "embedded"
              ? `${embeddedContainerClass} ${className || ""}`
              : `codex-copilot-container fixed z-[120] flex flex-col md:flex-row gap-2 transition-all duration-300 ease-out ${
                  isMobile
                    ? "inset-0 min-h-[100svh]"
                    : isFullscreen
                      ? "right-0 top-0 bottom-0 md:h-[100vh]"
                      : "right-2 bottom-2 md:h-[calc(100vh-96px)] md:max-h-[760px] md:min-h-[620px]"
                }`
          }
          style={!isMobile && isFullscreen ? { left: `${sidebarOffset}px` } : undefined}
        >
          <div
            ref={copilotPanelRef}
            className={`${variant === "embedded" ? embeddedPanelClass : widthClass} ${
              variant === "embedded" ? "h-full min-h-0" : "h-full md:h-full"
            } transition-all duration-300 ease-out`}
          >
            <div className={`h-full ${variant === "embedded" ? "bg-black/[0.18] backdrop-blur-sm rounded-none" : "bg-black/30 backdrop-blur-xl rounded-2xl shadow-2xl"} flex flex-col overflow-hidden ${panelBorder ? "ring-1 ring-white/10" : ""}`}>
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                {copilotMode === "chat" ? (
                  <>
                    <div className="flex-1 relative overflow-hidden">
                      {showTrustIndicators ? (
                        <div
                          className="absolute top-0 left-0 right-0 z-20 bg-slate-950 px-3 pr-6 py-2 flex items-center gap-4 border-b border-white/10 justify-end"
                          style={{ height: `${headerHeight}px` }}
                        >
                          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/70">
                            <span className="text-[10px] text-white/60">R</span>
                            {renderDots(getReliabilityScore(), "reliability", isLoading || !!externalIsProcessing)}
                          </div>
                          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/70">
                            <span className="text-[10px] text-white/60">T</span>
                            {renderDots(getTrustScore(), "trust", isLoading || !!externalIsProcessing)}
                          </div>
                        </div>
                      ) : null}
                      <div
                        ref={chatContainerRef}
                        className="absolute left-0 right-0 overflow-y-auto px-4 space-y-3 overscroll-contain"
                        style={{ top: `${resolvedHeaderHeight}px`, bottom: `${resolvedFooterHeight}px`, paddingTop: "12px", paddingBottom: "12px" }}
                      >
                        {displayMessages.map((msg, index) => {
                          const isPanel = msg.variant === "panel";
                          if (isPanel) {
                            return (
                              <div key={msg.id} data-message-id={msg.id} data-message-variant="panel" className="w-full">
                                {msg.content}
                              </div>
                            );
                          }
                          const showWalletActionCards =
                            msg.role === "assistant" &&
                            typeof msg.content === "string" &&
                            index === displayMessages.length - 1;
                          const walletActionCards = showWalletActionCards
                            ? msg.walletActions && msg.walletActions.length > 0
                              ? msg.walletActions
                              : buildWalletActionCards(msg.content as string)
                            : [];
                          return (
                            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                              <div
                                className={`max-w-[90%] px-3 py-2 rounded-xl ring-1 ${
                                  msg.role === "user"
                                    ? ACCENT_BUBBLE_MINE
                                    : "bg-white/5 text-white/90 rounded-bl-sm ring-white/10"
                                }`}
                              >
                                {enableInferenceRendering &&
                                msg.role === "assistant" &&
                                typeof msg.content === "string" ? (
                                  <CopilotInferenceBodyRenderer
                                    content={msg.content}
                                    onPromptSuggestion={handlePromptSuggestion}
                                  />
                                ) : (
                                  msg.content
                                )}
                                {walletActionCards.length > 0 ? (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {walletActionCards.map((card) => (
                                    <button
                                      key={`${msg.id}-${card.id}`}
                                      type="button"
                                      onClick={() => {
                                        setWalletPanelTab(card.tab);
                                        setWalletPanelOpen(true);
                                        setWalletPanelCollapsed(false);
                                        showWalletMenuWithTimeout(6000);
                                      }}
                                      className={`inline-flex items-center gap-1.5 rounded-full border ${ACCENT.pillBorder} ${ACCENT.pillBg} px-2.5 py-1 text-[11px] font-medium ${ACCENT.pillText} transition-colors ${ACCENT.pillHoverBg}`}
                                    >
                                        {walletActionIcon(card)}
                                        <span>{card.label}</span>
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                        {isLoading && (
                          <div className="flex justify-start">
                            <div className="bg-white/5 px-3 py-2 rounded-xl rounded-bl-sm ring-1 ring-white/10">
                              <Loader2 className="w-4 h-4 animate-spin text-white/60" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Floating wallet icons bar retired (2026-07-19) — it
                          overlapped the quick-action carousel + inference copy and
                          its lazy chunk could fail to load. The wallet now launches
                          from the single Wallet icon in the nav-menu footer below. */}
                    </div>

                    {!disablePromptInput ? (
                      <div
                        ref={footerRef}
                        className={`absolute inset-x-0 bottom-0 px-3 pb-0 pt-0 z-30 ${
                          floatingInput ? "bg-transparent" : "bg-white/5"
                        }`}
                      >
                      {floatingInput && (
                        <>
                          <div
                            className="absolute left-0 right-0 bottom-0 h-28"
                            onMouseEnter={() => showInputPanelWithTimeout()}
                          />
                          <div
                            className={`absolute left-3 right-3 bottom-8 z-40 transition-opacity duration-200 ${
                              inputPanelVisible || inputPanelHover
                                ? "opacity-100 pointer-events-auto"
                                : "opacity-0 pointer-events-none"
                            }`}
                            onMouseEnter={() => {
                              setInputPanelHover(true);
                              setInputPanelVisible(true);
                            }}
                            onMouseLeave={() => {
                              setInputPanelHover(false);
                              showInputPanelWithTimeout();
                            }}
                          >
                            <div className={inputPanelClassName ?? "rounded-2xl border border-white/10 bg-slate-950/85 backdrop-blur-xl px-3 py-1.5 shadow-lg"}>
                              <div className="flex gap-2 items-end">
                                <textarea
                                  ref={textareaRef}
                                  value={inputValue}
                                  onChange={(e) => {
                                    setInputValue(e.target.value);
                                    e.target.style.height = "auto";
                                    const maxH = parseInt(promptMaxHeight ?? "160", 10);
                                    const newH = Math.min(e.target.scrollHeight, maxH);
                                    e.target.style.height = `${newH}px`;
                                    e.target.style.overflowY = e.target.scrollHeight > maxH ? "auto" : "hidden";
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                      e.preventDefault();
                                      sendMessage();
                                    }
                                  }}
                                  onFocus={() => { showInputPanelWithTimeout(); }}
                                  placeholder={promptPlaceholder}
                                  rows={1}
                                  style={{ resize: "none", overflowY: "hidden", minHeight: "36px", maxHeight: promptMaxHeight ?? "160px" }}
                                  className={inputPanelInputClassName ?? `flex-1 px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none ${ACCENT.inputFocusBorder} text-sm`}
                                  disabled={isLoading}
                                />
                                <button
                                  onClick={() => sendMessage()}
                                  disabled={!inputValue.trim() || isLoading}
                                  className={`p-1.5 ${ACCENT.btnBg} ${ACCENT.btnHoverBg} disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors flex-shrink-0`}
                                >
                                  {isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Send className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                      {/* Deep-link chips (SmartTriad PRD §5) — deterministic
                          navigation the copilot surfaces: same-cartridge tabs
                          via codex:navigate-tab, cross-cartridge via
                          buildCodexUrl. Rendered by the layer (never parsed
                          from model output) so navigation is always reliable. */}
                      {((deepLinks && deepLinks.length > 0) || (operations && operations.length > 0)) && (
                        <div className="mb-1.5 rounded-lg border border-slate-800 bg-slate-900/90 px-1.5 py-1 backdrop-blur">
                          {/* Single-row carousel: chips never wrap; overflow scrolls
                              horizontally. The opaque slate backing keeps chips and
                              the inference copy behind them both legible. */}
                          <div className="flex flex-nowrap items-center gap-1 overflow-x-auto no-scrollbar">
                            {(deepLinks ?? []).map((dl) => (
                              <button
                                key={dl.label}
                                onClick={() => navigateDeepLink(dl)}
                                className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] transition ${ACCENT.pillBorder} ${ACCENT.pillBg} ${ACCENT.pillText} ${ACCENT.pillHoverBg}`}
                                title={dl.codexSlug ? `Open ${dl.label} (another cartridge)` : `Go to ${dl.label}`}
                              >
                                {dl.label}
                              </button>
                            ))}
                            {/* Operations (Phase 3 Actions) — amber, confirm-gated,
                                server-re-gated. Distinct from navigation chips. */}
                            {(operations ?? []).map((op) => (
                              <button
                                key={op.id}
                                onClick={() => void runOperation(op)}
                                disabled={opBusy !== null}
                                className="shrink-0 whitespace-nowrap rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
                                title={op.confirm}
                              >
                                {opBusy === op.id ? "Running…" : `▸ ${op.label}`}
                              </button>
                            ))}
                          </div>
                          {opNote && <div className="mt-1 text-[10px] text-slate-400">{opNote}</div>}
                        </div>
                      )}
                      {!floatingInput && (
                        <div>
                          <div className="h-px bg-white/10 mb-2" />
                          <div className="flex gap-2 items-end">
                            <textarea
                              ref={textareaRef}
                              value={inputValue}
                              onChange={(e) => {
                                setInputValue(e.target.value);
                                e.target.style.height = "auto";
                                const maxH = parseInt(promptMaxHeight ?? "160", 10);
                                const newH = Math.min(e.target.scrollHeight, maxH);
                                e.target.style.height = `${newH}px`;
                                e.target.style.overflowY = e.target.scrollHeight > maxH ? "auto" : "hidden";
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  sendMessage();
                                }
                              }}
                              onFocus={() => {
                                showWalletMenuWithTimeout();
                              }}
                              placeholder={promptPlaceholder}
                              rows={1}
                              style={{ resize: "none", overflowY: "hidden", minHeight: "36px", maxHeight: promptMaxHeight ?? "160px" }}
                              className={`flex-1 px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none ${ACCENT.inputFocusBorder} text-sm`}
                              disabled={isLoading}
                            />
                            <button
                              onClick={() => sendMessage()}
                              disabled={!inputValue.trim() || isLoading}
                              className={`p-1.5 ${ACCENT.btnBg} ${ACCENT.btnHoverBg} disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors flex-shrink-0`}
                            >
                              {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                        {footerContent ? (
                          <div className={floatingInput ? "pt-3" : "mt-3"}>{footerContent}</div>
                        ) : showNavMenu ? (
                        <div className="mt-1 flex items-center justify-between border-t border-white/10 pt-1 pb-2">
                          {/* LEFT: integrated badge+dropdown when hideAvatarToggle, else mode toggle */}
                          {hideAvatarToggle ? (
                            <div className="relative flex items-center gap-1">
                              {contextOptions && contextOptions.length > 0 && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setContextMenuOpen((prev) => !prev)}
                                    className={`flex items-center gap-1 rounded-sm border ${ACCENT.pillBorder} ${ACCENT.softBg} px-2 py-1 text-[11px] font-semibold ${ACCENT.softText} ${ACCENT.softHoverBg} transition`}
                                  >
                                    {contextOptions?.find((opt) => opt.id === contextId)?.label || "Qriptopian Codex"}
                                    <ChevronDown className={`w-3 h-3 transition-transform ${contextMenuOpen ? "rotate-180" : ""}`} />
                                  </button>
                                  {contextMenuOpen && (
                                    <div className="absolute left-0 bottom-10 min-w-[180px] rounded-xl border border-white/10 bg-slate-950/90 p-2 shadow-xl backdrop-blur z-50">
                                      {contextOptions.map((opt) => (
                                        <button
                                          key={opt.id}
                                          onClick={() => {
                                            onContextChange?.(opt.id);
                                            setContextMenuOpen(false);
                                          }}
                                          className={`w-full rounded-lg px-3 py-2 text-left text-xs transition ${
                                            opt.id === contextId
                                              ? ACCENT_HIGHLIGHT_SOFT
                                              : "text-white/70 hover:bg-white/5"
                                          }`}
                                        >
                                          {opt.label}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5 ring-1 ring-white/10 flex-shrink-0">
                              <button
                                onClick={() => setCopilotMode("avatar")}
                                className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-xs transition-all ${
                                  (copilotMode as CopilotMode) === "avatar"
                                    ? "bg-purple-500/20 text-purple-400"
                                    : "text-white/50 hover:text-white/80"
                                }`}
                              >
                                <User className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setCopilotMode("chat")}
                                className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-xs transition-all ${
                                  (copilotMode as CopilotMode) === "chat"
                                    ? ACCENT_HIGHLIGHT_STRONG
                                    : "text-white/50 hover:text-white/80"
                                }`}
                              >
                                <MessageSquare className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          {/* RIGHT: wallet launcher + badge+dropdown (non-hideAvatarToggle only) + pause + mic */}
                          <div className="relative flex items-center gap-1">
                            {showWalletMenu && (
                              <button
                                type="button"
                                onClick={() => {
                                  setWalletPanelTab("wallet");
                                  setWalletPanelOpen(true);
                                  setWalletPanelCollapsed(false);
                                }}
                                title="Open wallet"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 ring-1 ring-white/10 transition-colors"
                              >
                                <Wallet className="w-4 h-4" />
                              </button>
                            )}
                            {!hideAvatarToggle && (
                              <>
                                {contextOptions && contextOptions.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => setContextMenuOpen((prev) => !prev)}
                                    className={`flex items-center gap-1 rounded-sm border ${ACCENT.pillBorder} ${ACCENT.softBg} px-2 py-1 text-[11px] font-semibold ${ACCENT.softText} ${ACCENT.softHoverBg} transition`}
                                  >
                                    {contextOptions?.find((opt) => opt.id === contextId)?.label || "Qriptopian Codex"}
                                    <ChevronDown className={`w-3 h-3 transition-transform ${contextMenuOpen ? "rotate-180" : ""}`} />
                                  </button>
                                ) : (
                                  <button
                                    onClick={onClose}
                                    className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 ring-1 ring-white/10 transition-colors"
                                  >
                                    <ChevronDown className="w-4 h-4" />
                                  </button>
                                )}
                                {contextMenuOpen && contextOptions && contextOptions.length > 0 && (
                                  <div className="absolute right-0 bottom-10 min-w-[180px] rounded-xl border border-white/10 bg-slate-950/90 p-2 shadow-xl backdrop-blur z-50">
                                    {contextOptions.map((opt) => (
                                      <button
                                        key={opt.id}
                                        onClick={() => {
                                          onContextChange?.(opt.id);
                                          setContextMenuOpen(false);
                                        }}
                                        className={`w-full rounded-lg px-3 py-2 text-left text-xs transition ${
                                          opt.id === contextId
                                            ? ACCENT_HIGHLIGHT_SOFT
                                            : "text-white/70 hover:bg-white/5"
                                        }`}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                            {vapiState !== "idle" && (
                              <button
                                onClick={() => {
                                  const next = !vapiPaused;
                                  setVapiPaused(next);
                                  vapiPausedRef.current = next;
                                }}
                                title={vapiPaused ? "Resume audio input" : "Pause audio input"}
                                className={`p-1.5 rounded-lg transition ${vapiPaused ? "text-amber-300 bg-amber-500/10" : "text-slate-400 hover:text-slate-200 hover:bg-white/10"}`}
                              >
                                {vapiPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                if (vapiState === "error") { setVapiState("idle"); return; }
                                void toggleMarketa();
                              }}
                              title={
                                vapiState === "idle" ? "Talk to Marketa"
                                  : vapiState === "error" ? "Voice unavailable — tap to dismiss"
                                  : "Stop Marketa"
                              }
                              className={`p-1.5 rounded-lg transition-colors ${
                                vapiState === "idle"
                                  ? "text-slate-400 hover:text-fuchsia-300 hover:bg-fuchsia-500/10"
                                  : vapiState === "connecting"
                                    ? "animate-pulse text-amber-300 bg-amber-500/10"
                                    : vapiState === "error"
                                      ? "text-rose-400 bg-rose-500/10"
                                      : vapiState === "speaking"
                                        ? "animate-pulse text-green-300 bg-green-500/10"
                                        : "text-fuchsia-300 bg-fuchsia-500/15"
                              }`}
                            >
                              {vapiState === "idle" ? (
                                <Mic className="w-4 h-4" />
                              ) : vapiState === "connecting" ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : vapiState === "error" ? (
                                <MicOff className="w-4 h-4" />
                              ) : vapiState === "speaking" ? (
                                <Volume2 className="w-4 h-4" />
                              ) : (
                                <MicOff className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      ) : null}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="flex-1 flex flex-col min-h-0">
                    <div
                      ref={metaAvatarFrameRef}
                      className="flex-1 relative min-h-[240px] bg-black/50 rounded-lg overflow-hidden"
                    />
                    {showNavMenu ? (
                      <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-1 pb-2">
                        {/* LEFT: integrated badge+dropdown when hideAvatarToggle, else mode toggle */}
                        {hideAvatarToggle ? (
                          <div className="relative flex items-center gap-1">
                            {contextOptions && contextOptions.length > 0 && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setContextMenuOpen((prev) => !prev)}
                                  className={`flex items-center gap-1 rounded-sm border ${ACCENT.pillBorder} ${ACCENT.softBg} px-2 py-1 text-[11px] font-semibold ${ACCENT.softText} ${ACCENT.softHoverBg} transition`}
                                >
                                  {contextOptions?.find((opt) => opt.id === contextId)?.label || "Qriptopian Codex"}
                                  <ChevronDown className={`w-3 h-3 transition-transform ${contextMenuOpen ? "rotate-180" : ""}`} />
                                </button>
                                {contextMenuOpen && (
                                  <div className="absolute left-0 bottom-10 min-w-[180px] rounded-xl border border-white/10 bg-slate-950/90 p-2 shadow-xl backdrop-blur z-50">
                                    {contextOptions.map((opt) => (
                                      <button
                                        key={opt.id}
                                        onClick={() => {
                                          onContextChange?.(opt.id);
                                          setContextMenuOpen(false);
                                        }}
                                        className={`w-full rounded-lg px-3 py-2 text-left text-xs transition ${
                                          opt.id === contextId
                                            ? ACCENT_HIGHLIGHT_SOFT
                                            : "text-white/70 hover:bg-white/5"
                                        }`}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5 ring-1 ring-white/10 flex-shrink-0">
                            <button
                              onClick={() => setCopilotMode("avatar")}
                              className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-xs transition-all ${
                                (copilotMode as CopilotMode) === "avatar"
                                  ? "bg-purple-500/20 text-purple-400"
                                  : "text-white/50 hover:text-white/80"
                              }`}
                            >
                              <User className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setCopilotMode("chat")}
                              className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-xs transition-all ${
                                (copilotMode as CopilotMode) === "chat"
                                  ? ACCENT_HIGHLIGHT_STRONG
                                  : "text-white/50 hover:text-white/80"
                              }`}
                            >
                              <MessageSquare className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        {/* RIGHT: wallet launcher + badge+dropdown (non-hideAvatarToggle only) + pause + mic */}
                        <div className="relative flex items-center gap-1">
                          {showWalletMenu && (
                            <button
                              type="button"
                              onClick={() => {
                                setWalletPanelTab("wallet");
                                setWalletPanelOpen(true);
                                setWalletPanelCollapsed(false);
                              }}
                              title="Open wallet"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 ring-1 ring-white/10 transition-colors"
                            >
                              <Wallet className="w-4 h-4" />
                            </button>
                          )}
                          {!hideAvatarToggle && (
                            <>
                              {contextOptions && contextOptions.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setContextMenuOpen((prev) => !prev)}
                                  className={`flex items-center gap-1 rounded-sm border ${ACCENT.pillBorder} ${ACCENT.softBg} px-2 py-1 text-[11px] font-semibold ${ACCENT.softText} ${ACCENT.softHoverBg} transition`}
                                >
                                  {contextOptions?.find((opt) => opt.id === contextId)?.label || "Qriptopian Codex"}
                                  <ChevronDown className={`w-3 h-3 transition-transform ${contextMenuOpen ? "rotate-180" : ""}`} />
                                </button>
                              ) : (
                                <button
                                  onClick={onClose}
                                  className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 ring-1 ring-white/10 transition-colors"
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </button>
                              )}
                              {contextMenuOpen && contextOptions && contextOptions.length > 0 && (
                                <div className="absolute right-0 bottom-10 min-w-[180px] rounded-xl border border-white/10 bg-slate-950/90 p-2 shadow-xl backdrop-blur z-50">
                                  {contextOptions.map((opt) => (
                                    <button
                                      key={opt.id}
                                      onClick={() => {
                                        onContextChange?.(opt.id);
                                        setContextMenuOpen(false);
                                      }}
                                      className={`w-full rounded-lg px-3 py-2 text-left text-xs transition ${
                                        opt.id === contextId
                                          ? ACCENT_HIGHLIGHT_SOFT
                                          : "text-white/70 hover:bg-white/5"
                                      }`}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                          {vapiState !== "idle" && (
                            <button
                              onClick={() => {
                                const next = !vapiPaused;
                                setVapiPaused(next);
                                vapiPausedRef.current = next;
                              }}
                              title={vapiPaused ? "Resume audio input" : "Pause audio input"}
                              className={`p-1.5 rounded-lg transition ${vapiPaused ? "text-amber-300 bg-amber-500/10" : "text-slate-400 hover:text-slate-200 hover:bg-white/10"}`}
                            >
                              {vapiPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void toggleMarketa()}
                            title={vapiState === "idle" ? "Talk to Marketa" : "Stop Marketa"}
                            className={`p-1.5 rounded-lg transition-colors ${
                              vapiState === "idle"
                                ? "text-slate-400 hover:text-fuchsia-300 hover:bg-fuchsia-500/10"
                                : vapiState === "connecting"
                                  ? "animate-pulse text-amber-300 bg-amber-500/10"
                                  : vapiState === "speaking"
                                    ? "animate-pulse text-green-300 bg-green-500/10"
                                    : "text-fuchsia-300 bg-fuchsia-500/15"
                            }`}
                          >
                            {vapiState === "idle" ? (
                              <Mic className="w-4 h-4" />
                            ) : vapiState === "connecting" ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : vapiState === "speaking" ? (
                              <Volume2 className="w-4 h-4" />
                            ) : (
                              <MicOff className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>

          {walletPanelOpen && !walletPanelCollapsed && (
            <div className={`rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl ${walletPanelWidthClass} h-full min-h-0 md:h-full md:max-h-none`}>
              <SmartWalletDrawer
                open={true}
                onClose={() => {
                  setWalletPanelOpen(false);
                  setWalletPanelCollapsed(false);
                  setWalletCopilotOpen(false);
                }}
                variant="embedded"
                embeddedWidth={walletEmbeddedWidth}
                embeddedAnchor={walletEmbeddedAnchor}
                allowWideLayout={walletAllowWideLayout}
                initialTab={walletPanelTab}
                onTabChange={setWalletPanelTab}
                onCopilotStateChange={setWalletCopilotOpen}
                agent={agent || {
                  id: "default",
                  name: "Demo Agent",
                }}
                codexMode={true}
                personaId={personaId}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
