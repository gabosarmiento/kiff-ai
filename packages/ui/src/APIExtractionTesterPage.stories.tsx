import type { Meta, StoryObj } from '@storybook/react'
import { APIExtractionTesterPage } from './APIExtractionTesterPage'
import { PageContainer } from './PageContainer'
import './APIExtractionTesterPage.stories.css'

const meta: Meta<typeof APIExtractionTesterPage> = {
  title: 'Pages/API Extraction Tester',
  component: APIExtractionTesterPage,
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div className="storybook-api-extraction-tester">
      <PageContainer fullscreen>
        <APIExtractionTesterPage />
      </PageContainer>
    </div>
  ),
}
