"use client";

import React from "react";
import { Scale, Shield, Users, Cpu, Heart } from "lucide-react";

const PRINCIPLES = [
  { id: "sovereignty_first", statement: "Sovereignty precedes fulfillment." },
  { id: "representation", statement: "No single agent may represent all interests." },
  { id: "bounded_delegation", statement: "Delegated authority must remain bounded, auditable, and revocable." },
  { id: "constitutional_guardrails", statement: "Execution, composition, and governance operate within constitutional constraints." },
  { id: "dual_representation", statement: "Platform interests and collective interests must remain explicitly represented." },
  { id: "individual_sovereignty", statement: "The individual remains the ultimate beneficiary of the system." },
  { id: "fulfillment", statement: "Intent without fulfillment is unrealized potential. Fulfillment without sovereignty is extraction." },
];

const HIERARCHY = [
  {
    id: "metame_guardian",
    brand: "myGuard",
    role: "Sovereignty Layer",
    purpose: "Protect sovereignty and enforce constitutional constraints.",
    question: "Is this action compatible with sovereignty?",
    icon: Shield,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/20",
  },
  {
    id: "aigentMe",
    brand: "aigentMe",
    role: "Individual Agency",
    purpose: "Represent the interests of the individual.",
    question: "What is best for this individual?",
    icon: Heart,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10 border-purple-500/20",
  },
  {
    id: "aigentC",
    brand: "aigentC",
    role: "Collective Agency",
    purpose: "Represent collective interests.",
    question: "What is best for the collective?",
    icon: Users,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/20",
  },
  {
    id: "aigentZ",
    brand: "aigentZ",
    role: "Platform Agency",
    purpose: "Represent platform interests and sovereign fulfillment.",
    question: "What is best for the ecosystem?",
    icon: Cpu,
    color: "text-green-400",
    bgColor: "bg-green-500/10 border-green-500/20",
  },
];

const DOMAINS = [
  { name: "aigentMe (metaMe)", domain: "Intent", items: ["Experience sovereignty", "Personal agency", "Venture coordination", "Intent discovery"] },
  { name: "Registry", domain: "Coordination", items: ["Provenance", "Attribution", "Governance", "Discovery", "Accountability"] },
  { name: "aigentZ (AgentiQ)", domain: "Fulfillment", items: ["Implementation", "Development", "Orchestration", "Platform operations"] },
];

export function GovernanceConstitutionTab() {
  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Scale className="w-8 h-8 text-amber-400" />
          <div>
            <h2 className="text-2xl font-bold text-white">AgentiQ Constitution of Aigents</h2>
            <p className="text-sm text-slate-400">Constitutional Framework for Sovereign Fulfillment, Representation, and Agent Governance</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">v1.0</span>
          <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/30">Ratified</span>
          <span className="text-xs text-slate-500">Operation Chrysalis</span>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
        <p className="text-sm text-slate-300 italic">
          &ldquo;Agency is a constitutional principle, not an executable runtime principal. Agency represents the preservation and balancing of individual, collective, and platform agency.&rdquo;
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Constitutional Principles</h3>
        <div className="space-y-2">
          {PRINCIPLES.map((p, i) => (
            <div key={p.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
              <span className="text-xs font-mono text-slate-500 mt-0.5 shrink-0 w-5 text-right">{i + 1}.</span>
              <p className="text-sm text-slate-200">{p.statement}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Constitutional Hierarchy</h3>
        <div className="space-y-3">
          {HIERARCHY.map((h) => {
            const Icon = h.icon;
            return (
              <div key={h.id} className={`p-4 rounded-lg border ${h.bgColor}`}>
                <div className="flex items-center gap-3 mb-2">
                  <Icon className={`w-5 h-5 ${h.color}`} />
                  <span className={`font-semibold ${h.color}`}>{h.brand}</span>
                  <span className="text-xs text-slate-400">{h.role}</span>
                </div>
                <p className="text-sm text-slate-300 mb-1">{h.purpose}</p>
                <p className="text-xs text-slate-400 italic">Primary question: &ldquo;{h.question}&rdquo;</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Ecosystem Domains</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {DOMAINS.map((d) => (
            <div key={d.name} className="p-4 rounded-lg bg-slate-800/30 border border-slate-700/30">
              <div className="font-semibold text-white text-sm mb-1">{d.name}</div>
              <div className="text-xs text-slate-400 mb-2">{d.domain}</div>
              <ul className="space-y-1">
                {d.items.map((item) => (
                  <li key={item} className="text-xs text-slate-300">{'  '}· {item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Aigent Classification</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700/30">
            <div className="text-sm font-semibold text-slate-300 mb-1">Generic AI Agent</div>
            <p className="text-xs text-slate-400">Any autonomous or semi-autonomous AI system. No polity standing.</p>
          </div>
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="text-sm font-semibold text-green-300 mb-1">Aigent</div>
            <p className="text-xs text-slate-300">Polity-compliant agent with Participant Passport, RootDID, Reputation Record, and @aigent handle. Recognized participant.</p>
          </div>
        </div>
        <div className="p-3 rounded bg-slate-800/30 border border-slate-700/30">
          <div className="text-xs text-slate-400 mb-1">Identity Stack</div>
          <div className="flex items-center gap-2 text-xs text-slate-300 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-slate-700">Participant Passport</span>
            <span className="text-slate-500">&rarr;</span>
            <span className="px-2 py-0.5 rounded bg-slate-700">RootDID</span>
            <span className="text-slate-500">&rarr;</span>
            <span className="px-2 py-0.5 rounded bg-slate-700">Persona ID</span>
            <span className="text-slate-500">&rarr;</span>
            <span className="px-2 py-0.5 rounded bg-slate-700">@aigent Handle</span>
          </div>
        </div>
      </section>
    </div>
  );
}
