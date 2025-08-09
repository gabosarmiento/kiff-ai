import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { UserAdmin, UserItem } from './UserAdmin'

const meta: Meta<typeof UserAdmin> = {
  title: 'Admin/UserAdmin',
  component: UserAdmin,
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

type Story = StoryObj<typeof meta>

const demoUsers: UserItem[] = [
  { id: 'u1', name: 'Alice Johnson', email: 'alice@example.com', role: 'admin', plan: 'pro', tokens_used: 2_400_000, tokens_month: 120_000, credits_usd: 32.5, tokens_purchased: 3_000_000, last_active: new Date().toISOString() },
  { id: 'u2', name: 'Bob Smith', email: 'bob@example.com', role: 'member', plan: 'free', tokens_used: 600_000, tokens_month: 80_000, credits_usd: 4.2, tokens_purchased: 800_000, last_active: new Date().toISOString() },
  { id: 'u3', name: 'Carol White', email: 'carol@example.com', role: 'member', plan: 'enterprise', tokens_used: 12_500_000, tokens_month: 1_100_000, credits_usd: 420.0, tokens_purchased: 14_000_000, last_active: new Date().toISOString() },
]

export const Default: Story = {
  args: {
    users: demoUsers,
  },
  render: (args) => (
    <UserAdmin {...args} />
  ),
}

export const InteractiveDemo: Story = {
  render: () => {
    const [users, setUsers] = useState<UserItem[]>(demoUsers)

    const createUser = (u: Omit<UserItem,'id'>) => setUsers(prev => [...prev, { ...u, id: `user-${Date.now()}` }])
    const updateUser = (id: string, patch: Partial<UserItem>) => setUsers(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x))
    const deleteUser = (id: string) => setUsers(prev => prev.filter(x => x.id !== id))

    return (
      <UserAdmin users={users} onCreateUser={createUser} onUpdateUser={updateUser} onDeleteUser={deleteUser} />
    )
  }
}

export const EmptyState: Story = {
  args: {
    users: [],
  },
  render: (args) => (
    <UserAdmin {...args} />
  ),
}
