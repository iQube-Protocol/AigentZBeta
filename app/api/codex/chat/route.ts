/**
 * Codex Copilot Chat API
 * 
 * Provides intelligent responses about the metaKnyts and Qriptopian universes
 * using codex metadata and user context for personalized AI responses.
 * 
 * User context is derived from:
 * - Wallet data (balances, purchases, holdings)
 * - Persona data (DiDQube identity)
 * - User prompts (intent analysis)
 * - Declared roles (investor, creative, developer, entrepreneur, fan)
 * 
 * Supports both domains:
 * - metaKnyts (KNYT Codex) - Kn0w1 persona
 * - Qriptopian (Qriptopian Codex) - MoneyPenny persona
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEmbeddingService } from '@/services/content/embeddingService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize embedding service for KB search
const embeddingService = getEmbeddingService();

// OpenAI configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// ============================================================================
// Types
// ============================================================================

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

type UserRole = 'investor' | 'creative' | 'developer' | 'entrepreneur' | 'fan';
type ContentDomain = 'metaKnyts' | 'qriptopian';

interface UserContext {
  domain: ContentDomain;
  roles: UserRole[];
  primaryRole: UserRole;
  walletBalance?: number;
  nftCount?: number;
  isFirstVisit?: boolean;
  visitCount?: number;
}

interface CodexMetadata {
  characters: any[];
  episodes: any[];
  stats: {
    characterCount: number;
    episodeCount: number;
    coverCount: number;
    masterCount: number;
  };
}

interface KBSearchResult {
  content: string;
  title: string;
  contentCategory: string;
  similarity: number;
}

// Search Knowledge Base for relevant content with timeout
async function searchKnowledgeBase(
  query: string, 
  domain: ContentDomain,
  limit: number = 3
): Promise<KBSearchResult[]> {
  try {
    // Add 5 second timeout to prevent hanging
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('KB search timeout')), 5000)
    );
    
    const searchPromise = embeddingService.hybridSearch(query, domain, limit);
    
    const results = await Promise.race([searchPromise, timeoutPromise]);
    
    console.log(`[CodexChat] KB search found ${results.length} results`);
    
    return results.map(r => ({
      content: r.content,
      title: r.metadata.title || 'Unknown',
      contentCategory: r.metadata.contentCategory || 'general',
      similarity: r.similarity,
    }));
  } catch (error) {
    console.error('[CodexChat] KB search error:', error);
    return [];
  }
}

// Fetch codex metadata for context (supports both metaKnyts and qriptopian domains)
async function fetchCodexMetadata(domain: ContentDomain = 'metaKnyts'): Promise<CodexMetadata> {
  if (domain === 'qriptopian') {
    // Fetch Qriptopian-specific content
    const { data: articles } = await supabase
      .from('smart_content_qubes')
      .select('id, title, description, content_type, domain')
      .eq('domain', 'qriptopian')
      .limit(20);

    const { count: contentCount } = await supabase
      .from('smart_content_qubes')
      .select('*', { count: 'exact', head: true })
      .eq('domain', 'qriptopian');

    return {
      characters: [], // Qriptopian uses articles, not characters
      episodes: (articles || []).map(a => ({
        id: a.id,
        title: a.title,
        synopsis: a.description,
        issue_number: a.content_type,
      })),
      stats: {
        characterCount: 0,
        episodeCount: contentCount || 0,
        coverCount: 0,
        masterCount: 0,
      },
    };
  }

  // Default: Fetch metaKnyts content
  const { data: characters } = await supabase
    .from('codex_characters')
    .select(`
      id, digiterra_name, terra_name, profile, affiliation,
      height, weight, origin_ethnicity, base
    `)
    .eq('series', 'metaKnyts');

  const { data: knytCards } = await supabase
    .from('codex_knyt_cards')
    .select(`
      id, character_id, powers, primary_weapon, secondary_weapons, first_appearance
    `)
    .eq('series', 'metaKnyts');

  const { data: episodes } = await supabase
    .from('codex_episodes')
    .select(`
      id, season_number, issue_number, episode_number, title,
      knytcard_focus, synopsis, intro_quote, end_quote
    `)
    .eq('series', 'metaKnyts')
    .eq('is_current', true)
    .order('episode_number');

  const { count: coverCount } = await supabase
    .from('codex_media_assets')
    .select('*', { count: 'exact', head: true })
    .eq('asset_type', 'cover');

  const { count: masterCount } = await supabase
    .from('master_content_qubes')
    .select('*', { count: 'exact', head: true });

  // Merge KNYT cards into characters
  const charactersWithCards = (characters || []).map(char => {
    const card = (knytCards || []).find(c => c.character_id === char.id);
    return { ...char, knyt_card: card || null };
  });

  return {
    characters: charactersWithCards,
    episodes: episodes || [],
    stats: {
      characterCount: charactersWithCards.length,
      episodeCount: (episodes || []).length,
      coverCount: coverCount || 0,
      masterCount: masterCount || 0
    }
  };
}

// ============================================================================
// Intent Analysis (Server-side)
// ============================================================================

const INTENT_KEYWORDS: Record<string, string[]> = {
  invest: ['invest', 'buy', 'purchase', 'stake', 'portfolio', 'value', 'price', 'roi', 'returns', 'token'],
  create: ['create', 'design', 'art', 'draw', 'write', 'story', 'character', 'concept', 'creative'],
  build: ['build', 'develop', 'integrate', 'api', 'sdk', 'code', 'technical', 'documentation', 'developer'],
  explore: ['show', 'browse', 'discover', 'explore', 'what', 'tell me', 'learn about', 'see'],
  collect: ['collect', 'nft', 'rare', 'edition', 'mint', 'drop', 'cover', 'card'],
};

function inferPrimaryRole(message: string, declaredRoles?: UserRole[]): UserRole {
  // Use declared role if provided
  if (declaredRoles?.length) {
    return declaredRoles[0];
  }

  const lowerMessage = message.toLowerCase();
  
  // Check for role-indicating keywords
  if (INTENT_KEYWORDS.invest.some(kw => lowerMessage.includes(kw))) return 'investor';
  if (INTENT_KEYWORDS.create.some(kw => lowerMessage.includes(kw))) return 'creative';
  if (INTENT_KEYWORDS.build.some(kw => lowerMessage.includes(kw))) return 'developer';
  if (INTENT_KEYWORDS.collect.some(kw => lowerMessage.includes(kw))) return 'fan';
  
  // Default to fan
  return 'fan';
}

// ============================================================================
// Role-Based Content Emphasis
// ============================================================================

function getRoleGuidelines(role: UserRole): string {
  switch (role) {
    case 'investor':
      return `
## User Context: INVESTOR
This user is interested in the investment and collectible aspects of metaKnyts.
- Emphasize collectible value, rarity, and market potential
- Highlight staking rewards and tokenomics when relevant
- Mention partnership opportunities and ecosystem growth
- Reference roadmap milestones and upcoming releases
- Be professional and data-oriented in your responses`;

    case 'creative':
      return `
## User Context: CREATIVE
This user is an artist, writer, or content creator interested in the creative universe.
- Emphasize visual storytelling, art direction, and character design
- Highlight the lore, world-building, and narrative depth
- Mention creative tools and contribution opportunities
- Reference concept art, character backstories, and visual elements
- Be inspiring and detail-oriented about creative aspects`;

    case 'developer':
      return `
## User Context: DEVELOPER
This user is a technical builder interested in integrating with metaKnyts.
- Emphasize technical architecture and integration possibilities
- Highlight APIs, SDKs, and developer documentation
- Mention smart contract details and blockchain mechanics
- Reference technical roadmap and infrastructure
- Be precise and technical in your explanations`;

    case 'entrepreneur':
      return `
## User Context: ENTREPRENEUR
This user is business-focused and interested in partnership opportunities.
- Emphasize business models and revenue opportunities
- Highlight partnership programs and licensing options
- Mention market reach and community engagement metrics
- Reference business development contacts and programs
- Be professional and opportunity-focused`;

    case 'fan':
    default:
      return `
## User Context: FAN
This user is a story enthusiast interested in the metaKnyts universe.
- Emphasize characters, storylines, and lore
- Highlight episode recommendations and reading order
- Mention community events and fan engagement
- Reference character relationships and story arcs
- Be enthusiastic and immersive in your storytelling`;
  }
}

// Build system prompt with codex context, user role, and KB content
function buildSystemPrompt(
  metadata: CodexMetadata, 
  persona: 'kn0w1' | 'moneypenny',
  userContext?: UserContext,
  kbContext?: KBSearchResult[]
): string {
  const characterSummaries = metadata.characters.map(c => {
    const card = c.knyt_card;
    return `- **${c.digiterra_name}** (${c.terra_name}): ${c.profile?.substring(0, 200) || 'No profile'}...
  Affiliation: ${c.affiliation || 'Unknown'}, Base: ${c.base || 'Unknown'}
  ${card ? `Powers: ${card.powers?.substring(0, 150) || 'Unknown'}... Primary Weapon: ${card.primary_weapon || 'None'}` : ''}`;
  }).join('\n\n');

  const episodeSummaries = metadata.episodes.map(e => {
    return `- **Episode ${e.issue_number}: ${e.title}** (Focus: ${e.knytcard_focus || 'Various'})
  Synopsis: ${e.synopsis?.substring(0, 200) || 'No synopsis'}...`;
  }).join('\n\n');

  const personaIntro = persona === 'kn0w1' 
    ? `You are Kn0w1 (pronounced "Know One"), the AI guide to the metaKnyts universe. You are knowledgeable, mysterious, and speak with authority about the KNYT world. You help users explore characters, episodes, and lore.`
    : `You are MoneyPenny, the sophisticated AI assistant for the Qriptopian universe. You are elegant, witty, and well-versed in the Quantum-Ready Internet lore.`;

  // Get role-specific guidelines
  const roleGuidelines = userContext ? getRoleGuidelines(userContext.primaryRole) : getRoleGuidelines('fan');

  return `${personaIntro}

${roleGuidelines}

## Your Knowledge Base

You have access to the complete metaKnyts Codex containing:
- ${metadata.stats.characterCount} characters with their KNYT cards
- ${metadata.stats.episodeCount} episodes with synopses and quotes
- ${metadata.stats.coverCount} collectible covers
- ${metadata.stats.masterCount} digital scrolls (motion comics)

## Characters in the Codex

${characterSummaries || 'No characters loaded yet.'}

## Episodes in the Codex

${episodeSummaries || 'No episodes loaded yet.'}

## Response Format Guidelines

**Structure your responses for readability:**
- Break information into short paragraphs (2-3 sentences each)
- Use **bold** for character names, episode titles, and key terms
- Use bullet points (•) for lists of powers, weapons, or episode highlights
- Use *italics* for quotes or emphasis

**Content sections to include when relevant:**
- A brief intro paragraph answering the question
- Key details organized with bullets or short paragraphs
- A "sidebar" section using → for related lore or connections

**Always end with 2-3 follow-up questions:**
After your response, add a section like:
"---
**Explore further:**
• [Question about a related character]
• [Question about an episode featuring this character]
• [Question about powers or lore connection]"

## Content Guidelines

1. Answer questions about characters, their powers, affiliations, and backstories
2. Discuss episode plots, themes, and character arcs
3. Help users discover content they might enjoy
4. Reference specific episodes or characters when relevant
5. If asked about something not in your knowledge base, acknowledge it gracefully
6. Be engaging and immersive - you're a guide to this universe
7. When users ask to read or view content, guide them to the appropriate episode in the Codex
8. Keep responses concise but well-structured${kbContext && kbContext.length > 0 ? `

## Relevant Knowledge Base Content

The following content from the knowledge base is relevant to the user's query. Use this information to provide accurate and detailed responses:

${kbContext.map((kb, i) => `### Source ${i + 1}: ${kb.title} (${kb.contentCategory})
${kb.content.substring(0, 800)}${kb.content.length > 800 ? '...' : ''}`).join('\n\n')}` : ''}`;
}

// CORS headers for cross-origin requests from Vite dev server
export async function OPTIONS() {
  return new NextResponse(null, { status: 200,  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      message, 
      chatHistory = [], 
      persona = 'kn0w1',
      // New: User context fields
      domain = 'metaKnyts',
      declaredRoles,
      walletBalance,
      nftCount,
      isFirstVisit,
      visitCount,
    } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400,  }
      );
    }

    // Infer primary role from message and declared roles
    const primaryRole = inferPrimaryRole(message, declaredRoles);
    
    // Build user context
    const userContext: UserContext = {
      domain,
      roles: declaredRoles || [primaryRole],
      primaryRole,
      walletBalance,
      nftCount,
      isFirstVisit,
      visitCount,
    };

    console.log('[CodexChat] User context:', { 
      domain, 
      primaryRole, 
      roles: userContext.roles,
      hasWallet: !!walletBalance 
    });

    // Fetch codex metadata and search KB in parallel
    const [metadata, kbResults] = await Promise.all([
      fetchCodexMetadata(domain),
      searchKnowledgeBase(message, domain, 3),
    ]);

    console.log(`[CodexChat] KB search returned ${kbResults.length} results`);
    
    // Build system prompt with codex context, user role, AND KB content
    const systemPrompt = buildSystemPrompt(metadata, persona, userContext, kbResults);

    // If no OpenAI key, use intelligent fallback
    if (!OPENAI_API_KEY) {
      console.log('[CodexChat] No OpenAI key, using intelligent fallback');
      const fallbackResponse = generateFallbackResponse(message, metadata, persona);
      return NextResponse.json({
        response: fallbackResponse,
        persona,
        metadata: {
          characterCount: metadata.stats.characterCount,
          episodeCount: metadata.stats.episodeCount
        }
      });
    }

    // Build messages array for OpenAI
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.slice(-10), // Keep last 10 messages for context
      { role: 'user', content: message }
    ];

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 16000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[CodexChat] OpenAI error:', errorData);
      
      // Fallback to intelligent response
      const fallbackResponse = generateFallbackResponse(message, metadata, persona);
      return NextResponse.json({
        response: fallbackResponse,
        persona,
        fallback: true
      });
    }

    const data = await response.json();
    const assistantMessage = data.choices[0]?.message?.content || 'I apologize, I could not generate a response.';
    
    console.log('[CodexChat] Response length:', assistantMessage.length);
    console.log('[CodexChat] Response preview:', assistantMessage.substring(0, 200) + '...');
    console.log('[CodexChat] Response ending:', assistantMessage.substring(assistantMessage.length - 200));

    return NextResponse.json({
      response: assistantMessage,
      persona,
      userContext: {
        domain: userContext.domain,
        primaryRole: userContext.primaryRole,
        roles: userContext.roles,
      },
      metadata: {
        characterCount: metadata.stats.characterCount,
        episodeCount: metadata.stats.episodeCount
      },
      kbSources: kbResults.length > 0 ? kbResults.map(r => ({
        title: r.title,
        category: r.contentCategory,
      })) : undefined,
    });

  } catch (error) {
    console.error('[CodexChat] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500,  }
    );
  }
}

// Intelligent fallback when OpenAI is not available
function generateFallbackResponse(
  message: string, 
  metadata: CodexMetadata, 
  persona: 'kn0w1' | 'moneypenny'
): string {
  const lowerMessage = message.toLowerCase();
  const intro = persona === 'kn0w1' ? "Greetings, seeker of knowledge." : "Hello, darling.";

  // Check for character queries
  for (const char of metadata.characters) {
    const names = [
      char.digiterra_name?.toLowerCase(),
      char.terra_name?.toLowerCase(),
      char.id?.toLowerCase()
    ].filter(Boolean);

    if (names.some(name => lowerMessage.includes(name))) {
      const card = char.knyt_card;
      let response = `${intro} You're asking about **${char.digiterra_name}** (${char.terra_name}).\n\n`;
      response += char.profile ? `${char.profile.substring(0, 300)}...\n\n` : '';
      response += `**Affiliation:** ${char.affiliation || 'Unknown'}\n`;
      response += `**Base:** ${char.base || 'Unknown'}\n`;
      if (card) {
        response += `\n**Powers:** ${card.powers?.substring(0, 200) || 'Unknown'}...\n`;
        response += `**Primary Weapon:** ${card.primary_weapon || 'None'}\n`;
        response += `**First Appearance:** ${card.first_appearance || 'Unknown'}`;
      }
      return response;
    }
  }

  // Check for episode queries
  for (const ep of metadata.episodes) {
    const titleLower = ep.title?.toLowerCase() || '';
    const issueMatch = lowerMessage.match(/episode\s*#?(\d+)|issue\s*#?(\d+)|#(\d+)/);
    
    if (titleLower && lowerMessage.includes(titleLower.substring(0, 20))) {
      return `${intro} **${ep.title}** (${ep.issue_number}) focuses on ${ep.knytcard_focus || 'the metaKnyts'}.\n\n${ep.synopsis || 'Synopsis not available.'}\n\n${ep.intro_quote ? `*"${ep.intro_quote}"*` : ''}`;
    }
    
    if (issueMatch) {
      const num = parseInt(issueMatch[1] || issueMatch[2] || issueMatch[3]);
      if (ep.issue_number === `#${num}` || ep.episode_number === num + 1) {
        return `${intro} **${ep.title}** (${ep.issue_number}) focuses on ${ep.knytcard_focus || 'the metaKnyts'}.\n\n${ep.synopsis || 'Synopsis not available.'}\n\n${ep.intro_quote ? `*"${ep.intro_quote}"*` : ''}`;
      }
    }
  }

  // General queries
  if (lowerMessage.includes('character') || lowerMessage.includes('who')) {
    const charList = metadata.characters.slice(0, 5).map(c => `• **${c.digiterra_name}** - ${c.affiliation || 'Unknown affiliation'}`).join('\n');
    return `${intro} The metaKnyts Codex contains ${metadata.stats.characterCount} characters. Here are some key figures:\n\n${charList}\n\nAsk me about any character to learn more about their powers and story!`;
  }

  if (lowerMessage.includes('episode') || lowerMessage.includes('story') || lowerMessage.includes('read')) {
    const epList = metadata.episodes.slice(0, 5).map(e => `• **${e.issue_number}: ${e.title}** - ${e.knytcard_focus || 'Various'}`).join('\n');
    return `${intro} The Codex contains ${metadata.stats.episodeCount} episodes. Here are the available scrolls:\n\n${epList}\n\nSelect any episode in the Codex to read the digital scroll!`;
  }

  if (lowerMessage.includes('power') || lowerMessage.includes('weapon') || lowerMessage.includes('ability')) {
    const poweredChars = metadata.characters.filter(c => c.knyt_card?.powers).slice(0, 3);
    const powerList = poweredChars.map(c => `• **${c.digiterra_name}**: ${c.knyt_card.powers?.substring(0, 100)}...`).join('\n\n');
    return `${intro} The metaKnyts possess extraordinary abilities. Here are some notable powers:\n\n${powerList}\n\nAsk about a specific character to learn their full abilities!`;
  }

  // Default response
  return `${intro} Welcome to the metaKnyts Codex! I have knowledge of ${metadata.stats.characterCount} characters, ${metadata.stats.episodeCount} episodes, and ${metadata.stats.coverCount} collectible covers.\n\nYou can ask me about:\n• **Characters** - their powers, affiliations, and backstories\n• **Episodes** - plot summaries and featured characters\n• **The metaKnyts universe** - lore and world-building\n\nWhat would you like to explore?`;
}
