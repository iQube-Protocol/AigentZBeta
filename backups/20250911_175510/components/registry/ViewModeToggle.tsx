"use client";
import React from "react";

export type ViewMode = "grid" | "list" | "table";

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({ value, onChange, className }) => {
  const btnBase =
    "px-3 py-1.5 text-sm rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition";
  const active = "bg-white/10 text-white";

  return (
    <div className={"inline-flex items-center gap-2 " + (className || "") }>
      <button
        className={`${btnBase} ${value === "grid" ? active : ""}`}
        onClick={() => onChange("grid")}
        title="Grid view"
      >
        Grid
      </button>
      <button
        className={`${btnBase} ${value === "list" ? active : ""}`}
        onClick={() => onChange("list")}
        title="List view"
      >
        List
      </button>
      <button
        className={`${btnBase} ${value === "table" ? active : ""}`}
        onClick={() => onChange("table")}
        title="Table view"
      >
        Table
      </button>
    </div>
  );
};
