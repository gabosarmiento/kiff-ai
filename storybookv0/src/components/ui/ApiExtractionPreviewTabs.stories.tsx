import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import ApiExtractionPreviewTabs, { ExtractedDocument } from './ApiExtractionPreviewTabs'

const meta: Meta<typeof ApiExtractionPreviewTabs> = {
  title: 'API Extraction Tester/Preview Tabs',
  component: ApiExtractionPreviewTabs,
  parameters: { layout: 'fullscreen' }
}

export default meta

type Story = StoryObj<typeof ApiExtractionPreviewTabs>

const docs: ExtractedDocument[] = [
  {
    id: 'doc1',
    title: 'Users API (text)',
    text: 'This is the extracted text summary for the Users endpoints. It comes from PDF and HTML mix.\n\n- GET /v1/users: List users\n- POST /v1/users: Create user\n- GET /v1/users/{id}: Retrieve user',
    markdown: '# Users API\n\n**Endpoints**\n\n```http\nGET /v1/users\nPOST /v1/users\nGET /v1/users/{id}\n```',
    raw: '{"openapi":"3.1.0","paths":{"/v1/users":{"get":{},"post":{}}}}'
  },
  {
    id: 'doc2',
    title: 'Billing (markdown)',
    text: 'High-level billing overview and token accounting.',
    markdown: '## Billing\n\n- `GET /v1/tokens/balance`\n- `POST /v1/tokens/purchase`\n\n```json\n{"balance": 1000}\n```',
    raw: 'balance: 1000\nlimits:\n  per_minute: 120'
  },
  {
    id: 'doc3',
    title: 'Raw Spec Fragment',
    raw: 'paths:\n  /v1/models:\n    get:\n      summary: List models\n      responses:\n        200:\n          description: ok\n',
    text: 'YAML fragment for models list.',
    markdown: '### Models\nYAML fragment for models list.'
  }
]

export const Default: Story = {
  render: () => (
    <div className="h-screen w-full bg-slate-50 p-6">
      <ApiExtractionPreviewTabs
        docs={docs}
        stats={{ durationMs: 1840, totalTokens: 742, totalChunks: docs.length, costUSD: 0.0021 }}
        title="API Extraction Tester"
        onBack={() => window.history.back()}
      />
    </div>
  )
}
