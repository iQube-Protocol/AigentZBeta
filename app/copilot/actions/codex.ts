/**
 * Codex CopilotKit Actions
 * 
 * Backend actions for Codex Knowledge Base, Auto-Drive content, and framework integrations.
 * Supports metaKnyts and Qriptopian content universes with semantic search and RAG.
 */

import { Action } from "@copilotkit/shared";
import { getKnowledgeBaseService } from "@/services/content/knowledgeBaseService";
import { getEmbeddingService } from "@/services/content/embeddingService";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ContentDomain = 'metaKnyts' | 'qriptopian';

/**
 * Search Codex Knowledge Base
 * Semantic search across KB chunks with Auto-Drive CID support
 */
const codex_search_kb: Action<any> = {
  name: "codex_search_kb",
  description: "Search the Codex Knowledge Base for relevant content about metaKnyts or Qriptopian universes. Returns semantically relevant chunks with Auto-Drive CIDs for streaming.",
  parameters: [
    {
      name: "query",
      type: "string",
      description: "Natural language search query",
      required: true,
    },
    {
      name: "domain",
      type: "string",
      description: "Content domain: 'metaKnyts' or 'qriptopian'",
      required: true,
    },
    {
      name: "limit",
      type: "number",
      description: "Maximum number of results (default: 5)",
      required: false,
    },
  ],
  handler: async ({ query, domain, limit = 5 }) => {
    try {
      const embeddingService = getEmbeddingService();
      const results = await embeddingService.hybridSearch(query, domain as ContentDomain, limit);
      
      return {
        success: true,
        results: results.map(r => ({
          content: r.content,
          title: r.metadata.title,
          category: r.metadata.contentCategory,
          similarity: r.similarity,
          documentId: r.documentId,
        })),
        count: results.length,
      };
    } catch (error) {
      console.error('[Codex Action] KB search error:', error);
      return { success: false, error: String(error) };
    }
  },
};

/**
 * Get Content by CID
 * Retrieve content metadata and streaming URLs for Auto-Drive CIDs
 */
const codex_get_content: Action<any> = {
  name: "codex_get_content",
  description: "Get content metadata and streaming URLs for Autonomys Auto-Drive CIDs. Supports PDFs, videos, and cover images.",
  parameters: [
    {
      name: "cid",
      type: "string",
      description: "Autonomys Auto-Drive Content Identifier (CID)",
      required: true,
    },
    {
      name: "contentType",
      type: "string",
      description: "Content type: 'pdf', 'video', or 'cover'",
      required: true,
    },
  ],
  handler: async ({ cid, contentType }) => {
    try {
      const { data: asset } = await supabase
        .from('codex_media_assets')
        .select('*')
        .eq('auto_drive_cid', cid)
        .single();

      if (!asset) {
        return { success: false, error: 'Content not found' };
      }

      const streamingUrl = `/api/content/${contentType}/${cid}`;
      
      return {
        success: true,
        content: {
          cid,
          type: contentType,
          streamingUrl,
          metadata: asset,
        },
      };
    } catch (error) {
      console.error('[Codex Action] Get content error:', error);
      return { success: false, error: String(error) };
    }
  },
};

/**
 * Answer Question with RAG
 * Use Retrieval-Augmented Generation to answer complex questions about Codex content
 */
const codex_answer_question: Action<any> = {
  name: "codex_answer_question",
  description: "Answer complex questions about metaKnyts or Qriptopian content using RAG (Retrieval-Augmented Generation). Searches KB and synthesizes answer.",
  parameters: [
    {
      name: "question",
      type: "string",
      description: "User's question about Codex content",
      required: true,
    },
    {
      name: "domain",
      type: "string",
      description: "Content domain: 'metaKnyts' or 'qriptopian'",
      required: true,
    },
  ],
  handler: async ({ question, domain }) => {
    try {
      const kbService = getKnowledgeBaseService();
      const relevantChunks = await kbService.getRelevantChunks(question, domain as ContentDomain, 5);
      
      if (relevantChunks.length === 0) {
        return {
          success: true,
          answer: "I don't have enough information in the Knowledge Base to answer that question.",
          sources: [],
        };
      }

      // Build context from chunks
      const context = relevantChunks
        .map(chunk => `[${chunk.metadata.title}]: ${chunk.content}`)
        .join('\n\n');

      return {
        success: true,
        context,
        sources: relevantChunks.map(c => ({
          title: c.metadata.title,
          category: c.metadata.contentCategory,
          similarity: c.similarity,
        })),
        chunkCount: relevantChunks.length,
      };
    } catch (error) {
      console.error('[Codex Action] Answer question error:', error);
      return { success: false, error: String(error) };
    }
  },
};

/**
 * Get Character Episodes
 * Correlate characters with episodes they appear in
 */
const codex_get_character_episodes: Action<any> = {
  name: "codex_get_character_episodes",
  description: "Get episodes featuring a specific character. Uses KB relationships and metadata correlation.",
  parameters: [
    {
      name: "characterName",
      type: "string",
      description: "Character name (e.g., 'Kn0w1', 'MoneyPenny')",
      required: true,
    },
    {
      name: "domain",
      type: "string",
      description: "Content domain: 'metaKnyts' or 'qriptopian'",
      required: true,
    },
  ],
  handler: async ({ characterName, domain }) => {
    try {
      // Search KB for character mentions in episodes
      const embeddingService = getEmbeddingService();
      const query = `${characterName} episodes appearances`;
      const results = await embeddingService.hybridSearch(query, domain as ContentDomain, 10);
      
      // Filter for episode content
      const episodeChunks = results.filter(r => 
        r.metadata.contentCategory === 'episode' || 
        r.content.toLowerCase().includes('episode')
      );

      return {
        success: true,
        character: characterName,
        episodes: episodeChunks.map(chunk => ({
          title: chunk.metadata.title,
          excerpt: chunk.content.substring(0, 200),
          similarity: chunk.similarity,
        })),
        count: episodeChunks.length,
      };
    } catch (error) {
      console.error('[Codex Action] Get character episodes error:', error);
      return { success: false, error: String(error) };
    }
  },
};

/**
 * Track Task Completion
 * Record user task completion for rewards framework
 */
const codex_track_task: Action<any> = {
  name: "codex_track_task",
  description: "Track user task completion for the Codex rewards framework. Awards KNYT tokens for completed tasks.",
  parameters: [
    {
      name: "personaId",
      type: "string",
      description: "User's persona ID",
      required: true,
    },
    {
      name: "taskType",
      type: "string",
      description: "Task type: 'read_episode', 'watch_video', 'explore_character', 'share_content'",
      required: true,
    },
    {
      name: "taskData",
      type: "object",
      description: "Additional task data (e.g., episode ID, character name)",
      required: false,
    },
  ],
  handler: async ({ personaId, taskType, taskData = {} }) => {
    try {
      // Task completion logic would go here
      // For now, return success with placeholder reward
      const rewardAmount = taskType === 'read_episode' ? 0.5 : 0.25;
      
      return {
        success: true,
        task: {
          type: taskType,
          personaId,
          data: taskData,
          reward: rewardAmount,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('[Codex Action] Track task error:', error);
      return { success: false, error: String(error) };
    }
  },
};

/**
 * Get Rewards Balance
 * Retrieve user's KNYT rewards balance and history
 */
const codex_get_rewards: Action<any> = {
  name: "codex_get_rewards",
  description: "Get user's KNYT rewards balance and recent reward history from Codex activities.",
  parameters: [
    {
      name: "personaId",
      type: "string",
      description: "User's persona ID",
      required: true,
    },
  ],
  handler: async ({ personaId }) => {
    try {
      // Rewards query would go here
      // For now, return placeholder data
      return {
        success: true,
        rewards: {
          personaId,
          totalKnyt: 10.5,
          pendingKnyt: 2.0,
          recentTasks: [
            { type: 'read_episode', reward: 0.5, timestamp: new Date().toISOString() },
          ],
        },
      };
    } catch (error) {
      console.error('[Codex Action] Get rewards error:', error);
      return { success: false, error: String(error) };
    }
  },
};

/**
 * Check Ascension Progress
 * Get user's ascension level and progress in the Codex framework
 */
const codex_check_ascension: Action<any> = {
  name: "codex_check_ascension",
  description: "Check user's ascension level and progress in the Codex framework. Tracks engagement and unlocked content.",
  parameters: [
    {
      name: "personaId",
      type: "string",
      description: "User's persona ID",
      required: true,
    },
  ],
  handler: async ({ personaId }) => {
    try {
      // Ascension query would go here
      // For now, return placeholder data
      return {
        success: true,
        ascension: {
          personaId,
          level: 1,
          tier: 'Initiate',
          progress: 35,
          nextTier: 'Adept',
          unlockedContent: ['episodes_1_5', 'character_profiles'],
        },
      };
    } catch (error) {
      console.error('[Codex Action] Check ascension error:', error);
      return { success: false, error: String(error) };
    }
  },
};

export const codexActions = [
  codex_search_kb,
  codex_get_content,
  codex_answer_question,
  codex_get_character_episodes,
  codex_track_task,
  codex_get_rewards,
  codex_check_ascension,
];
