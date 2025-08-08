import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './Button'
import { Card, CardHeader, CardContent, CardFooter } from './Card'
import { Input } from './Input'
import { Badge } from './Badge'
import { Switch } from './switch'
import { SearchableDropdown } from './SearchableDropdown'
import { useState } from 'react'
import { 
  User, Mail, Settings, Bell, Search, Download, Upload, 
  Plus, ArrowRight, Check, Star, Heart, BarChart3, 
  Database, Code, Globe, Shield, Zap, TrendingUp,
  Users, FileText, Calendar, Clock
} from 'lucide-react'

const meta: Meta = {
  title: 'Examples/Professional Dashboard',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

// AI Model options
const aiModels = [
  { label: 'GPT-4 Turbo', value: 'gpt-4-turbo', group: 'OpenAI' },
  { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo', group: 'OpenAI' },
  { label: 'Claude 3 Opus', value: 'claude-3-opus', group: 'Anthropic' },
  { label: 'Claude 3 Sonnet', value: 'claude-3-sonnet', group: 'Anthropic' },
  { label: 'Gemini Pro', value: 'gemini-pro', group: 'Google' },
  { label: 'Llama 2 70B', value: 'llama-2-70b', group: 'Meta' },
]

const regions = [
  { label: 'US East (N. Virginia)', value: 'us-east-1', group: 'Americas' },
  { label: 'US West (Oregon)', value: 'us-west-2', group: 'Americas' },
  { label: 'Europe (Frankfurt)', value: 'eu-central-1', group: 'Europe' },
  { label: 'Asia Pacific (Tokyo)', value: 'ap-northeast-1', group: 'Asia Pacific' },
]

export const RAGEvaluationDashboard: Story = {
  render: () => {
    const [settings, setSettings] = useState({
      evaluationName: 'Enterprise RAG Evaluation',
      selectedModel: 'claude-3-sonnet',
      selectedRegion: 'us-east-1',
      vectorDatabase: 'pinecone',
      notifications: true,
      autoOptimize: false,
      realTimeAnalytics: true,
    })

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <Database className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Kiff AI Studio
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    RAG Evaluation & Optimization Platform
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Badge variant="success" dot>Production</Badge>
                <Button variant="outline" size="sm">
                  <Bell className="h-4 w-4 mr-2" />
                  Notifications
                </Button>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New Evaluation
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card variant="elevated" className="p-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Total Evaluations
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      247
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      +12.5% this month
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card variant="elevated" className="p-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Average Score
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      94.2%
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      +2.1% improvement
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card variant="elevated" className="p-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Processing Time
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      1.2s
                    </p>
                    <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                      -15% faster
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-xl flex items-center justify-center">
                    <Zap className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card variant="elevated" className="p-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Active Users
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      1,847
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                      +5.2% growth
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-xl flex items-center justify-center">
                    <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Configuration Panel */}
            <Card variant="elevated" className="lg:col-span-2 p-0">
              <CardHeader divider className="px-6 pt-6 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Create New RAG Evaluation
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      Configure your vectorization strategy and evaluation parameters
                    </p>
                  </div>
                  <Badge variant="info">Beta</Badge>
                </div>
              </CardHeader>

              <CardContent className="px-6 py-6 space-y-6">
                <Input
                  label="Evaluation Name"
                  value={settings.evaluationName}
                  onChange={(e) => setSettings(prev => ({ ...prev, evaluationName: e.target.value }))}
                  placeholder="Enter evaluation name"
                  leftIcon={<FileText className="h-4 w-4" />}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SearchableDropdown
                    label="AI Model"
                    value={settings.selectedModel}
                    options={aiModels}
                    onChange={(value) => setSettings(prev => ({ ...prev, selectedModel: value }))}
                    placeholder="Select AI model..."
                  />

                  <SearchableDropdown
                    label="Region"
                    value={settings.selectedRegion}
                    options={regions}
                    onChange={(value) => setSettings(prev => ({ ...prev, selectedRegion: value }))}
                    placeholder="Select region..."
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900 dark:text-white">Vector Database Options</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {['pinecone', 'weaviate', 'qdrant'].map((db) => (
                      <Card 
                        key={db}
                        className={`p-4 cursor-pointer transition-all duration-200 ${
                          settings.vectorDatabase === db 
                            ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                            : 'hover:shadow-md'
                        }`}
                        onClick={() => setSettings(prev => ({ ...prev, vectorDatabase: db }))}
                      >
                        <div className="text-center">
                          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg mx-auto mb-2 flex items-center justify-center">
                            <Database className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                          </div>
                          <p className="font-medium text-gray-900 dark:text-white capitalize">
                            {db}
                          </p>
                          {settings.vectorDatabase === db && (
                            <Check className="h-4 w-4 text-blue-500 mx-auto mt-1" />
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <Card className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 border-dashed">
                    <div className="text-center">
                      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        Upload Documents
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        Drag & drop files or click to browse (PDF, DOC, TXT)
                      </p>
                      <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Select Files
                      </Button>
                    </div>
                  </Card>
                </div>
              </CardContent>

              <CardFooter divider className="px-6 py-4">
                <div className="flex items-center justify-between w-full">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    <Clock className="h-4 w-4 inline mr-1" />
                    Estimated processing time: 3-5 minutes
                  </div>
                  <div className="flex space-x-3">
                    <Button variant="outline">Save Draft</Button>
                    <Button>
                      Start Evaluation
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </CardFooter>
            </Card>

            {/* Settings & Controls */}
            <div className="space-y-6">
              <Card variant="elevated" className="p-0">
                <CardHeader divider className="px-6 pt-6 pb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Advanced Settings
                  </h3>
                </CardHeader>
                <CardContent className="px-6 py-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        Real-time Analytics
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Monitor evaluation progress live
                      </p>
                    </div>
                    <Switch
                      checked={settings.realTimeAnalytics}
                      onCheckedChange={(checked) => 
                        setSettings(prev => ({ ...prev, realTimeAnalytics: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        Auto-optimize
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Automatically tune parameters
                      </p>
                    </div>
                    <Switch
                      checked={settings.autoOptimize}
                      onCheckedChange={(checked) => 
                        setSettings(prev => ({ ...prev, autoOptimize: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        Notifications
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Email when evaluation completes
                      </p>
                    </div>
                    <Switch
                      checked={settings.notifications}
                      onCheckedChange={(checked) => 
                        setSettings(prev => ({ ...prev, notifications: checked }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card variant="elevated" className="p-0">
                <CardHeader className="px-6 pt-6 pb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Recent Activity
                  </h3>
                </CardHeader>
                <CardContent className="px-6 py-4 space-y-3">
                  {[
                    { action: 'Evaluation completed', time: '2 minutes ago', status: 'success' },
                    { action: 'New document uploaded', time: '5 minutes ago', status: 'info' },
                    { action: 'Model switched to Claude 3', time: '1 hour ago', status: 'default' },
                    { action: 'Optimization started', time: '2 hours ago', status: 'warning' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-3">
                        <Badge variant={item.status as any} size="sm" dot />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {item.action}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {item.time}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
                <CardFooter className="px-6 py-4">
                  <Button variant="ghost" size="sm" fullWidth>
                    View All Activity
                  </Button>
                </CardFooter>
              </Card>

              <Card variant="elevated" className="p-0">
                <CardContent className="p-6 text-center">
                  <Shield className="h-8 w-8 text-blue-500 mx-auto mb-3" />
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Enterprise Security
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Your data is encrypted and secure with SOC 2 compliance
                  </p>
                  <Button variant="outline" size="sm" fullWidth>
                    View Security Details
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Bottom Status Bar */}
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Badge variant="success" dot>System Operational</Badge>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  API Response: 127ms
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Uptime: 99.97%
                </span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                <Globe className="h-4 w-4" />
                <span>Status: status.kiff-ai.com</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  },
}