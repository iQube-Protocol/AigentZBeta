/**
 * Copilot Chat API
 * 
 * Handles chat requests for Codex Copilot with knowledge base integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { callSovereign } from '@/services/constitutional/modelRouter';

export const runtime = 'nodejs';

// System prompt for Codex Copilot
const CODEX_COPILOT_SYSTEM_PROMPT = `You are the Codex Copilot, an expert guide to the metaKnyts universe and Codex content.

Your role is to help users:
- Explore and understand Codex episodes, characters, and lore
- Learn about the metaKnyts universe and its story
- Navigate the Codex interface and features
- Understand content ownership and digital collectibles
- Get recommendations for content based on interests

Key knowledge areas:
- metaKnyts episodes (motion comics, print editions)
- Characters and their roles in the story
- Lore and world-building elements
- Digital collectibles (rare, epic, legendary editions)
- Content access and ownership
- KNYT token utility and economics

Guidelines:
- Be friendly, knowledgeable, and engaging
- Provide detailed but concise answers
- Reference specific episodes, characters, or lore when relevant
- Help users discover new content they might enjoy
- Explain technical concepts in simple terms
- Always respect user privacy and data

Context provided:
- User's current mode (KNYT or Qriptopian)
- Codex knowledge base content
- User's wallet balance and NFT count
- User's agent and persona information

Adapt your responses based on the context mode:
- KNYT mode: Focus on token economics, collectibles, and ownership
- Qriptopian mode: Focus on story, characters, and lore exploration`;

export async function POST(request: NextRequest) {
  try {
    const { message, context } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Build context information
    const contextInfo = context ? {
      mode: context.mode || 'knyt',
      walletBalance: context.walletBalance || 0,
      nftCount: context.nftCount || 0,
      agentName: context.agentName || 'User',
      metaAvatar: context.metaAvatar || 'Anonymous',
      codexKnowledge: context.codexKnowledge || '',
    } : {};

    // The two system layers (copilot role + live context), merged into one
    // system prompt for the sovereign inference entry point.
    const systemPrompt = `${CODEX_COPILOT_SYSTEM_PROMPT}

Current Context:
- Mode: ${contextInfo.mode}
- Wallet Balance: ${contextInfo.walletBalance} Q¢
- NFT Collection: ${contextInfo.nftCount} items
- User: ${contextInfo.agentName} (${contextInfo.metaAvatar})
- Available Knowledge: ${contextInfo.codexKnowledge ? 'Codex content database available' : 'No specific knowledge loaded'}

Use this context to provide personalized assistance.`;

    // Invariant-aware, SOVEREIGN inference (CFS-015 Phase 2). This copilot used a
    // single, deprecated gpt-4-turbo-preview call with NO fallback. callSovereign
    // routes the 'reasoning' purpose through the ModelQube policy (invariant-
    // cited) and the sovereign fallback ladder — so it survives a provider
    // outage instead of 500ing — at the conversational temperature (0.7)
    // preserved from the original call.
    const sovereign = await callSovereign('reasoning', systemPrompt, message, 1000, 0.7);
    const response = sovereign.text;

    if (!response) {
      throw new Error('No response from the sovereign inference router');
    }

    return NextResponse.json({
      response,
      context: {
        mode: contextInfo.mode,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Copilot chat error:', error);

    // Fallback response for API errors
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json({
          response: 'I\'m having trouble connecting to my knowledge base. Please check back later or try exploring the Codex content directly.',
        });
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
