import type { Meta, StoryObj } from '@storybook/react'
import { SandboxPage } from './SandboxPage'
import { PageContainer } from './PageContainer'

const meta: Meta<typeof SandboxPage> = {
  title: 'Pages/Sandbox',
  component: SandboxPage,
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <PageContainer fullscreen>
      <SandboxPage />
    </PageContainer>
  ),
}
