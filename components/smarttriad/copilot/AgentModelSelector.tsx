/**
 * AgentModelSelector for SmartTriad Copilot
 * 
 * Integrates with metaMe runtime's existing agent/model selection system.
 * Provides tenant-controlled access to agent and model selection capabilities.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Bot, ChevronDown, Cpu, Globe, Zap, Brain, Sparkles } from 'lucide-react';

// Types
export interface AgentOption {
  id: string;
  label: string;
  colorClass: string;
  description?: string;
}

export interface ModelOption {
  id: string;
  label: string;
  providerId: string;
  providerLabel: string;
  sourceIQubeId?: string;
  description?: string;
}

export interface AgentModelSelectorProps {
  selectedAgent: AgentOption;
  selectedModel: ModelOption | null;
  availableAgents: AgentOption[];
  modelOptions: ModelOption[];
  onAgentChange: (agent: AgentOption) => void;
  onModelChange: (model: ModelOption) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  className?: string;
}

// Provider icons
const providerIcons: Record<string, React.ReactNode> = {
  openai: <Brain className="w-3 h-3" />,
  anthropic: <Sparkles className="w-3 h-3" />,
  venice: <Globe className="w-3 h-3" />,
  chaingpt: <Zap className="w-3 h-3" />,
  thirdweb: <Cpu className="w-3 h-3" />,
  default: <Bot className="w-3 h-3" />,
};

export function AgentModelSelector({
  selectedAgent,
  selectedModel,
  availableAgents,
  modelOptions,
  onAgentChange,
  onModelChange,
  disabled = false,
  size = 'md',
  showLabels = true,
  className = '',
}: AgentModelSelectorProps) {
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-xs',
    lg: 'px-4 py-2 text-sm',
  };

  const handleAgentSelect = useCallback((agent: AgentOption) => {
    onAgentChange(agent);
    setShowAgentDropdown(false);
  }, [onAgentChange]);

  const handleModelSelect = useCallback((model: ModelOption) => {
    onModelChange(model);
    setShowModelDropdown(false);
  }, [onModelChange]);

  // Filter model options by selected agent
  const filteredModelOptions = useMemo(() => {
    return modelOptions.filter(model => 
      model.providerId && model.id // Only show valid models
    );
  }, [modelOptions, selectedAgent]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Agent Selector */}
      <div className="relative">
        <button
          onClick={() => {
            if (!disabled) {
              setShowAgentDropdown(!showAgentDropdown);
              setShowModelDropdown(false);
            }
          }}
          disabled={disabled}
          className={`flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/80 text-slate-200 transition-colors hover:bg-slate-900/80 disabled:opacity-50 ${sizeClasses[size]}`}
          title={selectedAgent.label}
        >
          <Bot className={`w-4 h-4 ${selectedAgent.colorClass}`} />
          {showLabels && <span>{selectedAgent.label}</span>}
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {showAgentDropdown && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowAgentDropdown(false)}
            />
            
            {/* Dropdown */}
            <div className="absolute left-0 top-full z-20 mt-1 w-[280px] rounded-xl border border-white/10 bg-slate-950/95 p-1.5 backdrop-blur-xl">
              <div className="space-y-1">
                {availableAgents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => handleAgentSelect(agent)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                      selectedAgent.id === agent.id
                        ? 'bg-cyan-500/20 text-cyan-200'
                        : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <Bot className={`w-4 h-4 ${agent.colorClass}`} />
                    <div className="flex-1 text-left">
                      <div className="font-medium">{agent.label}</div>
                      {agent.description && (
                        <div className="text-xs text-slate-400">{agent.description}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Model Selector */}
      <div className="relative">
        <button
          onClick={() => {
            if (!disabled) {
              setShowModelDropdown(!showModelDropdown);
              setShowAgentDropdown(false);
            }
          }}
          disabled={disabled}
          className={`flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/80 text-slate-200 transition-colors hover:bg-slate-900/80 disabled:opacity-50 ${sizeClasses[size]}`}
          title={selectedModel ? `${selectedModel.providerLabel} ${selectedModel.label}` : 'Select model'}
        >
          {selectedModel ? (
            providerIcons[selectedModel.providerId] || providerIcons.default
          ) : (
            <div className="w-3 h-3 rounded-[2px] bg-white/20" />
          )}
          {showLabels && (
            <span className="truncate max-w-[100px]">
              {selectedModel ? selectedModel.label : 'Select Model'}
            </span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {showModelDropdown && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowModelDropdown(false)}
            />
            
            {/* Dropdown */}
            <div className="absolute left-0 top-full z-20 mt-1 w-[280px] rounded-xl border border-white/10 bg-slate-950/95 p-2 backdrop-blur-xl">
              <p className="mb-2 px-1 text-[10px] uppercase tracking-wide text-slate-400">
                {selectedAgent.label} Models
              </p>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {filteredModelOptions.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => handleModelSelect(model)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                      selectedModel?.id === model.id
                        ? 'bg-cyan-500/20 text-cyan-200'
                        : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    {providerIcons[model.providerId] || providerIcons.default}
                    <div className="flex-1 text-left">
                      <div className="font-medium">{model.label}</div>
                      <div className="text-xs text-slate-400">{model.providerLabel}</div>
                      {model.description && (
                        <div className="text-xs text-slate-500 mt-0.5">{model.description}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              
              {filteredModelOptions.length === 0 && (
                <div className="text-center py-4 text-xs text-slate-400">
                  No models available for {selectedAgent.label}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Compact version for embedded contexts
export function CompactAgentModelSelector(props: AgentModelSelectorProps) {
  return (
    <AgentModelSelector
      {...props}
      size="sm"
      showLabels={false}
      className="compact-agent-model-selector"
    />
  );
}
