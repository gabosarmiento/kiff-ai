import type { Meta, StoryObj } from '@storybook/react'
import { Switch } from './switch'
import { useState } from 'react'

const meta: Meta<typeof Switch> = {
  title: 'UI/Switch',
  component: Switch,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    checked: {
      control: 'boolean',
    },
    disabled: {
      control: 'boolean',
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

// Basic switch
export const Default: Story = {
  args: {
    checked: false,
  },
}

export const Checked: Story = {
  args: {
    checked: true,
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
}

export const DisabledChecked: Story = {
  args: {
    checked: true,
    disabled: true,
  },
}

// Interactive example
export const Interactive: Story = {
  render: () => {
    const [checked, setChecked] = useState(false)
    
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <Switch checked={checked} onCheckedChange={setChecked} />
          <span className="text-sm">
            {checked ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <p className="text-xs text-slate-500 max-w-xs">
          Click the switch to toggle between on and off states
        </p>
      </div>
    )
  },
}

// Settings example
export const SettingsExample: Story = {
  render: () => {
    const [notifications, setNotifications] = useState(true)
    const [darkMode, setDarkMode] = useState(false)
    const [autoSave, setAutoSave] = useState(true)
    
    return (
      <div className="space-y-4 w-80">
        <h3 className="font-semibold text-lg">Settings</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Push Notifications</label>
              <p className="text-xs text-slate-500">Receive notifications on your device</p>
            </div>
            <Switch checked={notifications} onCheckedChange={setNotifications} />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Dark Mode</label>
              <p className="text-xs text-slate-500">Use dark theme</p>
            </div>
            <Switch checked={darkMode} onCheckedChange={setDarkMode} />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Auto Save</label>
              <p className="text-xs text-slate-500">Automatically save changes</p>
            </div>
            <Switch checked={autoSave} onCheckedChange={setAutoSave} />
          </div>
          
          <div className="flex items-center justify-between opacity-50">
            <div>
              <label className="text-sm font-medium">Beta Features</label>
              <p className="text-xs text-slate-500">Access experimental features</p>
            </div>
            <Switch checked={false} disabled />
          </div>
        </div>
      </div>
    )
  },
}

// All states
export const AllStates: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="font-medium mb-2">Normal</h4>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Switch checked={false} />
              <span className="text-sm">Off</span>
            </div>
            <div className="flex items-center space-x-2">
              <Switch checked={true} />
              <span className="text-sm">On</span>
            </div>
          </div>
        </div>
        
        <div>
          <h4 className="font-medium mb-2">Disabled</h4>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Switch checked={false} disabled />
              <span className="text-sm text-slate-400">Off (Disabled)</span>
            </div>
            <div className="flex items-center space-x-2">
              <Switch checked={true} disabled />
              <span className="text-sm text-slate-400">On (Disabled)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
}