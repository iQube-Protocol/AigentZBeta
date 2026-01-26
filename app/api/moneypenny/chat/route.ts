/**
 * MoneyPenny Chat API Route
 * 
 * Handles chat interactions with MoneyPenny AI assistant
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { messages, agent_class, tenant_id } = await request.json();

    // Mock AI response for now - in production this would connect to actual AI service
    const mockResponses = [
      "Based on your current portfolio, I see you have strong performance on Arbitrum with a 68% win rate. Consider diversifying to Base where spreads are currently favorable.",
      "Your recent trading activity shows good risk management. Your average position size of $365 is appropriate for your portfolio size.",
      "I've identified an arbitrage opportunity between Ethereum and Polygon: Q¢ is trading at a 12 bps discount on Polygon. Consider a cross-chain transfer.",
      "Your current strategy is performing well, but you might want to reduce your max slippage from 5 bps to 3 bps to improve execution quality.",
      "Market conditions are favorable for HFT strategies right now. Volatility is low and liquidity is strong across all chains.",
    ];

    // Generate contextual response based on the last user message
    const lastMessage = messages[messages.length - 1];
    let response = mockResponses[Math.floor(Math.random() * mockResponses.length)];

    // Add some context based on message content
    const messageText = lastMessage?.content?.toLowerCase() || '';
    if (messageText.includes('portfolio') || messageText.includes('performance')) {
      response = "Your portfolio is showing strong performance with a total P&L of $2,500 (2.04% return). Your win rate of 68.5% is above average, and your best performing chain is Arbitrum with 45% of your total P&L.";
    } else if (messageText.includes('quotes') || messageText.includes('opportunity')) {
      response = "Current best opportunities: ETH→ARB spread of 18 bps, POLYGON→BASE spread of 12 bps. Liquidity is strong on all chains with minimal slippage risk for positions under $10,000.";
    } else if (messageText.includes('risk') || messageText.includes('exposure')) {
      response = "Your risk profile is conservative with good diversification across 5 chains. Largest exposure is Ethereum at 35% of portfolio. Consider reducing concentration if market volatility increases.";
    } else if (messageText.includes('strategy') || messageText.includes('optimize')) {
      response = "Your 'Arbitrage Hunter' strategy is performing well with 15 bps minimum edge. Consider adding a 'Liquidity Provider' strategy for Polygon where yields are currently 8.5% APR.";
    }

    return NextResponse.json({
      response,
      agent_class,
      tenant_id,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('MoneyPenny chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}
