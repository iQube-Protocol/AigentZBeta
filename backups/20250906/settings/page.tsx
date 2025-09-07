"use client";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ success?: boolean; message: string } | null>(null);
  
  // User profile settings
  const [profile, setProfile] = useState({
    displayName: "User",
    email: "user@example.com",
    theme: "dark",
    notifications: true,
    apiKey: "••••••••••••••••",
    defaultNetwork: "Ethereum"
  });

  // App settings
  const [appSettings, setAppSettings] = useState({
    defaultAgentKey: "researcher",
    autoSaveContext: true,
    showAdvancedOptions: false,
    developerMode: false,
    analyticsConsent: true
  });

  async function handleProfileUpdate(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setStatus(null);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setStatus({
        success: true,
        message: "Profile settings updated successfully!"
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      setStatus({
        success: false,
        message: error instanceof Error ? error.message : "An unknown error occurred"
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAppSettingsUpdate(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setStatus(null);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setStatus({
        success: true,
        message: "App settings updated successfully!"
      });
    } catch (error) {
      console.error("Error updating app settings:", error);
      setStatus({
        success: false,
        message: error instanceof Error ? error.message : "An unknown error occurred"
      });
    } finally {
      setIsLoading(false);
    }
  }

  function regenerateApiKey() {
    const newKey = Array.from({length: 32}, () => 
      Math.floor(Math.random() * 36).toString(36)
    ).join('');
    
    setProfile({
      ...profile,
      apiKey: newKey
    });
    
    setStatus({
      success: true,
      message: "New API key generated. Remember to save your changes!"
    });
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <h1 className="text-3xl font-semibold">Settings</h1>

      {status && (
        <div className={`p-4 rounded-xl ${status.success ? "bg-green-500/20 border border-green-500/50 text-green-200" : "bg-red-500/20 border border-red-500/50 text-red-200"}`}>
          {status.message}
        </div>
      )}

      <div className="grid md:grid-cols-[1fr_2fr] gap-8">
        <div className="space-y-6">
          <div className="rounded-2xl bg-black/30 p-6 space-y-4">
            <div className="flex items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-700 flex items-center justify-center text-2xl font-bold">
                {profile.displayName.charAt(0)}
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-medium">{profile.displayName}</h2>
              <p className="text-slate-400">{profile.email}</p>
            </div>
            <div className="pt-2 text-center">
              <button className="text-indigo-400 hover:text-indigo-300 text-sm">
                Change Profile Picture
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-black/30 p-6 space-y-4">
            <h3 className="text-lg font-medium">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 flex items-center gap-2">
                <span className="text-indigo-400">⟳</span>
                <span>Sync iQube Registry</span>
              </button>
              <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 flex items-center gap-2">
                <span className="text-indigo-400">⚠️</span>
                <span>Clear Local Cache</span>
              </button>
              <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 flex items-center gap-2">
                <span className="text-indigo-400">🔑</span>
                <span>Manage API Keys</span>
              </button>
              <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 flex items-center gap-2">
                <span className="text-indigo-400">📋</span>
                <span>View Activity Log</span>
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <form onSubmit={handleProfileUpdate} className="rounded-2xl bg-black/30 p-6 space-y-4">
            <h3 className="text-xl font-medium">Profile Settings</h3>
            
            <Input
              label="Display Name"
              value={profile.displayName}
              onChange={(e) => setProfile({...profile, displayName: e.target.value})}
              required
            />
            
            <Input
              label="Email"
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({...profile, email: e.target.value})}
              required
            />
            
            <div className="grid sm:grid-cols-2 gap-4">
              <Select
                label="Theme"
                options={["light", "dark", "system"]}
                value={profile.theme}
                onValueChange={(value) => setProfile({...profile, theme: value})}
              />
              
              <Select
                label="Default Network"
                options={["Ethereum", "Polygon", "Optimism", "Arbitrum", "Base"]}
                value={profile.defaultNetwork}
                onValueChange={(value) => setProfile({...profile, defaultNetwork: value})}
              />
            </div>
            
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <Input
                  label="API Key"
                  value={profile.apiKey}
                  onChange={(e) => setProfile({...profile, apiKey: e.target.value})}
                  disabled
                />
              </div>
              <Button type="button" onClick={regenerateApiKey}>
                Regenerate
              </Button>
            </div>
            
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="notifications"
                checked={profile.notifications}
                onChange={(e) => setProfile({...profile, notifications: e.target.checked})}
                className="rounded border-slate-600 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="notifications">Enable notifications</label>
            </div>
            
            <div className="pt-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </form>

          <form onSubmit={handleAppSettingsUpdate} className="rounded-2xl bg-black/30 p-6 space-y-4">
            <h3 className="text-xl font-medium">App Settings</h3>
            
            <Select
              label="Default Agent"
              options={["researcher", "analyst", "creator", "critic", "synthesizer"]}
              value={appSettings.defaultAgentKey}
              onValueChange={(value) => setAppSettings({...appSettings, defaultAgentKey: value})}
            />
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoSaveContext"
                  checked={appSettings.autoSaveContext}
                  onChange={(e) => setAppSettings({...appSettings, autoSaveContext: e.target.checked})}
                  className="rounded border-slate-600 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="autoSaveContext">Auto-save context between sessions</label>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showAdvancedOptions"
                  checked={appSettings.showAdvancedOptions}
                  onChange={(e) => setAppSettings({...appSettings, showAdvancedOptions: e.target.checked})}
                  className="rounded border-slate-600 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="showAdvancedOptions">Show advanced options</label>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="developerMode"
                  checked={appSettings.developerMode}
                  onChange={(e) => setAppSettings({...appSettings, developerMode: e.target.checked})}
                  className="rounded border-slate-600 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="developerMode">Developer mode</label>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="analyticsConsent"
                  checked={appSettings.analyticsConsent}
                  onChange={(e) => setAppSettings({...appSettings, analyticsConsent: e.target.checked})}
                  className="rounded border-slate-600 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="analyticsConsent">Allow anonymous usage analytics</label>
              </div>
            </div>
            
            <div className="pt-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save App Settings"}
              </Button>
            </div>
          </form>

          <div className="rounded-2xl bg-black/30 p-6 space-y-4">
            <h3 className="text-xl font-medium">About</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Version</span>
                <span>1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Build</span>
                <span>2025.09.01</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Environment</span>
                <span>Production</span>
              </div>
            </div>
            <div className="pt-2">
              <p className="text-sm text-slate-400">
                © 2025 Aigent Z. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
