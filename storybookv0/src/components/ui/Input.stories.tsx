import type { Meta, StoryObj } from '@storybook/react'
import { Input } from './Input'
import { Button } from './Button'
import { Search, Mail, User, DollarSign } from 'lucide-react'

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'filled', 'outline'],
    },
    inputSize: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'tel', 'url'],
    },
    disabled: {
      control: 'boolean',
    },
    fullWidth: {
      control: 'boolean',
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

// Basic inputs
export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
  },
}

export const WithLabel: Story = {
  args: {
    label: 'Email Address',
    placeholder: 'john.doe@example.com',
    type: 'email',
  },
}

export const WithError: Story = {
  args: {
    label: 'Username',
    placeholder: 'Enter username',
    error: 'Username must be at least 3 characters long',
    value: 'ab',
  },
}

export const WithHelperText: Story = {
  args: {
    label: 'Password',
    type: 'password',
    helperText: 'Must contain at least 8 characters with numbers and letters',
  },
}

// Variants
export const Variants: Story = {
  render: () => (
    <div className="space-y-4 w-80">
      <Input variant="default" placeholder="Default variant" label="Default" />
      <Input variant="filled" placeholder="Filled variant" label="Filled" />
      <Input variant="outline" placeholder="Outline variant" label="Outline" />
    </div>
  ),
}

// Sizes
export const Sizes: Story = {
  render: () => (
    <div className="space-y-4 w-80">
      <Input inputSize="sm" placeholder="Small input" label="Small" />
      <Input inputSize="md" placeholder="Medium input" label="Medium" />
      <Input inputSize="lg" placeholder="Large input" label="Large" />
    </div>
  ),
}

// With icons
export const WithLeftIcon: Story = {
  args: {
    leftIcon: <Search className="h-4 w-4" />,
    placeholder: 'Search...',
    label: 'Search',
  },
}

export const WithRightIcon: Story = {
  args: {
    rightIcon: <Mail className="h-4 w-4" />,
    placeholder: 'Enter email',
    label: 'Email',
    type: 'email',
  },
}

// Password input (shows eye toggle)
export const Password: Story = {
  args: {
    type: 'password',
    placeholder: 'Enter password',
    label: 'Password',
  },
}

// With prepend/append
export const WithPrepend: Story = {
  args: {
    prepend: <span className="text-slate-500">https://</span>,
    placeholder: 'example.com',
    label: 'Website URL',
  },
}

export const WithAppend: Story = {
  args: {
    append: <Button variant="ghost" size="sm">Go</Button>,
    placeholder: 'Search query',
    label: 'Quick Search',
  },
}

export const WithPrependAndAppend: Story = {
  args: {
    prepend: <DollarSign className="h-4 w-4 text-slate-500" />,
    append: <span className="text-slate-500">USD</span>,
    placeholder: '0.00',
    label: 'Price',
    type: 'number',
  },
}

// States
export const Disabled: Story = {
  args: {
    placeholder: 'Disabled input',
    label: 'Disabled',
    disabled: true,
    value: 'Cannot edit this',
  },
}

export const FullWidth: Story = {
  args: {
    placeholder: 'Full width input',
    label: 'Full Width',
    fullWidth: true,
  },
  parameters: {
    layout: 'padded',
  },
}

// Form example
export const FormExample: Story = {
  render: () => (
    <div className="space-y-4 w-96">
      <Input
        label="First Name"
        placeholder="John"
        leftIcon={<User className="h-4 w-4" />}
      />
      <Input
        label="Email"
        type="email"
        placeholder="john.doe@example.com"
        leftIcon={<Mail className="h-4 w-4" />}
      />
      <Input
        label="Password"
        type="password"
        helperText="Must be at least 8 characters"
      />
      <Input
        label="Confirm Password"
        type="password"
        error="Passwords do not match"
      />
      <div className="pt-4">
        <Button fullWidth>Create Account</Button>
      </div>
    </div>
  ),
}

// Interactive examples
export const AllStates: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 w-full max-w-4xl">
      <div className="space-y-4">
        <h3 className="font-semibold">Normal States</h3>
        <Input placeholder="Normal" />
        <Input placeholder="With value" value="Has content" />
        <Input placeholder="Focused" autoFocus />
      </div>
      <div className="space-y-4">
        <h3 className="font-semibold">Error & Disabled</h3>
        <Input placeholder="Error state" error="Something went wrong" />
        <Input placeholder="Disabled" disabled />
        <Input placeholder="Readonly" readOnly value="Read only content" />
      </div>
    </div>
  ),
}