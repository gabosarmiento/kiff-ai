import type { Meta, StoryObj } from '@storybook/react'
import { KnowledgeBaseCreatorPage } from './KnowledgeBaseCreatorPage'
import { PageContainer } from './PageContainer'

const meta: Meta<typeof KnowledgeBaseCreatorPage> = {
  title: 'Pages/Knowledge Base Creator',
  component: KnowledgeBaseCreatorPage,
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <PageContainer fullscreen>
      <KnowledgeBaseCreatorPage />
    </PageContainer>
  ),
}
