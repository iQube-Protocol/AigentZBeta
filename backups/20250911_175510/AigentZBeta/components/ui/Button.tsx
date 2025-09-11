"use client";

import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
}

export function Button({ 
  children, 
  className = "", 
  variant = "primary", 
  size = "md", 
  ...props 
}: ButtonProps) {
  const baseStyles = "rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50";
  
  const variantStyles = {
    primary: "bg-indigo-600/90 hover:bg-indigo-600 text-white",
    secondary: "bg-slate-700/90 hover:bg-slate-700 text-white",
    outline: "bg-transparent border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white"
  };
  
  const sizeStyles = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2",
    lg: "px-6 py-3 text-lg"
  };
  
  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
