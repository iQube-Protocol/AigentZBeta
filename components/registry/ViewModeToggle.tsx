"use client";
import React from "react";
import { LayoutGrid, List, Table } from "lucide-react";

export type ViewMode = "grid" | "list" | "table";

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({ value, onChange, className }) => {
  const btnBase =
    "p-2 rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition inline-flex items-center";
  const active = "bg-white/10 text-white";

  return (
    <div className={"inline-flex items-center gap-2 " + (className || "") }>
      <button
        className={`${btnBase} ${value === "grid" ? active : ""}`}
        onClick={() => onChange("grid")}
        title="Grid view"
        aria-label="Grid view"
      >
        <LayoutGrid size={16} />
      </button>
      <button
        className={`${btnBase} ${value === "list" ? active : ""}`}
        onClick={() => onChange("list")}
        title="List view"
        aria-label="List view"
      >
        <List size={16} />
      </button>
      <button
        className={`${btnBase} ${value === "table" ? active : ""}`}
        onClick={() => onChange("table")}
        title="Table view"
        aria-label="Table view"
      >
        <Table size={16} />
      </button>
    </div>
  );
};
