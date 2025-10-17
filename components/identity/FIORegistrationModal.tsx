"use client";

import React, { useState } from 'react';
import { X, Key, Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { FIOHandleInput } from './FIOHandleInput';
import { FIOService } from '@/services/identity/fioService';

interface FIORegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  personaId?: string;
  onSuccess?: (data: { handle: string; txId: string }) => void;
}

type Step = 'handle' | 'keys' | 'review' | 'registering' | 'success' | 'error';

export function FIORegistrationModal({
  isOpen,
  onClose,
  personaId,
  onSuccess
}: FIORegistrationModalProps) {
  const [step, setStep] = useState<Step>('handle');
  const [handle, setHandle] = useState('');
  const [handleAvailable, setHandleAvailable] = useState(false);
  const [publicKey, setPublicKey] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [registrationFee, setRegistrationFee] = useState('40.00');
  const [txId, setTxId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [generatingKeys, setGeneratingKeys] = useState(false);

  if (!isOpen) return null;

  // Reset modal state
  const resetModal = () => {
    setStep('handle');
    setHandle('');
    setHandleAvailable(false);
    setPublicKey('');
    setPrivateKey('');
    setShowPrivateKey(false);
    setTxId('');
    setErrorMessage('');
  };

  // Handle close
  const handleClose = () => {
    resetModal();
    onClose();
  };

  // Generate FIO key pair
  const handleGenerateKeys = async () => {
    setGeneratingKeys(true);
    setErrorMessage('');

    try {
      const keys = await FIOService.generateKeyPair();
      setPublicKey(keys.publicKey);
      setPrivateKey(keys.privateKey);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to generate keys');
    } finally {
      setGeneratingKeys(false);
    }
  };

  // Proceed to next step
  const handleNext = () => {
    if (step === 'handle' && handleAvailable) {
      setStep('keys');
    } else if (step === 'keys' && publicKey && privateKey) {
      setStep('review');
    }
  };

  // Register handle
  const handleRegister = async () => {
    if (!handle || !publicKey || !privateKey) {
      setErrorMessage('Missing required information');
      return;
    }

    setStep('registering');
    setErrorMessage('');

    try {
      const response = await fetch('/api/identity/fio/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle,
          publicKey,
          privateKey,
          personaId
        })
      });

      const data = await response.json();

      if (data.ok) {
        setTxId(data.data.txId);
        setStep('success');
        onSuccess?.({ handle, txId: data.data.txId });
      } else {
        setErrorMessage(data.error || 'Registration failed');
        setStep('error');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Network error');
      setStep('error');
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-slate-100">
            Register FIO Handle
          </h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Handle Selection */}
          {step === 'handle' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-slate-200 mb-2">
                  Choose Your FIO Handle
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                  Your FIO handle will be your unique identifier on the FIO blockchain.
                  It can be used for receiving payments and verifying your identity.
                </p>
              </div>

              <FIOHandleInput
                value={handle}
                onChange={setHandle}
                onVerificationChange={setHandleAvailable}
                required
              />

              <div className="flex justify-end">
                <button
                  onClick={handleNext}
                  disabled={!handleAvailable}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next: Generate Keys
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Key Generation */}
          {step === 'keys' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-slate-200 mb-2">
                  Generate FIO Keys
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                  You'll need a FIO key pair to register and manage your handle.
                  Keep your private key safe - it cannot be recovered if lost!
                </p>
              </div>

              {!publicKey ? (
                <div className="text-center py-8">
                  <button
                    onClick={handleGenerateKeys}
                    disabled={generatingKeys}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {generatingKeys ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Generating Keys...
                      </>
                    ) : (
                      <>
                        <Key size={18} />
                        Generate Key Pair
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Public Key */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Public Key
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={publicKey}
                        readOnly
                        className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200 font-mono"
                      />
                      <button
                        onClick={() => copyToClipboard(publicKey)}
                        className="px-3 py-2 bg-slate-700 text-slate-200 rounded-md hover:bg-slate-600 transition-colors text-sm"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  {/* Private Key */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Private Key
                      <span className="text-red-400 ml-2">⚠️ Keep this secret!</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type={showPrivateKey ? 'text' : 'password'}
                        value={privateKey}
                        readOnly
                        className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200 font-mono"
                      />
                      <button
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                        className="px-3 py-2 bg-slate-700 text-slate-200 rounded-md hover:bg-slate-600 transition-colors text-sm"
                      >
                        {showPrivateKey ? 'Hide' : 'Show'}
                      </button>
                      <button
                        onClick={() => copyToClipboard(privateKey)}
                        className="px-3 py-2 bg-slate-700 text-slate-200 rounded-md hover:bg-slate-600 transition-colors text-sm"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-xs text-red-400 mt-2">
                      Save this private key securely. You'll need it to manage your FIO handle.
                    </p>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-red-900/20 border border-red-700 rounded-md text-sm text-red-400">
                  {errorMessage}
                </div>
              )}

              <div className="flex justify-between">
                <button
                  onClick={() => setStep('handle')}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={!publicKey || !privateKey}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next: Review
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review & Confirm */}
          {step === 'review' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-slate-200 mb-2">
                  Review Registration
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                  Please review your registration details before proceeding.
                </p>
              </div>

              <div className="space-y-4 p-4 bg-slate-800/50 border border-slate-700 rounded-md">
                <div>
                  <p className="text-xs text-slate-500 mb-1">FIO Handle</p>
                  <p className="text-sm text-slate-200 font-medium">{handle}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Public Key</p>
                  <p className="text-xs text-slate-300 font-mono break-all">{publicKey}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Registration Fee</p>
                  <p className="text-sm text-slate-200">{registrationFee} FIO</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Expiration</p>
                  <p className="text-sm text-slate-200">1 year from registration</p>
                </div>
              </div>

              <div className="p-3 bg-yellow-900/20 border border-yellow-700 rounded-md">
                <p className="text-xs text-yellow-400">
                  ⚠️ Make sure you've saved your private key securely. It cannot be recovered if lost.
                </p>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep('keys')}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleRegister}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
                >
                  Register Handle
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Registering */}
          {step === 'registering' && (
            <div className="text-center py-12">
              <Loader2 size={48} className="mx-auto text-indigo-400 animate-spin mb-4" />
              <h3 className="text-lg font-medium text-slate-200 mb-2">
                Registering Your Handle
              </h3>
              <p className="text-sm text-slate-400">
                Please wait while we register your FIO handle on the blockchain...
              </p>
            </div>
          )}

          {/* Step 5: Success */}
          {step === 'success' && (
            <div className="text-center py-8">
              <CheckCircle size={64} className="mx-auto text-green-400 mb-4" />
              <h3 className="text-xl font-medium text-slate-200 mb-2">
                Registration Successful!
              </h3>
              <p className="text-sm text-slate-400 mb-6">
                Your FIO handle has been registered on the blockchain.
              </p>

              <div className="space-y-4 p-4 bg-slate-800/50 border border-slate-700 rounded-md text-left mb-6">
                <div>
                  <p className="text-xs text-slate-500 mb-1">FIO Handle</p>
                  <p className="text-sm text-slate-200 font-medium">{handle}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Transaction ID</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-300 font-mono break-all flex-1">{txId}</p>
                    <a
                      href={`https://fio.bloks.io/transaction/${txId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:text-indigo-300"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {/* Step 6: Error */}
          {step === 'error' && (
            <div className="text-center py-8">
              <AlertCircle size={64} className="mx-auto text-red-400 mb-4" />
              <h3 className="text-xl font-medium text-slate-200 mb-2">
                Registration Failed
              </h3>
              <p className="text-sm text-slate-400 mb-6">
                {errorMessage || 'An error occurred during registration.'}
              </p>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setStep('review')}
                  className="px-4 py-2 bg-slate-700 text-slate-200 rounded-md hover:bg-slate-600 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
