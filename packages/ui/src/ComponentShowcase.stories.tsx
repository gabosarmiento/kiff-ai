import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './Button'
import { Card, CardHeader, CardContent, CardFooter } from './Card'
import { Input } from './Input'
import { Badge } from './Badge'
import { Switch } from './switch'
import { SearchableDropdown } from './SearchableDropdown'
import { ComponentShowcase } from './ComponentShowcase'
import { useState } from 'react'
import { 
  User, Mail, Settings, Bell, Search, Download, 
  Plus, ArrowRight, Check, Star, Heart 
} from 'lucide-react'

const meta: Meta = {
  title: 'Examples/Component Showcase',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

// AI Model options for dropdown
const aiModels = [
  { label: 'GPT-4', value: 'gpt-4', group: 'OpenAI' },
  { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo', group: 'OpenAI' },
  { label: 'Claude 3 Opus', value: 'claude-3-opus', group: 'Anthropic' },
  { label: 'Claude 3 Sonnet', value: 'claude-3-sonnet', group: 'Anthropic' },
  { label: 'Claude 3 Haiku', value: 'claude-3-haiku', group: 'Anthropic' },
  { label: 'Gemini Pro', value: 'gemini-pro', group: 'Google' },
]

export const FullShowcase: Story = {
  render: () => {
    const [formData, setFormData] = useState({
      name: '',
      email: '',
      password: '',
      model: 'claude-3-sonnet',
      notifications: true,
      newsletter: false,
      theme: false,
    })

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
              Kiff AI Component Library
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              A comprehensive collection of reusable UI components
            </p>
            <div className="flex justify-center gap-2 mt-4">
              <Badge variant="success" dot>Production Ready</Badge>
              <Badge variant="info">TypeScript</Badge>
              <Badge variant="secondary">Tailwind CSS</Badge>
            </div>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* User Profile Card */}
            <Card className="lg:col-span-1">
              <CardHeader divider>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">John Doe</h3>
                    <Badge variant="success" size="sm" dot>Online</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Email Notifications</span>
                    <Switch 
                      checked={formData.notifications}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, notifications: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Newsletter</span>
                    <Switch 
                      checked={formData.newsletter}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, newsletter: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Dark Theme</span>
                    <Switch 
                      checked={formData.theme}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, theme: checked }))}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter divider>
                <Button variant="outline" size="sm" fullWidth>
                  <Settings className="h-4 w-4 mr-2" />
                  Account Settings
                </Button>
              </CardFooter>
            </Card>

            {/* Registration Form */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <h3 className="text-xl font-semibold">Create Account</h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Join our platform to access AI-powered tools
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Full Name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="John Doe"
                    leftIcon={<User className="h-4 w-4" />}
                  />
                  <Input
                    label="Email Address"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="john@example.com"
                    leftIcon={<Mail className="h-4 w-4" />}
                  />
                </div>
                
                <Input
                  label="Password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  helperText="Must be at least 8 characters with numbers and letters"
                />

                <SearchableDropdown
                  label="Preferred AI Model"
                  value={formData.model}
                  options={aiModels}
                  onChange={(value) => setFormData(prev => ({ ...prev, model: value }))}
                  placeholder="Select AI model..."
                />
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline">Cancel</Button>
                <Button leftIcon={<Check className="h-4 w-4" />}>
                  Create Account
                </Button>
              </CardFooter>
            </Card>

            {/* Button Showcase */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold">Button Variants</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Button fullWidth>Primary Button</Button>
                  <Button variant="secondary" fullWidth>Secondary Button</Button>
                  <Button variant="outline" fullWidth>Outline Button</Button>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost">Small</Button>
                  <Button size="md" variant="ghost">Medium</Button>
                  <Button size="lg" variant="ghost">Large</Button>
                </div>
                <div className="space-y-2">
                  <Button 
                    variant="primary" 
                    leftIcon={<Download className="h-4 w-4" />}
                    fullWidth
                  >
                    Download
                  </Button>
                  <Button 
                    variant="destructive" 
                    rightIcon={<ArrowRight className="h-4 w-4" />}
                    fullWidth
                  >
                    Delete Account
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Badge & Status Showcase */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold">Status & Badges</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">System Status</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="success" dot size="sm">Online</Badge>
                    <Badge variant="warning" dot size="sm">Maintenance</Badge>
                    <Badge variant="error" dot size="sm">Offline</Badge>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium mb-2">Categories</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="info" size="sm">AI</Badge>
                    <Badge variant="secondary" size="sm">ML</Badge>
                    <Badge variant="default" size="sm">API</Badge>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium mb-2">Priority Levels</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="error">Critical</Badge>
                      <span className="text-xs text-slate-500">Immediate attention required</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="warning">High</Badge>
                      <span className="text-xs text-slate-500">Important but not urgent</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="info">Normal</Badge>
                      <span className="text-xs text-slate-500">Standard priority</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Input Showcase */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold">Input Components</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Search anything..."
                  leftIcon={<Search className="h-4 w-4" />}
                  variant="filled"
                />
                
                <Input
                  placeholder="Enter URL"
                  prepend={<span className="text-slate-500 text-sm">https://</span>}
                  variant="outline"
                />
                
                <Input
                  placeholder="Quick action"
                  append={<Button size="sm" variant="ghost">Go</Button>}
                />
                
                <Input
                  label="Password"
                  type="password"
                  placeholder="Enter password"
                  helperText="Your password is secure"
                />
                
                <Input
                  label="Disabled Input"
                  disabled
                  value="This field is disabled"
                />
              </CardContent>
            </Card>

            {/* Stats & Analytics Card */}
            <Card variant="elevated" className="lg:col-span-3">
              <CardHeader>
                <h3 className="font-semibold text-lg">Component Usage Analytics</h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Real-time metrics from your component library
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">24</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">Components</div>
                    <Badge variant="info" size="sm" className="mt-1">+3 this week</Badge>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">98%</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">Test Coverage</div>
                    <Badge variant="success" size="sm" className="mt-1">Excellent</Badge>
                  </div>
                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">1.2k</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">Downloads</div>
                    <Badge variant="secondary" size="sm" className="mt-1">Growing</Badge>
                  </div>
                  <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">4.8</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">Rating</div>
                    <div className="flex justify-center mt-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-3 w-3 text-yellow-400 fill-current" />
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="justify-center">
                <Button variant="outline" leftIcon={<Heart className="h-4 w-4" />}>
                  View Full Analytics
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Footer */}
          <div className="text-center mt-12 text-slate-600 dark:text-slate-400">
            <p>Built with React, TypeScript, and Tailwind CSS</p>
            <p className="text-sm mt-1">Powered by Storybook for component development</p>
          </div>
        </div>
      </div>
    )
  },
}