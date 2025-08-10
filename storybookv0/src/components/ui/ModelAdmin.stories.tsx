import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { ModelAdmin, ModelItem } from './ModelAdmin'
import { AdminLayout } from './AdminLayout'

const meta: Meta<typeof ModelAdmin> = {
  title: 'Admin/ModelAdmin',
  component: ModelAdmin,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof meta>

// NOTE: The pricing values below are example placeholders for Storybook demo only.
// Please verify real pricing on provider sites when wiring to production.
const mockModels: ModelItem[] = [
  {
    id: 'groq-llama-3.1-8b-instant',
    provider: 'Groq',
    name: 'llama-3.1-8b-instant',
    family: 'Llama 3.1',
    modality: 'text',
    context_window: 131072,
    pricing: { input_per_1m: 0.05, output_per_1m: 0.08 },
    tags: ['groq', 'fast', 'general'],
    status: 'active',
    notes: 'Great latency, good for chat and general tasks.'
  },
  {
    id: 'groq-llama-3.1-70b-versatile',
    provider: 'Groq',
    name: 'llama-3.1-70b-versatile',
    family: 'Llama 3.1',
    modality: 'text',
    context_window: 131072,
    pricing: { input_per_1m: 0.59, output_per_1m: 0.79 },
    tags: ['groq', 'reasoning'],
    status: 'preview',
    notes: 'Higher quality, use for complex reasoning.'
  },
  {
    id: 'groq-mixtral-8x7b',
    provider: 'Groq',
    name: 'mixtral-8x7b',
    family: 'Mixtral',
    modality: 'text',
    context_window: 32768,
    pricing: { input_per_1m: 0.27, output_per_1m: 0.35 },
    tags: ['groq', 'coding'],
    status: 'active',
    notes: 'Solid coding performance.'
  }
]

export const Default: Story = {
  args: {
    models: mockModels,
  },
  render: (args) => (
    <AdminLayout initialActive="models">
      <ModelAdmin {...args} />
    </AdminLayout>
  ),
}

export const InteractiveDemo: Story = {
  render: () => {
    const [models, setModels] = useState<ModelItem[]>(mockModels)

    const handleCreate = (m: Omit<ModelItem, 'id'>) => {
      const newModel: ModelItem = { ...m, id: `model-${Date.now()}` }
      setModels(prev => [...prev, newModel])
    }

    const handleUpdate = (id: string, patch: Partial<ModelItem>) => {
      setModels(prev => prev.map(mm => mm.id === id ? { ...mm, ...patch } : mm))
    }

    const handleDelete = (id: string) => {
      if (window.confirm('Delete this model?')) {
        setModels(prev => prev.filter(mm => mm.id !== id))
      }
    }

    return (
      <AdminLayout initialActive="models">
        <ModelAdmin
          models={models}
          onCreateModel={handleCreate}
          onUpdateModel={handleUpdate}
          onDeleteModel={handleDelete}
        />
      </AdminLayout>
    )
  },
}

export const EmptyState: Story = {
  args: {
    models: [],
  },
  render: (args) => (
    <AdminLayout initialActive="models">
      <ModelAdmin {...args} />
    </AdminLayout>
  ),
}
