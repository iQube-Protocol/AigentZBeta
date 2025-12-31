"use client";

import React, { useState } from "react";
import { CopilotChat } from "@copilotkit/react-ui";

const TEMPLATES = [
  { id: "micro-episode", name: "Micro Episode", app: "metaKnyts", icon: "📖", desc: "6-panel comic" },
  { id: "article", name: "Article", app: "Qriptopian", icon: "📰", desc: "News/analysis" },
  { id: "tutorial", name: "Tutorial", app: "AgentiQ", icon: "🎓", desc: "Step-by-step guide" },
];

export default function ContentCreatePage() {
  const [template, setTemplate] = useState<string | null>(null);

  const instructions = `You are the Content Creation Assistant. Help users create SmartContentQubes.
Available actions: content_create, content_create_micro_episode, content_create_article, content_publish.
Guide users through: type selection, title/description, modalities, pricing, publishing.`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      <header className="sticky top-0 z-40 bg-black/30 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Create Content</h1>
            <p className="text-sm text-slate-400">Build SmartContentQubes with AI</p>
          </div>
          <a href="/content" className="px-4 py-2 rounded-xl bg-white/5 ring-1 ring-white/10 text-slate-400 text-sm">← Back</a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Templates</h2>
          <div className="space-y-3">
            {TEMPLATES.map((t) => (
              <button key={t.id} onClick={() => setTemplate(t.id)} className={`w-full text-left p-4 rounded-xl ${template === t.id ? "bg-fuchsia-500/20 ring-2 ring-fuchsia-500/50" : "bg-white/5 ring-1 ring-white/10"}`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{t.icon}</span>
                  <div>
                    <div className="font-medium text-white">{t.name}</div>
                    <div className="text-sm text-slate-400">{t.desc} • {t.app}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl ring-1 ring-white/10 overflow-hidden h-[600px]">
          <CopilotChat instructions={instructions} labels={{ title: "Content Creator", initial: "What would you like to create today?", placeholder: "Describe your content..." }} className="h-full" />
        </div>
      </main>
    </div>
  );
}
