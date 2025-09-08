"use client";

import React from "react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: string[];
  error?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

export function Select({ 
  label, 
  options,
  value,
  onValueChange,
  className = "", 
  error,
  ...props 
}: SelectProps) {
  return (
    <label className="block text-sm">
      {label && <span className="mb-1 block text-slate-300">{label}</span>}
      <select 
        className={`w-full rounded-xl bg-white/10 ring-1 ring-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-600 ${error ? "ring-red-500" : ""} ${className}`}
        value={value}
        onChange={e => onValueChange?.(e.target.value)}
        {...props}
      >
        {options.map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </label>
  );
}
