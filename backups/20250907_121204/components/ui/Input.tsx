"use client";

import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ 
  label, 
  className = "", 
  error,
  ...props 
}: InputProps) {
  return (
    <label className="block text-sm">
      {label && <span className="mb-1 block text-slate-300">{label}</span>}
      <input 
        className={`w-full rounded-xl bg-white/10 ring-1 ring-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-600 ${error ? "ring-red-500" : ""} ${className}`} 
        {...props} 
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </label>
  );
}
