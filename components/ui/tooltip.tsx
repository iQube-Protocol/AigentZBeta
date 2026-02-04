import React from "react";
import { cn } from "@/utils/cn";

interface TooltipProps {
  children: React.ReactNode;
  className?: string;
}

interface TooltipTriggerProps {
  children: React.ReactNode;
  className?: string;
  asChild?: boolean;
}

interface TooltipContentProps {
  children: React.ReactNode;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({ children, className }: TooltipProps) {
  return <span className={cn("relative inline-flex group", className)}>{children}</span>;
}

export function TooltipTrigger({ children, className, asChild }: TooltipTriggerProps) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      className: cn(children.props.className, className),
    });
  }
  return <span className={cn("inline-flex", className)}>{children}</span>;
}

const SIDE_CLASSES: Record<NonNullable<TooltipContentProps["side"]>, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

export function TooltipContent({ children, className, side = "top" }: TooltipContentProps) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute z-50 hidden group-hover:inline-flex items-center rounded-md bg-slate-900 px-2 py-1 text-xs text-slate-100 shadow-md",
        SIDE_CLASSES[side],
        className
      )}
    >
      {children}
    </span>
  );
}
