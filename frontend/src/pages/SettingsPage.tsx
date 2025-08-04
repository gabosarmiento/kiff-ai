import { useState } from 'react'
import { Save, Key, Shield, Bell, Palette, Settings as SettingsIcon, Cpu } from 'lucide-react'
import toast from 'react-hot-toast'

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('api-keys')
  const [settings, setSettings] = useState({
    apiKeys: {
      groqKey: '',
      exaKey: '',
      openaiKey: '',
      anthropicKey: '',
    },
    security: {
      twoFactorEnabled: false,
      sessionTimeout: 30,
      ipWhitelist: '',
    },
    notifications: {
      emailAlerts: true,
      pushNotifications: true,
      generationAlerts: true,
      systemAlerts: true,
    },
    preferences: {
      theme: 'dark',
      defaultModel: 'llama-3.3-70b-versatile',
      outputDirectory: './generated_apps',
      language: 'en',
    },
    generation: {
      maxTokens: 8192,
      temperature: 0.7,
      enableStreaming: true,
      autoSave: true,
    }
  })

  const tabs = [
    { id: 'api-keys', label: 'API Keys', icon: Key },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'preferences', label: 'Preferences', icon: Palette },
    { id: 'generation', label: 'AI Generation', icon: Cpu },
  ]

  const handleSave = () => {
    // In a real app, this would save to the backend
    toast.success('Settings saved successfully!')
  }

  const updateSetting = (category: string, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category as keyof typeof prev],
        [key]: value
      }
    }))
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
        <p className="text-slate-400">Manage your account preferences and AI configuration</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-64">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-cyan-400/10 text-cyan-400 border-r-2 border-cyan-400'
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-3" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl">
            <div className="p-6">
              {/* API Keys */}
              {activeTab === 'api-keys' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-100 mb-4">API Keys</h2>
                    <p className="text-sm text-slate-400 mb-6">
                      Configure your AI platform API keys. All keys are encrypted and stored securely.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Groq API Key (for AI features)
                      </label>
                      <input
                        type="password"
                        value={settings.apiKeys.groqKey}
                        onChange={(e) => updateSetting('apiKeys', 'groqKey', e.target.value)}
                        placeholder="Enter your Groq API key"
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 transition-all duration-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Exa API Key (for search)
                      </label>
                      <input
                        type="password"
                        value={settings.apiKeys.exaKey}
                        onChange={(e) => updateSetting('apiKeys', 'exaKey', e.target.value)}
                        placeholder="Enter your Exa API key"
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 transition-all duration-200"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        OpenAI API Key (optional)
                      </label>
                      <input
                        type="password"
                        value={settings.apiKeys.openaiKey}
                        onChange={(e) => updateSetting('apiKeys', 'openaiKey', e.target.value)}
                        placeholder="Enter your OpenAI API key"
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 transition-all duration-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Anthropic API Key (optional)
                      </label>
                      <input
                        type="password"
                        value={settings.apiKeys.anthropicKey}
                        onChange={(e) => updateSetting('apiKeys', 'anthropicKey', e.target.value)}
                        placeholder="Enter your Anthropic API key"
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 transition-all duration-200"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Security */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Security</h2>
                    <p className="text-sm text-gray-600 mb-6">
                      Configure security settings to protect your account and trading activities.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">Two-Factor Authentication</h3>
                        <p className="text-sm text-gray-600">Add an extra layer of security to your account</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.security.twoFactorEnabled}
                          onChange={(e) => updateSetting('security', 'twoFactorEnabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Session Timeout (minutes)
                      </label>
                      <input
                        type="number"
                        value={settings.security.sessionTimeout}
                        onChange={(e) => updateSetting('security', 'sessionTimeout', Number(e.target.value))}
                        min="5"
                        max="120"
                        className="input max-w-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        IP Whitelist (optional)
                      </label>
                      <textarea
                        value={settings.security.ipWhitelist}
                        onChange={(e) => updateSetting('security', 'ipWhitelist', e.target.value)}
                        placeholder="Enter IP addresses separated by commas"
                        rows={3}
                        className="input"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h2>
                    <p className="text-sm text-gray-600 mb-6">
                      Choose how you want to be notified about trading activities and system events.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {Object.entries(settings.notifications).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {key === 'emailAlerts' && 'Receive notifications via email'}
                            {key === 'pushNotifications' && 'Browser push notifications'}
                            {key === 'tradingAlerts' && 'Alerts for trading activities and signals'}
                            {key === 'systemAlerts' && 'System maintenance and security alerts'}
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) => updateSetting('notifications', key, e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preferences */}
              {activeTab === 'preferences' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Preferences</h2>
                    <p className="text-sm text-gray-600 mb-6">
                      Customize your kiff experience.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Theme
                      </label>
                      <select
                        value={settings.preferences.theme}
                        onChange={(e) => updateSetting('preferences', 'theme', e.target.value)}
                        className="input"
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="auto">Auto</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Currency
                      </label>
                      <select
                        value={settings.preferences.currency}
                        onChange={(e) => updateSetting('preferences', 'currency', e.target.value)}
                        className="input"
                      >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="BTC">BTC</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Timezone
                      </label>
                      <select
                        value={settings.preferences.timezone}
                        onChange={(e) => updateSetting('preferences', 'timezone', e.target.value)}
                        className="input"
                      >
                        <option value="UTC">UTC</option>
                        <option value="America/New_York">Eastern Time</option>
                        <option value="America/Los_Angeles">Pacific Time</option>
                        <option value="Europe/London">London</option>
                        <option value="Asia/Tokyo">Tokyo</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Language
                      </label>
                      <select
                        value={settings.preferences.language}
                        onChange={(e) => updateSetting('preferences', 'language', e.target.value)}
                        className="input"
                      >
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="ja">Japanese</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Risk Management */}
              {activeTab === 'risk' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Risk Management</h2>
                    <p className="text-sm text-gray-600 mb-6">
                      Configure risk limits to protect your capital and manage exposure.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Position Size (% of portfolio)
                      </label>
                      <input
                        type="number"
                        value={settings.risk.maxPositionSize}
                        onChange={(e) => updateSetting('risk', 'maxPositionSize', Number(e.target.value))}
                        min="1"
                        max="100"
                        className="input"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Daily Loss Limit (% of portfolio)
                      </label>
                      <input
                        type="number"
                        value={settings.risk.dailyLossLimit}
                        onChange={(e) => updateSetting('risk', 'dailyLossLimit', Number(e.target.value))}
                        min="1"
                        max="50"
                        className="input"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Open Positions
                      </label>
                      <input
                        type="number"
                        value={settings.risk.maxOpenPositions}
                        onChange={(e) => updateSetting('risk', 'maxOpenPositions', Number(e.target.value))}
                        min="1"
                        max="20"
                        className="input"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">Require Confirmation</h3>
                        <p className="text-sm text-gray-600">Require manual confirmation for all trades</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.risk.requireConfirmation}
                          onChange={(e) => updateSetting('risk', 'requireConfirmation', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Save Button */}
              <div className="pt-6 border-t border-slate-700/50">
                <button
                  onClick={handleSave}
                  className="px-6 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg border border-cyan-400/50 hover:border-cyan-400 transition-all duration-200 flex items-center space-x-2 font-medium"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Settings</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
