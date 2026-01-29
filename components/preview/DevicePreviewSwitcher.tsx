"use client";

import React, { useState } from "react";
import { Monitor, Tablet, Smartphone } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type DeviceType = "desktop" | "tablet" | "mobile";

interface DeviceConfig {
  type: DeviceType;
  label: string;
  icon: React.ElementType;
  width: number;
  height?: number;
}

const devices: DeviceConfig[] = [
  { type: "desktop", label: "Desktop", icon: Monitor, width: 1920 },
  { type: "tablet", label: "Tablet", icon: Tablet, width: 768 },
  { type: "mobile", label: "Mobile", icon: Smartphone, width: 375 },
];

interface DevicePreviewSwitcherProps {
  /** Current selected device */
  value?: DeviceType;
  /** Callback when device changes */
  onChange?: (device: DeviceType) => void;
  /** Additional class names for the container */
  className?: string;
}

/**
 * A toolbar component for switching between device preview sizes.
 * Use this in conjunction with a preview container that respects the selected width.
 */
export function DevicePreviewSwitcher({
  value = "desktop",
  onChange,
  className,
}: DevicePreviewSwitcherProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg bg-muted/50 p-1",
        className
      )}
    >
      {devices.map((device) => {
        const Icon = device.icon;
        const isActive = value === device.type;
        return (
          <Tooltip key={device.type}>
            <TooltipTrigger asChild>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-8 w-8 p-0 transition-colors",
                  isActive && "bg-background shadow-sm"
                )}
                onClick={() => onChange?.(device.type)}
                aria-label={`Switch to ${device.label} view`}
              >
                <Icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>
                {device.label} ({device.width}px)
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

/**
 * Hook for managing device preview state with width values
 */
export function useDevicePreview(initialDevice: DeviceType = "desktop") {
  const [device, setDevice] = useState<DeviceType>(initialDevice);
  const deviceConfig = devices.find((d) => d.type === device) ?? devices[0];
  return {
    device,
    setDevice,
    width: deviceConfig.width,
    config: deviceConfig,
    devices,
  };
}

/**
 * Get the width for a specific device type
 */
export function getDeviceWidth(device: DeviceType): number {
  return devices.find((d) => d.type === device)?.width ?? 1920;
}
