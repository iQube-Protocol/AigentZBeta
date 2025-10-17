"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';

interface FIOHandleInputProps {
  value: string;
  onChange: (value: string) => void;
  onVerificationChange?: (verified: boolean) => void;
  disabled?: boolean;
  required?: boolean;
  defaultDomain?: string;
}

type ValidationState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error';

export function FIOHandleInput({
  value,
  onChange,
  onVerificationChange,
  disabled = false,
  required = false,
  defaultDomain = '@aigent'
}: FIOHandleInputProps) {
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [checkTimeout, setCheckTimeout] = useState<NodeJS.Timeout | null>(null);

  // Validate handle format
  const validateFormat = useCallback((handle: string): boolean => {
    if (!handle) return false;
    
    // Must contain @ symbol
    if (!handle.includes('@')) return false;
    
    // Format: username@domain
    const regex = /^[a-z0-9-]{1,64}@[a-z0-9-]{1,64}$/i;
    return regex.test(handle);
  }, []);

  // Check handle availability
  const checkAvailability = useCallback(async (handle: string) => {
    if (!validateFormat(handle)) {
      setValidationState('invalid');
      setErrorMessage('Invalid format. Use: username@domain');
      onVerificationChange?.(false);
      return;
    }

    setValidationState('checking');
    setErrorMessage('');

    try {
      const response = await fetch('/api/identity/fio/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle })
      });

      const data = await response.json();

      if (data.ok) {
        if (data.available) {
          setValidationState('available');
          onVerificationChange?.(true);
        } else {
          setValidationState('taken');
          setErrorMessage('This handle is already registered');
          onVerificationChange?.(false);
        }
      } else {
        setValidationState('error');
        setErrorMessage(data.error || 'Failed to check availability');
        onVerificationChange?.(false);
      }
    } catch (error) {
      console.error('Availability check error:', error);
      setValidationState('error');
      setErrorMessage('Network error. Please try again.');
      onVerificationChange?.(false);
    }
  }, [validateFormat, onVerificationChange]);

  // Debounced availability check
  useEffect(() => {
    // Clear existing timeout
    if (checkTimeout) {
      clearTimeout(checkTimeout);
    }

    // Reset state if empty
    if (!value) {
      setValidationState('idle');
      setErrorMessage('');
      onVerificationChange?.(false);
      return;
    }

    // Set new timeout for checking
    const timeout = setTimeout(() => {
      checkAvailability(value);
    }, 800); // 800ms debounce

    setCheckTimeout(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [value, checkAvailability, onVerificationChange]);

  // Auto-append default domain if user doesn't include @
  const handleChange = (newValue: string) => {
    let processedValue = newValue.toLowerCase().trim();
    
    // If user types without @, auto-append default domain
    if (processedValue && !processedValue.includes('@') && processedValue.length > 0) {
      // Only show suggestion, don't auto-append yet
      onChange(processedValue);
    } else {
      onChange(processedValue);
    }
  };

  // Handle blur - auto-append domain if needed
  const handleBlur = () => {
    if (value && !value.includes('@')) {
      onChange(value + defaultDomain);
    }
  };

  // Get status icon
  const getStatusIcon = () => {
    switch (validationState) {
      case 'checking':
        return <Loader2 size={18} className="text-blue-400 animate-spin" />;
      case 'available':
        return <CheckCircle size={18} className="text-green-400" />;
      case 'taken':
        return <XCircle size={18} className="text-red-400" />;
      case 'invalid':
        return <AlertCircle size={18} className="text-yellow-400" />;
      case 'error':
        return <AlertCircle size={18} className="text-orange-400" />;
      default:
        return null;
    }
  };

  // Get status message
  const getStatusMessage = () => {
    switch (validationState) {
      case 'checking':
        return 'Checking availability...';
      case 'available':
        return 'Handle is available!';
      case 'taken':
        return errorMessage;
      case 'invalid':
        return errorMessage;
      case 'error':
        return errorMessage;
      default:
        return '';
    }
  };

  // Get border color based on state
  const getBorderColor = () => {
    switch (validationState) {
      case 'available':
        return 'border-green-500 focus:ring-green-500';
      case 'taken':
        return 'border-red-500 focus:ring-red-500';
      case 'invalid':
        return 'border-yellow-500 focus:ring-yellow-500';
      case 'error':
        return 'border-orange-500 focus:ring-orange-500';
      case 'checking':
        return 'border-blue-500 focus:ring-blue-500';
      default:
        return 'border-slate-700 focus:ring-indigo-500';
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-300">
        FIO Handle {required && <span className="text-red-400">*</span>}
      </label>
      
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={`username${defaultDomain}`}
          className={`w-full px-3 py-2 pr-10 bg-slate-800 border rounded-md text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 transition-colors ${getBorderColor()} ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        />
        
        {/* Status Icon */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {getStatusIcon()}
        </div>
      </div>

      {/* Status Message */}
      {validationState !== 'idle' && (
        <p className={`text-xs ${
          validationState === 'available' ? 'text-green-400' :
          validationState === 'taken' ? 'text-red-400' :
          validationState === 'invalid' ? 'text-yellow-400' :
          validationState === 'error' ? 'text-orange-400' :
          'text-blue-400'
        }`}>
          {getStatusMessage()}
        </p>
      )}

      {/* Format Hint */}
      {validationState === 'idle' && (
        <p className="text-xs text-slate-500">
          Format: username@domain (e.g., alice{defaultDomain})
        </p>
      )}
    </div>
  );
}
