"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DevicePreviewSwitcher, type DeviceType } from "@/components/preview/DevicePreviewSwitcher";
import { 
  Layers, 
  Monitor,
  Layout,
  Eye,
  Settings,
  CheckCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/toaster";
import { getSurfacePlanningInfo, generateRuntimeSurfacePlan } from "@/services/metame/surfacePlanningService";
import type { SurfacePlanV0 } from "@metame/contracts";

type SurfacePlanningPanelProps = {
  experienceId?: string;
  cartridge?: string;
  onSurfacePlanGenerated?: (plan: SurfacePlanV0) => void;
};

const SURFACE_ICONS = {
  liquid_ui: Layers,
  embed: Layout,
  drawer: Monitor,
  overlay: Eye,
};

const SURFACE_COLORS = {
  liquid_ui: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
  embed: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  drawer: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  overlay: "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200",
};

const DENSITY_COLORS = {
  micro: "border-white/20 bg-white/5 text-slate-200",
  compact: "border-slate-300/20 bg-slate-400/10 text-slate-200",
  standard: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
  expanded: "border-indigo-400/30 bg-indigo-500/10 text-indigo-200",
  full: "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200",
};

export default function SurfacePlanningPanel({ 
  experienceId, 
  cartridge = "Qriptopian",
  onSurfacePlanGenerated 
}: SurfacePlanningPanelProps) {
  const { toast } = useToast();
  const [activeDevice, setActiveDevice] = useState<DeviceType>("mobile");
  const [loading, setLoading] = useState(false);
  const [surfacePlan, setSurfacePlan] = useState<SurfacePlanV0 | null>(null);
  const [planningInfo, setPlanningInfo] = useState<any>(null);
  const [selectedIntent, setSelectedIntent] = useState<string>("make");

  useEffect(() => {
    loadPlanningInfo();
  }, [cartridge]);

  const loadPlanningInfo = async () => {
    try {
      const info = await getSurfacePlanningInfo(cartridge);
      setPlanningInfo(info);
    } catch (error) {
      console.error("Failed to load planning info:", error);
      toast(
        `Failed to load surface planning info: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error"
      );
    }
  };

  const generateSurfacePlan = async () => {
    setLoading(true);
    try {
      // For demo purposes, create some mock capsules
      const mockCapsules = [
        {
          id: "capsule_1",
          app: "KNYT",
          title: "Badge Portal",
          type: "SmartContentQube" as const,
          runtimeSource: "experience" as const,
          modalities: { mixed: { enabled: true } },
        },
        {
          id: "capsule_2", 
          app: "Qriptopian",
          title: "Story Card",
          type: "SmartContentQube" as const,
          runtimeSource: "experience" as const,
          modalities: { mixed: { enabled: true } },
        },
        {
          id: "capsule_3",
          app: "KNYT", 
          title: "Canon Thread",
          type: "SmartContentQube" as const,
          runtimeSource: "experience" as const,
          modalities: { text: { enabled: true } },
        },
      ];

      const plan = await generateRuntimeSurfacePlan({
        capsules: mockCapsules,
        deviceType: activeDevice,
        runtimeIntent: selectedIntent,
        sessionId: `studio_${Date.now()}`,
        cartridge,
        codexId: experienceId,
        capsuleId: experienceId,
      });

      setSurfacePlan(plan);
      onSurfacePlanGenerated?.(plan);

      toast(`Surface plan generated for ${activeDevice} with ${plan.placements.length} modules`, "success");
    } catch (error) {
      console.error("Failed to generate surface plan:", error);
      toast(
        `Failed to generate surface plan: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const renderSurfaceBadge = (surface: string) => {
    const Icon = SURFACE_ICONS[surface as keyof typeof SURFACE_ICONS] || Layers;
    const colorClass = SURFACE_COLORS[surface as keyof typeof SURFACE_COLORS] || "border-white/20 bg-white/5 text-slate-200";
    
    return (
      <Badge className={`${colorClass} flex items-center gap-1 border`}>
        <Icon className="w-3 h-3" />
        {surface}
      </Badge>
    );
  };

  const renderDensityBadge = (density: string) => {
    const colorClass = DENSITY_COLORS[density as keyof typeof DENSITY_COLORS] || "border-white/20 bg-white/5 text-slate-200";
    
    return (
      <Badge className={`${colorClass} border`}>
        {density}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border border-white/10 bg-slate-950/55 text-slate-100 shadow-[0_12px_40px_rgba(3,9,24,0.45)] backdrop-blur-xl">
        <CardHeader className="border-b border-white/10">
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-300" />
            Surface Planning
          </CardTitle>
          <CardDescription className="text-slate-400">
            Configure surface selection and module placement for the {cartridge} cartridge
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-center">
            <DevicePreviewSwitcher
              value={activeDevice}
              onChange={setActiveDevice}
              className="bg-white/[0.04] border border-white/10"
            />
            <select
              value={selectedIntent}
              onChange={(e) => setSelectedIntent(e.target.value)}
              className="px-3 py-2 border border-white/15 bg-slate-900/80 text-slate-100 rounded-md focus:outline-none focus:border-cyan-400/50"
            >
              <option value="be">Be</option>
              <option value="make">Make</option>
              <option value="play">Play</option>
              <option value="earn">Earn</option>
              <option value="share">Share</option>
            </select>
            <Button 
              onClick={generateSurfacePlan}
              disabled={loading}
              className="ml-auto border border-cyan-400/40 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25"
            >
              {loading ? "Generating..." : "Generate Surface Plan"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Planning Info */}
      {planningInfo && (
        <Card className="border border-white/10 bg-slate-950/55 text-slate-100 shadow-[0_12px_40px_rgba(3,9,24,0.45)] backdrop-blur-xl">
          <CardHeader className="border-b border-white/10">
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-cyan-300" />
              Available Modules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {planningInfo.available_modules?.map((module: any) => (
                <div key={module.module_type} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <h4 className="font-medium text-sm">{module.display_name}</h4>
                  <p className="text-xs text-slate-400 mt-1">{module.module_type}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {module.preferred_surfaces?.slice(0, 2).map((surface: string) => (
                      <Badge key={surface} className="text-xs border-white/15 bg-white/[0.04] text-slate-200">
                        {surface}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Surface Plan Results */}
      {surfacePlan && (
        <Card className="border border-white/10 bg-slate-950/55 text-slate-100 shadow-[0_12px_40px_rgba(3,9,24,0.45)] backdrop-blur-xl">
          <CardHeader className="border-b border-white/10">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-300" />
              Surface Plan Results
            </CardTitle>
            <CardDescription className="text-slate-400">
              Generated plan for {surfacePlan.device_context.device_class} ({surfacePlan.device_context.orientation})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="placements" className="w-full">
              <TabsList className="border border-white/10 bg-white/[0.04]">
                <TabsTrigger value="placements" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-100">Placements</TabsTrigger>
                <TabsTrigger value="navigation" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-100">Navigation</TabsTrigger>
                <TabsTrigger value="details" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-100">Details</TabsTrigger>
              </TabsList>
              
              <TabsContent value="placements" className="space-y-4">
                {surfacePlan.placements.map((placement: SurfacePlanV0["placements"][number]) => (
                  <div key={placement.module_id} className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{placement.module_id}</h4>
                        <p className="text-sm text-slate-400">
                          Order: {placement.order} • Region: {placement.region}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {renderSurfaceBadge(placement.surface)}
                        {renderDensityBadge(placement.density)}
                      </div>
                    </div>
                    
                    {placement.interaction && (
                      <div className="mt-3 p-2 rounded border border-cyan-400/30 bg-cyan-500/10">
                        <p className="text-sm text-cyan-200">
                          <strong>Interaction:</strong> Opens to {placement.interaction.opens} 
                          ({placement.interaction.open_density})
                        </p>
                      </div>
                    )}
                    
                    {placement.overrides && (
                      <div className="mt-3 p-2 rounded border border-amber-400/30 bg-amber-500/10">
                        <p className="text-sm text-amber-200">
                          <strong>Overrides:</strong> {Object.keys(placement.overrides).join(", ")}
                        </p>
                      </div>
                    )}
                    
                    {placement.reasoning_tags && (
                      <div className="mt-3">
                        <div className="flex flex-wrap gap-1">
                          {placement.reasoning_tags.map((tag: string, tagIndex: number) => (
                            <Badge key={tagIndex} className="text-xs border-white/15 bg-white/[0.04] text-slate-200">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </TabsContent>
              
              <TabsContent value="navigation" className="space-y-4">
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                  <h4 className="font-medium mb-3">Navigation Flow</h4>
                  <div className="flex items-center gap-2">
                    {surfacePlan.navigation.progression.map((surface: string, index: number) => (
                      <React.Fragment key={surface}>
                        <div className={`px-3 py-2 rounded border ${
                          surface === surfacePlan.navigation.entry_surface 
                            ? "bg-cyan-500/15 border-cyan-400/40 text-cyan-100" 
                            : "bg-white/[0.03] border-white/10 text-slate-300"
                        }`}>
                          {surface}
                        </div>
                        {index < surfacePlan.navigation.progression.length - 1 && (
                          <span>→</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  <p className="text-sm text-slate-400 mt-2">
                    Entry surface: {surfacePlan.navigation.entry_surface}
                  </p>
                </div>
              </TabsContent>
              
              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                    <h4 className="font-medium mb-2">Plan Info</h4>
                    <dl className="space-y-1 text-sm text-slate-300">
                      <div><strong>Plan ID:</strong> {surfacePlan.plan_id}</div>
                      <div><strong>Session:</strong> {surfacePlan.session_id}</div>
                      <div><strong>Cartridge:</strong> {surfacePlan.cartridge}</div>
                      <div><strong>Intent:</strong> {surfacePlan.intent.mode}</div>
                    </dl>
                  </div>
                  
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                    <h4 className="font-medium mb-2">Device Context</h4>
                    <dl className="space-y-1 text-sm text-slate-300">
                      <div><strong>Device:</strong> {surfacePlan.device_context.device_class}</div>
                      <div><strong>Orientation:</strong> {surfacePlan.device_context.orientation}</div>
                      <div><strong>Interaction:</strong> {surfacePlan.device_context.interaction}</div>
                      <div><strong>Real Estate:</strong> {surfacePlan.device_context.real_estate}</div>
                    </dl>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
