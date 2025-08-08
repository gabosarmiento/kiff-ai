import type { Meta, StoryObj } from '@storybook/react'
import { Card, CardHeader, CardContent, CardFooter } from './Card'
import { Button } from './Button'
import { Badge } from './Badge'
import { Settings, User, Mail } from 'lucide-react'

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'outlined', 'elevated', 'filled'],
    },
    padding: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg', 'xl'],
    },
    rounded: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg', 'xl', 'full'],
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

// Basic card
export const Default: Story = {
  render: (args) => (
    <Card {...args} className="w-80">
      <CardContent>
        <p>This is a simple card with default styling.</p>
      </CardContent>
    </Card>
  ),
}

// Card variants
export const Variants: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 w-full max-w-4xl">
      <Card variant="default" className="p-4">
        <h3 className="font-semibold">Default Card</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">Standard card with border</p>
      </Card>
      <Card variant="outlined" className="p-4">
        <h3 className="font-semibold">Outlined Card</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">Card with thicker border</p>
      </Card>
      <Card variant="elevated" className="p-4">
        <h3 className="font-semibold">Elevated Card</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">Card with shadow</p>
      </Card>
      <Card variant="filled" className="p-4">
        <h3 className="font-semibold">Filled Card</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">Card with background fill</p>
      </Card>
    </div>
  ),
}

// Complete card with header, content, and footer
export const Complete: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader divider>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">User Profile</h3>
          <Badge variant="success" dot>Active</Badge>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">Manage your account settings</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="font-medium">John Doe</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">john.doe@example.com</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-sm">
            <Mail className="h-4 w-4 text-slate-400" />
            <span>Email notifications enabled</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <Settings className="h-4 w-4 text-slate-400" />
            <span>Account verified</span>
          </div>
        </div>
      </CardContent>
      <CardFooter divider className="justify-between">
        <Button variant="outline" size="sm">Edit Profile</Button>
        <Button size="sm">Save Changes</Button>
      </CardFooter>
    </Card>
  ),
}

// Card sizes and padding
export const PaddingVariants: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4 w-full max-w-4xl">
      <Card padding="sm">
        <p>Small padding</p>
      </Card>
      <Card padding="md">
        <p>Medium padding</p>
      </Card>
      <Card padding="lg">
        <p>Large padding</p>
      </Card>
    </div>
  ),
}

// Rounded variants
export const RoundedVariants: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4 w-full max-w-4xl">
      <Card rounded="sm" className="p-4">
        <p>Small rounded</p>
      </Card>
      <Card rounded="lg" className="p-4">
        <p>Large rounded</p>
      </Card>
      <Card rounded="xl" className="p-4">
        <p>Extra large rounded</p>
      </Card>
    </div>
  ),
}

// Interactive card example
export const InteractiveCard: Story = {
  render: () => (
    <Card className="w-80 cursor-pointer hover:shadow-lg transition-shadow">
      <CardHeader>
        <h3 className="text-lg font-semibold">Feature Card</h3>
        <Badge variant="info" size="sm">New</Badge>
      </CardHeader>
      <CardContent>
        <p className="text-slate-600 dark:text-slate-400">
          Click me to see hover effects. This card demonstrates interactive states.
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="ghost" size="sm" fullWidth>
          Learn More
        </Button>
      </CardFooter>
    </Card>
  ),
}

// Minimal + Elegant normalized card (KIFF brand demo)
export const MinimalElegant: Story = {
  render: () => (
    <div
      // You can change this once we lock the brand color from the logo
      style={{ ['--kiff-primary' as any]: '#2AA7F7' }}
      className="w-full max-w-md"
    >
      <div className="h-1.5 w-full rounded-t-lg" style={{ backgroundColor: 'var(--kiff-primary)' }} />
      <Card
        // Normalize: solid surfaces, subtle border/shadow, 8px radius
        className="rounded-lg shadow-sm hover:shadow-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
        padding="md"
      >
        <CardHeader>
          <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Minimal KIFF Card
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Elegant, neutral, and brand-accented without gradients.
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <div
              className="h-8 w-8 rounded-full"
              style={{ backgroundColor: 'color-mix(in srgb, var(--kiff-primary) 22%, transparent)' }}
            />
            <div className="space-y-1">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                This example demonstrates the new normalized look & feel. Try toggling the Storybook theme toolbar to verify light/dark.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end pt-4">
          <button
            className="inline-flex items-center justify-center rounded-md px-4 h-9 text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--kiff-primary)' }}
          >
            Primary Action
          </button>
        </CardFooter>
      </Card>
    </div>
  ),
}