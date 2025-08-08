import type { Meta, StoryObj } from '@storybook/react'
import { Badge } from './Badge'

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'success', 'warning', 'error', 'info'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    rounded: {
      control: 'boolean',
    },
    dot: {
      control: 'boolean',
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

// Basic badge
export const Default: Story = {
  args: {
    children: 'Badge',
  },
}

// Variants
export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="error">Error</Badge>
      <Badge variant="info">Info</Badge>
    </div>
  ),
}

// Sizes
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Badge size="sm">Small</Badge>
      <Badge size="md">Medium</Badge>
      <Badge size="lg">Large</Badge>
    </div>
  ),
}

// With dot indicator
export const WithDot: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="success" dot>Online</Badge>
      <Badge variant="warning" dot>Away</Badge>
      <Badge variant="error" dot>Offline</Badge>
      <Badge variant="info" dot>Busy</Badge>
    </div>
  ),
}

// Rounded variants
export const RoundedVariants: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex gap-2">
        <span className="text-sm font-medium">Rounded (default):</span>
        <Badge>Rounded</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="error">Error</Badge>
      </div>
      <div className="flex gap-2">
        <span className="text-sm font-medium">Square corners:</span>
        <Badge rounded={false}>Square</Badge>
        <Badge variant="success" rounded={false}>Success</Badge>
        <Badge variant="error" rounded={false}>Error</Badge>
      </div>
    </div>
  ),
}

// Status indicators
export const StatusIndicators: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium mb-2">User Status</h4>
        <div className="flex gap-2">
          <Badge variant="success" dot size="sm">Active</Badge>
          <Badge variant="warning" dot size="sm">Pending</Badge>
          <Badge variant="error" dot size="sm">Suspended</Badge>
        </div>
      </div>
      <div>
        <h4 className="font-medium mb-2">System Status</h4>
        <div className="flex gap-2">
          <Badge variant="success">Operational</Badge>
          <Badge variant="warning">Maintenance</Badge>
          <Badge variant="error">Outage</Badge>
        </div>
      </div>
      <div>
        <h4 className="font-medium mb-2">Priority Levels</h4>
        <div className="flex gap-2">
          <Badge variant="error">High</Badge>
          <Badge variant="warning">Medium</Badge>
          <Badge variant="info">Low</Badge>
        </div>
      </div>
    </div>
  ),
}

// Count badges
export const CountBadges: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <div className="relative">
        <span className="text-slate-700 dark:text-slate-300">Notifications</span>
        <Badge variant="error" size="sm" className="absolute -top-2 -right-2">3</Badge>
      </div>
      <div className="relative">
        <span className="text-slate-700 dark:text-slate-300">Messages</span>
        <Badge variant="info" size="sm" className="absolute -top-2 -right-2">12</Badge>
      </div>
      <div className="relative">
        <span className="text-slate-700 dark:text-slate-300">Updates</span>
        <Badge variant="success" size="sm" className="absolute -top-2 -right-2">99+</Badge>
      </div>
    </div>
  ),
}

// Tags example
export const Tags: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium mb-2">Technologies</h4>
        <div className="flex flex-wrap gap-1">
          <Badge variant="info" size="sm">React</Badge>
          <Badge variant="info" size="sm">TypeScript</Badge>
          <Badge variant="info" size="sm">Tailwind</Badge>
          <Badge variant="info" size="sm">Storybook</Badge>
        </div>
      </div>
      <div>
        <h4 className="font-medium mb-2">Categories</h4>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" size="sm">Frontend</Badge>
          <Badge variant="secondary" size="sm">UI/UX</Badge>
          <Badge variant="secondary" size="sm">Design System</Badge>
        </div>
      </div>
    </div>
  ),
}

// All combinations
export const AllCombinations: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h4 className="font-medium mb-3">All Variants × Sizes</h4>
        {(['sm', 'md', 'lg'] as const).map(size => (
          <div key={size} className="mb-3">
            <span className="text-xs text-slate-500 uppercase tracking-wide mr-4">Size {size}:</span>
            <div className="inline-flex gap-1">
              {(['default', 'secondary', 'success', 'warning', 'error', 'info'] as const).map(variant => (
                <Badge key={`${size}-${variant}`} variant={variant} size={size}>
                  {variant}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
}