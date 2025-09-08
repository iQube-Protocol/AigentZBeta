"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface IQubeTemplate {
  id: string;
  name: string;
  description: string;
  riskScore: number;
  accuracyScore: number;
  verifiabilityScore: number;
  createdAt: string;
}

export function RegistryHome() {
  const [templates, setTemplates] = useState<IQubeTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const response = await fetch('/api/registry/templates');
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        setTemplates(data);
      } catch (err) {
        console.error("Failed to fetch templates:", err);
        setError("Failed to load iQube templates. Please try again later.");
        
        // Set sample data for development
        setTemplates(getSampleTemplates());
      } finally {
        setIsLoading(false);
      }
    }

    fetchTemplates();
  }, []);

  if (isLoading) {
    return <RegistryLoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-medium">iQube Templates</h2>
        <Link href="/registry/add" className="text-indigo-400 hover:text-indigo-300 text-sm">
          + Add New iQube
        </Link>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {templates.map((template) => (
          <div key={template.id} className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition">
            <div className="text-sm text-slate-400">Template</div>
            <div className="text-lg font-medium">{template.name}</div>
            <p className="mt-2 text-slate-300 text-sm line-clamp-2">{template.description}</p>
            
            <div className="mt-4 text-slate-400 text-sm">
              <div className="flex items-center justify-between">
                <span>Risk</span>
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={`text-xs ${i < Math.round(template.riskScore / 2) ? 'text-red-400' : 'text-slate-600'}`}>●</span>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span>Accuracy</span>
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={`text-xs ${i < Math.round(template.accuracyScore / 2) ? 'text-yellow-400' : 'text-slate-600'}`}>●</span>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span>Verifiability</span>
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={`text-xs ${i < Math.round(template.verifiabilityScore / 2) ? 'text-green-400' : 'text-slate-600'}`}>●</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RegistryLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="h-6 w-40 bg-white/10 animate-pulse rounded"></div>
        <div className="h-4 w-28 bg-white/10 animate-pulse rounded"></div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10">
            <div className="h-4 w-20 bg-white/10 animate-pulse rounded mb-2"></div>
            <div className="h-6 w-40 bg-white/10 animate-pulse rounded mb-4"></div>
            <div className="h-4 w-full bg-white/10 animate-pulse rounded"></div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between">
                <div className="h-3 w-16 bg-white/10 animate-pulse rounded"></div>
                <div className="h-3 w-20 bg-white/10 animate-pulse rounded"></div>
              </div>
              <div className="flex justify-between">
                <div className="h-3 w-16 bg-white/10 animate-pulse rounded"></div>
                <div className="h-3 w-20 bg-white/10 animate-pulse rounded"></div>
              </div>
              <div className="flex justify-between">
                <div className="h-3 w-16 bg-white/10 animate-pulse rounded"></div>
                <div className="h-3 w-20 bg-white/10 animate-pulse rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Sample data for development
function getSampleTemplates(): IQubeTemplate[] {
  return [
    {
      id: "template-001",
      name: "Personal Data iQube",
      description: "Template for storing and managing personal identity information with high security and privacy controls.",
      riskScore: 8,
      accuracyScore: 9,
      verifiabilityScore: 7,
      createdAt: "2025-08-15T12:00:00Z"
    },
    {
      id: "template-002",
      name: "Financial Transaction iQube",
      description: "Secure template for recording and verifying financial transactions with audit trails.",
      riskScore: 6,
      accuracyScore: 10,
      verifiabilityScore: 9,
      createdAt: "2025-08-10T14:30:00Z"
    },
    {
      id: "template-003",
      name: "Content Verification iQube",
      description: "Template for verifying the authenticity and provenance of digital content and media.",
      riskScore: 4,
      accuracyScore: 8,
      verifiabilityScore: 10,
      createdAt: "2025-08-05T09:15:00Z"
    },
    {
      id: "template-004",
      name: "Credential iQube",
      description: "Template for storing and verifying professional credentials and certifications.",
      riskScore: 5,
      accuracyScore: 9,
      verifiabilityScore: 8,
      createdAt: "2025-07-28T16:45:00Z"
    },
    {
      id: "template-005",
      name: "Health Data iQube",
      description: "Secure template for managing sensitive health information with privacy controls.",
      riskScore: 9,
      accuracyScore: 9,
      verifiabilityScore: 6,
      createdAt: "2025-07-20T11:30:00Z"
    },
    {
      id: "template-006",
      name: "Research Data iQube",
      description: "Template for storing and sharing scientific research data with verification mechanisms.",
      riskScore: 3,
      accuracyScore: 8,
      verifiabilityScore: 9,
      createdAt: "2025-07-15T13:20:00Z"
    }
  ];
}
