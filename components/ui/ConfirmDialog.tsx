"use client";
import React from "react";

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
  secondaryText?: string;
  onSecondary?: () => void;
  confirmClassName?: string;
  secondaryClassName?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title = "Confirm",
  description = "Are you sure you want to proceed?",
  confirmText = "Delete",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  children,
  secondaryText,
  onSecondary,
  confirmClassName = "bg-red-600 text-white hover:bg-red-500",
  secondaryClassName = "bg-purple-600 text-white hover:bg-purple-500",
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl bg-[#0b0b0f] ring-1 ring-white/10 p-5 mx-4">
        <div className="text-lg font-semibold mb-1">{title}</div>
        <div className="text-slate-300 text-sm mb-4">
          {children ? children : description}
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/10"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          {secondaryText && onSecondary && (
            <button
              className={`px-3 py-1.5 text-sm rounded-lg ${secondaryClassName}`}
              onClick={onSecondary}
            >
              {secondaryText}
            </button>
          )}
          <button
            className={`px-3 py-1.5 text-sm rounded-lg ${confirmClassName}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
