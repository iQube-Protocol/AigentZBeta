"use client";

import * as React from "react";

export interface SimpleSelectProps {
  label?: string;
  options: string[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
  title?: string;
  "aria-label"?: string;
}

/**
 * Simple select component with label and options support.
 * Uses native HTML select for simplicity and compatibility.
 */
export function SimpleSelect({
  label,
  options,
  value,
  defaultValue,
  onValueChange,
  className = "",
  placeholder,
  title,
  "aria-label": ariaLabel,
}: SimpleSelectProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-slate-300">{label}</label>
      )}
      <select
        value={value}
        defaultValue={defaultValue}
        onChange={(e) => onValueChange?.(e.target.value)}
        title={title}
        aria-label={ariaLabel}
        className="h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 ring-offset-background focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option} value={option} className="bg-slate-900 text-slate-100">
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

export default SimpleSelect;
