/**
 * @agentiq/codex - CodexQube Types
 * iQube Protocol compliant content management
 *
 * Implements contentQube and AigentQube primitives for
 * protocol-enabled, agent-friendly content structures
 */
/**
 * iQube protocol compliant types for Codex package
 * Based on AgentiQ's franchise-oriented content model
 * Integrates with RQH (Reputation), CRM, x402, and DVN systems
 */
/**
 * iQube Protocol Base
 * All Qubes must implement this base structure
 */
export interface iQubeBase {
    /** Unique identifier following iQube naming convention */
    qubeId: string;
    /** Qube type identifier */
    qubeType: 'contentQube' | 'agentQube' | 'codexQube' | 'domainQube' | 'articleQube';
    /** Protocol version */
    protocolVersion: string;
    /** Creation timestamp */
    createdAt: string;
    /** Last update timestamp */
    updatedAt: string;
    /** Optional metadata */
    metadata?: Record<string, any>;
}
/**
 * Comprehensive access and pricing rules for codex content
 * Integrates with Smart Wallet, RQH (Reputation), CRM (PoKW), and x402 systems
 */
export interface CodexAccessRules {
    /** Whether content is free to access */
    free: boolean;
    /** Pricing in various tokens */
    price?: {
        amountQc?: number;
        amountQct?: number;
        amountQoyn?: number;
        amountKnyt?: number;
    };
    /** Rewards earned for engaging with content */
    rewards?: {
        earnQc?: number;
        earnQct?: number;
        badges?: string[];
    };
    /** Access gates and requirements */
    gates?: {
        minReputation?: number;
        requiredPersonaTags?: string[];
        requiredQuests?: string[];
        requireSubscription?: boolean;
    };
}
/**
 * ArticleQube - contentQube primitive
 * Represents a single piece of content (article, story, media)
 */
export interface ArticleQube extends iQubeBase {
    qubeType: 'articleQube';
    /** Article title */
    title: string;
    /** Article slug for URL */
    slug: string;
    /** Article description/summary */
    description: string;
    /** Main content (markdown or HTML) */
    content: string;
    /** Author information */
    author: {
        name: string;
        avatar?: string;
        role?: string;
    };
    /** Publication date */
    publishedAt: string;
    /** Featured image */
    image?: {
        url: string;
        alt: string;
        credit?: string;
    };
    /** Content tags */
    tags: string[];
    /** Reading time in minutes */
    readingTime?: number;
    /** Content status */
    status: 'draft' | 'published' | 'archived';
    /** Related article IDs */
    relatedArticles?: string[];
    /** Access control and pricing rules */
    access?: CodexAccessRules;
    /** Agent-specific metadata for AigentQube compatibility */
    aigentMetadata?: {
        /** Agent recommendations */
        recommendedAgents?: string[];
        /** Context hints for agents */
        contextHints?: string[];
        /** Actionable intents */
        intents?: string[];
    };
}
/**
 * DomainQube - contentQube collection
 * Represents a thematic domain or category
 */
export interface DomainQube extends iQubeBase {
    qubeType: 'domainQube';
    /** Domain identifier (signals, mythos, logos, etc.) */
    domainId: string;
    /** Display name */
    title: string;
    /** Domain description */
    description: string;
    /** Icon identifier */
    icon: string;
    /** Theme color */
    color: string;
    /** Articles in this domain */
    articles: ArticleQube[];
    /** Domain-specific configuration */
    config?: {
        /** Layout style */
        layout?: 'grid' | 'list' | 'carousel';
        /** Items per page */
        itemsPerPage?: number;
        /** Featured article IDs */
        featuredArticles?: string[];
    };
}
/**
 * CodexQube - Top-level contentQube container
 * Represents an issue or edition (e.g., Issue 0, Issue 1)
 */
export interface CodexQube extends iQubeBase {
    qubeType: 'codexQube';
    /** Codex identifier (e.g., 'theqriptopian-issue-0') */
    codexId: string;
    /** Franchise identifier */
    franchiseId: string;
    /** Tenant identifier (optional for multi-tenant) */
    tenantId?: string;
    /** Issue number */
    issueNumber: number;
    /** Issue title */
    title: string;
    /** Issue description */
    description: string;
    /** Publication date */
    publishedAt: string;
    /** Cover image */
    coverImage?: {
        url: string;
        alt: string;
    };
    /** Domains in this issue */
    domains: DomainQube[];
    /** Issue-wide tags */
    tags: string[];
    /** Issue status */
    status: 'draft' | 'published' | 'archived';
    /** Editorial metadata */
    editorial?: {
        editor?: string;
        theme?: string;
        notes?: string;
    };
}
/**
 * AigentQube - agentQube primitive
 * Agent-specific interaction and context metadata
 */
export interface AigentQube extends iQubeBase {
    qubeType: 'agentQube';
    /** Agent identifier */
    agentId: string;
    /** Agent configuration */
    agent: {
        /** Display name */
        name: string;
        /** Agent role/specialty */
        role: string;
        /** System prompt */
        systemPrompt: string;
        /** Agent avatar/icon */
        avatar?: string;
    };
    /** Associated content */
    contextScope?: {
        /** CodexQube IDs this agent can access */
        codexIds?: string[];
        /** DomainQube IDs this agent specializes in */
        domainIds?: string[];
        /** ArticleQube IDs for specific context */
        articleIds?: string[];
    };
    /** Agent capabilities */
    capabilities?: {
        /** Can execute actions */
        canExecuteActions?: boolean;
        /** Can access external APIs */
        canAccessAPIs?: boolean;
        /** Supported interaction modes */
        modes?: ('text' | 'voice' | 'video')[];
    };
}
/**
 * QubeFilter - Query options for Codex data
 */
export interface QubeFilter {
    /** Filter by franchise */
    franchiseId?: string;
    /** Filter by tenant */
    tenantId?: string;
    /** Filter by status */
    status?: 'draft' | 'published' | 'archived';
    /** Filter by tags */
    tags?: string[];
    /** Filter by domain */
    domainId?: string;
    /** Limit results */
    limit?: number;
    /** Offset for pagination */
    offset?: number;
}
/**
 * QubeSource - Data source configuration
 */
export interface QubeSource {
    /** Source type */
    type: 'local' | 'api' | 'qubebase';
    /** API endpoint or base path */
    endpoint?: string;
    /** Authentication headers */
    headers?: Record<string, string>;
}
//# sourceMappingURL=types.d.ts.map