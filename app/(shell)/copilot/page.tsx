"use client";

import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

/**
 * Platform Copilot Page
 * 
 * Provides AI-powered assistance for platform operations:
 * - Tenant management
 * - iQube registry inspection
 * - Agentic Wallet status and balances
 * - Identity (KybeDID, Root DID, Personas, Cohorts)
 * - Smart Menu configuration (future)
 * - AA-API orchestration (future)
 */
export default function CopilotPage() {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Platform Copilot
        </h1>
        <p className="text-slate-400 mt-2">
          AI-powered orchestration for Aigent Z operations. Ask about tenants, wallets, identity, iQubes, and more.
        </p>
      </div>

      {/* Copilot Chat Interface */}
      <div className="flex-1 bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
        <CopilotChat
          instructions="You are the Platform Copilot for Aigent Z. Help with tenant management, wallet operations, identity provisioning, and iQube registry management. Always respect tenant boundaries and identity privacy layers."
          labels={{
            title: "Platform Copilot",
            initial: "How can I help you orchestrate the Aigent Z platform today?",
            placeholder: "Ask about tenants, wallets, identity, iQubes...",
          }}
          className="h-full"
        />
      </div>

      {/* Quick Actions */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700">
          <h3 className="font-semibold text-blue-400 mb-2">📋 Registry</h3>
          <p className="text-sm text-slate-400">
            "List all tenants"<br />
            "Show iQubes for Kn0w1"<br />
            "What Aigents does KNYT Books have?"
          </p>
        </div>
        <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700">
          <h3 className="font-semibold text-purple-400 mb-2">💰 Wallets</h3>
          <p className="text-sm text-slate-400">
            "Get wallet status for tenant_1"<br />
            "Show balances for Kn0w1"<br />
            "List recent transactions"
          </p>
        </div>
        <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700">
          <h3 className="font-semibold text-green-400 mb-2">🆔 Identity</h3>
          <p className="text-sm text-slate-400">
            "Show identity summary for tenant_1"<br />
            "List Personas for Kn0w1"<br />
            "Get cohort info for cohort_large_trusted"
          </p>
        </div>
      </div>

      {/* Phase Info */}
      <div className="mt-6 bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">ℹ️</div>
          <div>
            <h4 className="font-semibold text-blue-400">Phase 0: Read-Only Operations</h4>
            <p className="text-sm text-slate-400 mt-1">
              Currently, the Platform Copilot can inspect and query platform state. 
              Write operations (wallet creation, identity provisioning, etc.) will be available in Phase 1+.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
