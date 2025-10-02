"use client";
import { useState, useEffect } from "react";
import { Button } from "../../../components/ui/button";
import Select from "../../../components/ui/select";

interface AnalyticsData {
  totalTemplates: number;
  totalInstances: number;
  templatesByType: Record<string, number>;
  instancesByRisk: number[];
  instancesByAccuracy: number[];
  instancesByVerifiability: number[];
  recentActivity: {
    date: string;
    action: string;
    id: string;
  }[];
}

export default function RegistryAnalytics() {
  const [timeRange, setTimeRange] = useState("30d");
  const [isLoading, setIsLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/registry/analytics?timeRange=${timeRange}`);
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        setAnalyticsData(data);
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
        // Set sample data for development
        setAnalyticsData(getSampleAnalyticsData());
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnalytics();
  }, [timeRange]);

  if (isLoading) {
    return <AnalyticsLoadingSkeleton />;
  }

  if (!analyticsData) {
    return (
      <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200">
        Failed to load analytics data. Please try again later.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header Section */}
      <div className="sticky top-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 z-10 pb-6 space-y-6">
        <h1 className="text-3xl font-semibold">Registry Analytics</h1>
        
        <div className="flex justify-between items-center">
          <p className="text-slate-300">
            View statistics and insights about iQubes in the registry.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Time Range:</span>
            <Select
              options={["7d", "30d", "90d", "1y", "all"]}
              value={timeRange}
              onValueChange={setTimeRange}
              className="w-24"
            />
          </div>
        </div>
      </div>

      {/* Scrollable Content Section */}
      <div className="flex-1 overflow-y-auto space-y-6">

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl p-5 bg-black/30 ring-1 ring-white/10">
          <div className="text-sm text-slate-400">Total Templates</div>
          <div className="text-3xl font-semibold mt-1">{analyticsData.totalTemplates}</div>
        </div>
        
        <div className="rounded-2xl p-5 bg-black/30 ring-1 ring-white/10">
          <div className="text-sm text-slate-400">Total Instances</div>
          <div className="text-3xl font-semibold mt-1">{analyticsData.totalInstances}</div>
        </div>
        
        <div className="rounded-2xl p-5 bg-black/30 ring-1 ring-white/10">
          <div className="text-sm text-slate-400">Avg. Risk Score</div>
          <div className="text-3xl font-semibold mt-1">
            {(analyticsData.instancesByRisk.reduce((a, b) => a + b, 0) / analyticsData.instancesByRisk.length).toFixed(1)}
          </div>
        </div>
        
        <div className="rounded-2xl p-5 bg-black/30 ring-1 ring-white/10">
          <div className="text-sm text-slate-400">Avg. Verifiability</div>
          <div className="text-3xl font-semibold mt-1">
            {(analyticsData.instancesByVerifiability.reduce((a, b) => a + b, 0) / analyticsData.instancesByVerifiability.length).toFixed(1)}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl p-5 bg-black/30 ring-1 ring-white/10">
          <h2 className="text-xl font-medium mb-4">Templates by Type</h2>
          <div className="space-y-3">
            {Object.entries(analyticsData.templatesByType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span>{type}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 bg-indigo-600/70 rounded-full" style={{ width: `${(count / analyticsData.totalTemplates) * 200}px` }}></div>
                  <span className="text-sm">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="rounded-2xl p-5 bg-black/30 ring-1 ring-white/10">
          <h2 className="text-xl font-medium mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {analyticsData.recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-slate-400">{new Date(activity.date).toLocaleDateString()}</span>
                  <p>{activity.action} - {activity.id}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl p-5 bg-black/30 ring-1 ring-white/10">
        <h2 className="text-xl font-medium mb-4">Score Distribution</h2>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <h3 className="text-sm text-slate-400 mb-2">Risk Scores</h3>
            <div className="h-40 flex items-end gap-1">
              {analyticsData.instancesByRisk.map((count, i) => (
                <div 
                  key={i} 
                  className="bg-red-500/70 w-full" 
                  style={{ height: `${(count / Math.max(...analyticsData.instancesByRisk)) * 100}%` }}
                  title={`Score ${i+1}: ${count} instances`}
                ></div>
              ))}
            </div>
            <div className="flex justify-between mt-1 text-xs text-slate-400">
              <span>1</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm text-slate-400 mb-2">Accuracy Scores</h3>
            <div className="h-40 flex items-end gap-1">
              {analyticsData.instancesByAccuracy.map((count, i) => (
                <div 
                  key={i} 
                  className="bg-yellow-500/70 w-full" 
                  style={{ height: `${(count / Math.max(...analyticsData.instancesByAccuracy)) * 100}%` }}
                  title={`Score ${i+1}: ${count} instances`}
                ></div>
              ))}
            </div>
            <div className="flex justify-between mt-1 text-xs text-slate-400">
              <span>1</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm text-slate-400 mb-2">Verifiability Scores</h3>
            <div className="h-40 flex items-end gap-1">
              {analyticsData.instancesByVerifiability.map((count, i) => (
                <div 
                  key={i} 
                  className="bg-green-500/70 w-full" 
                  style={{ height: `${(count / Math.max(...analyticsData.instancesByVerifiability)) * 100}%` }}
                  title={`Score ${i+1}: ${count} instances`}
                ></div>
              ))}
            </div>
            <div className="flex justify-between mt-1 text-xs text-slate-400">
              <span>1</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

function AnalyticsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Registry Analytics</h1>
      
      <div className="flex justify-between items-center">
        <div className="h-4 w-64 bg-white/10 animate-pulse rounded"></div>
        <div className="h-8 w-24 bg-white/10 animate-pulse rounded"></div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl p-5 bg-black/30 ring-1 ring-white/10">
            <div className="h-4 w-32 bg-white/10 animate-pulse rounded mb-2"></div>
            <div className="h-8 w-16 bg-white/10 animate-pulse rounded"></div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl p-5 bg-black/30 ring-1 ring-white/10">
            <div className="h-6 w-40 bg-white/10 animate-pulse rounded mb-4"></div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between">
                  <div className="h-4 w-24 bg-white/10 animate-pulse rounded"></div>
                  <div className="h-4 w-40 bg-white/10 animate-pulse rounded"></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Sample data for development
function getSampleAnalyticsData(): AnalyticsData {
  return {
    totalTemplates: 12,
    totalInstances: 87,
    templatesByType: {
      "Data": 4,
      "Content": 3,
      "Tool": 2,
      "Model": 1,
      "Aigent": 2
    },
    instancesByRisk: [2, 5, 8, 12, 15, 18, 10, 8, 6, 3],
    instancesByAccuracy: [1, 3, 5, 7, 10, 15, 18, 14, 9, 5],
    instancesByVerifiability: [3, 4, 6, 9, 12, 16, 14, 11, 8, 4],
    recentActivity: [
      { date: "2025-08-30T14:22:00Z", action: "Created Template", id: "template-007" },
      { date: "2025-08-29T09:15:00Z", action: "Added Instance", id: "instance-042" },
      { date: "2025-08-28T16:30:00Z", action: "Minted TokenQube", id: "token-031" },
      { date: "2025-08-27T11:45:00Z", action: "Updated Template", id: "template-003" },
      { date: "2025-08-26T13:20:00Z", action: "Added Instance", id: "instance-041" }
    ]
  };
}
