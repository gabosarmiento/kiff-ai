import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import ApiExtractionResults, { ExtractedEndpoint } from './ApiExtractionResults'

const meta: Meta<typeof ApiExtractionResults> = {
  title: 'API Extraction Tester/Results',
  component: ApiExtractionResults,
  parameters: { layout: 'fullscreen' }
}

export default meta

type Story = StoryObj<typeof ApiExtractionResults>

const sample: ExtractedEndpoint[] = [
  { method: 'GET', path: '/v1/users', summary: 'List users', tags: ['users'], confidence: 0.92 },
  { method: 'POST', path: '/v1/users', summary: 'Create user', tags: ['users'], confidence: 0.88 },
  { method: 'GET', path: '/v1/users/{id}', summary: 'Get user', tags: ['users'], confidence: 0.9 },
  { method: 'DELETE', path: '/v1/users/{id}', summary: 'Delete user', tags: ['users'], confidence: 0.76 },
  { method: 'GET', path: '/v1/tokens/balance', summary: 'Get token balance', tags: ['billing'], confidence: 0.86 },
]

export const Default: Story = {
  render: () => {
    return (
      <div className="h-screen w-full bg-slate-50 p-6">
        <ApiExtractionResults
          sourceName="docs.agno.com"
          endpoints={sample}
          onBack={() => console.log('back')}
          onConfirm={(selected) => console.log('confirm', selected)}
        />
      </div>
    )
  }
}
