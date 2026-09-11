import { NextRequest, NextResponse } from "next/server";
import type OpenAI from "openai"; // type-only — tool-definition typing; no runtime client
import { callSovereignToolChat, type SovereignToolMessage } from "@/services/constitutional/sovereignToolChat";

export const dynamic = "force-dynamic";

/**
 * AA-API Copilot Endpoint
 * 
 * This endpoint exposes the server-side CopilotKit to thin clients via AA-API.
 * Thin clients can call this endpoint without needing their own CopilotKit setup.
 * 
 * POST /api/aa/copilot
 * 
 * Request body:
 * {
 *   tenantId: string;           // Required: tenant context
 *   personaId?: string;         // Optional: persona context
 *   prompt: string;             // The natural language prompt
 *   intent?: {                  // Optional: structured intent
 *     action: string;
 *     params: Record<string, any>;
 *   };
 *   context?: Record<string, any>; // Optional: additional context
 *   simulate?: boolean;         // Optional: dry-run mode
 * }
 * 
 * Response:
 * {
 *   success: boolean;
 *   responseText: string;
 *   structuredResult?: any;
 *   toolCalls?: string[];
 *   error?: string;
 * }
 */

const COPILOT_SYSTEM_PROMPT = `You are the Platform Copilot for Aigent Z, responding to a thin client request via AA-API.

You have access to tools for:
- Registry operations (tenants, iQubes, Aigents)
- Wallet operations (create, send QCT/QOYN, balances)
- Identity operations (Personas, KybeDID, Root DID, proxies)
- Smart Menu operations (create, configure, publish)
- Orchestrated workflows (deploy wallet, provision identity, configure menu)

Always:
1. Respect the tenant context provided
2. Use Persona as the default identity layer
3. Return structured, actionable results
4. Indicate if operations were simulated

Respond concisely with the result of the requested operation.`;

// Tool definitions for the AA-API copilot
const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "list_tenants",
      description: "List all tenants in the platform",
      parameters: {
        type: "object",
        properties: {
          activeOnly: { type: "boolean", description: "Only return active tenants" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_wallet_balances",
      description: "Get wallet balances for a tenant",
      parameters: {
        type: "object",
        properties: {
          tenantId: { type: "string", description: "Tenant ID" },
          chain: { type: "string", description: "Optional chain filter" },
        },
        required: ["tenantId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_qct",
      description: "Send QCT payment",
      parameters: {
        type: "object",
        properties: {
          fromWalletId: { type: "string" },
          toAddress: { type: "string" },
          amount: { type: "string" },
          chain: { type: "string" },
          simulate: { type: "boolean" },
        },
        required: ["fromWalletId", "toAddress", "amount", "chain"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_persona",
      description: "Create a new Persona",
      parameters: {
        type: "object",
        properties: {
          tenantId: { type: "string" },
          name: { type: "string" },
          type: { type: "string", enum: ["pseudonymous", "semi-anonymous", "branded"] },
          fioHandle: { type: "string" },
        },
        required: ["tenantId", "name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deploy_agentic_wallet",
      description: "Deploy an Agentic Wallet (full workflow)",
      parameters: {
        type: "object",
        properties: {
          tenantId: { type: "string" },
          personaId: { type: "string" },
          chains: { type: "string", description: "Comma-separated chains" },
          simulate: { type: "boolean" },
        },
        required: ["tenantId", "personaId", "chains"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "provision_identity",
      description: "Provision full identity stack (KybeDID, Root DID, Persona)",
      parameters: {
        type: "object",
        properties: {
          tenantId: { type: "string" },
          personaName: { type: "string" },
          fioHandle: { type: "string" },
          walletId: { type: "string" },
          simulate: { type: "boolean" },
        },
        required: ["tenantId", "personaName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "configure_smart_menu",
      description: "Configure a Smart Menu with payment options",
      parameters: {
        type: "object",
        properties: {
          tenantId: { type: "string" },
          menuName: { type: "string" },
          context: { type: "string", enum: ["storefront", "checkout", "subscription", "donation"] },
          enableQCT: { type: "boolean" },
          enableQOYN: { type: "boolean" },
          autoPublish: { type: "boolean" },
        },
        required: ["tenantId", "menuName", "context"],
      },
    },
  },
];

// Mock tool execution (connects to actual actions in production)
async function executeTool(name: string, args: any): Promise<any> {
  const timestamp = Date.now();
  
  switch (name) {
    case "list_tenants":
      return {
        tenants: [
          { id: "tenant_1", name: "Kn0w1", slug: "kn0w1", active: true },
          { id: "tenant_2", name: "KNYT Books", slug: "knyt-books", active: true },
        ],
      };
    
    case "get_wallet_balances":
      return {
        tenantId: args.tenantId,
        balances: [
          { chain: "polygon", token: "QCT", amount: "5000.00", usdValue: 5.00 },
          { chain: "bitcoin", token: "QOYN", amount: "1000.00", usdValue: 10.00 },
        ],
      };
    
    case "send_qct":
      return {
        success: true,
        simulated: args.simulate || false,
        txId: `tx_${timestamp}`,
        amount: args.amount,
        token: "QCT",
        chain: args.chain,
        to: args.toAddress,
      };
    
    case "create_persona":
      return {
        success: true,
        personaId: `persona_${timestamp}`,
        name: args.name,
        fioHandle: args.fioHandle || `${args.name.toLowerCase()}@aigent`,
      };
    
    case "deploy_agentic_wallet":
      return {
        success: true,
        simulated: args.simulate || false,
        walletId: `wallet_${timestamp}`,
        chains: args.chains.split(","),
        linkedToPersona: args.personaId,
      };
    
    case "provision_identity":
      return {
        success: true,
        simulated: args.simulate || false,
        kybeDidId: `kybe:did:aigent:${timestamp}`,
        rootDidId: `root:did:aigent:${timestamp}`,
        personaId: `persona_${timestamp}`,
        personaName: args.personaName,
      };
    
    case "configure_smart_menu":
      return {
        success: true,
        menuId: `menu_${timestamp}`,
        menuName: args.menuName,
        context: args.context,
        published: args.autoPublish !== false,
        paymentOptions: [
          args.enableQCT !== false ? "QCT" : null,
          args.enableQOYN !== false ? "QOYN" : null,
        ].filter(Boolean),
      };
    
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantId, personaId, prompt, intent, context, simulate } = body;

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "tenantId is required" },
        { status: 400 }
      );
    }

    if (!prompt && !intent) {
      return NextResponse.json(
        { success: false, error: "Either prompt or intent is required" },
        { status: 400 }
      );
    }

    // Build the user message
    let userMessage = "";
    if (intent) {
      userMessage = `Execute action: ${intent.action} with params: ${JSON.stringify(intent.params)}`;
    } else {
      userMessage = prompt;
    }

    // Add context
    const contextInfo = `
Tenant: ${tenantId}
${personaId ? `Persona: ${personaId}` : ""}
${simulate ? "Mode: SIMULATION (dry-run)" : "Mode: LIVE"}
${context ? `Additional context: ${JSON.stringify(context)}` : ""}
`;

    const messages: SovereignToolMessage[] = [
      { role: "system", content: COPILOT_SYSTEM_PROMPT },
      { role: "user", content: `${contextInfo}\n\nRequest: ${userMessage}` },
    ];

    // Invariant-aware, SOVEREIGN tool-calling (CFS-015 Phase 2). Was a single
    // gpt-4o call with no fallback; now routes through the sovereign tool ladder
    // (openai → open-weight venice floor) so the agent survives a frontier
    // outage. The caller still owns tool EXECUTION below.
    const response = await callSovereignToolChat({
      messages,
      tools: TOOLS,
      toolChoice: "auto",
    });

    const assistantMessage = response.message;
    const toolCalls: string[] = [];
    let structuredResult: any = null;

    // Execute any tool calls
    if (assistantMessage.tool_calls) {
      const toolResults: any[] = [];
      
      for (const toolCall of assistantMessage.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        if (simulate) args.simulate = true;
        
        const result = await executeTool(toolCall.function.name, args);
        toolCalls.push(toolCall.function.name);
        toolResults.push(result);
      }

      structuredResult = toolResults.length === 1 ? toolResults[0] : toolResults;

      // Get final response with tool results
      messages.push(assistantMessage);
      messages.push({
        role: "tool",
        tool_call_id: assistantMessage.tool_calls[0].id,
        content: JSON.stringify(structuredResult),
      });

      const finalResponse = await callSovereignToolChat({ messages });

      return NextResponse.json({
        success: true,
        responseText: finalResponse.message.content,
        structuredResult,
        toolCalls,
        tenantId,
        personaId,
        simulated: simulate || false,
      });
    }

    // No tool calls, just return the response
    return NextResponse.json({
      success: true,
      responseText: assistantMessage.content,
      toolCalls: [],
      tenantId,
      personaId,
    });

  } catch (error: any) {
    console.error("AA-API Copilot error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    service: "AA-API Copilot",
    status: "healthy",
    version: "1.0.0",
    endpoints: {
      execute: "POST /api/aa/copilot",
    },
    capabilities: [
      "list_tenants",
      "get_wallet_balances",
      "send_qct",
      "create_persona",
      "deploy_agentic_wallet",
      "provision_identity",
      "configure_smart_menu",
    ],
  });
}
