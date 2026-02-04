/**
 * CodexContext - React Context for CodexQube data
 * Provides iQube protocol compliant content management
 */
import { ReactNode } from 'react';
import type { CodexQube, QubeFilter, QubeSource } from './types';
export interface CodexContextValue {
    /** Currently loaded Codex */
    currentCodex: CodexQube | null;
    /** All available Codices */
    codices: CodexQube[];
    /** Loading state */
    isLoading: boolean;
    /** Error state */
    error: string | null;
    /** Load a specific Codex by ID */
    loadCodex: (codexId: string) => Promise<void>;
    /** Load all Codices matching filter */
    loadCodexList: (filter?: QubeFilter) => Promise<void>;
    /** Refresh current Codex */
    refresh: () => Promise<void>;
}
export declare const CodexContext: import("react").Context<CodexContextValue | null>;
interface CodexProviderProps {
    children: ReactNode;
    /** Data source configuration */
    source: QubeSource;
    /** Auto-load codex ID on mount */
    autoLoadCodexId?: string;
    /** Optional initial data */
    initialCodex?: CodexQube;
}
export declare function CodexProvider({ children, source, autoLoadCodexId, initialCodex, }: CodexProviderProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=CodexContext.d.ts.map