import type { Meta, StoryObj } from '@storybook/react'
import { UpgradeAccountPage } from './UpgradeAccountPage'
import { PageContainer } from './PageContainer'

const meta: Meta<typeof UpgradeAccountPage> = {
  title: 'Pages/Upgrade Account',
  component: UpgradeAccountPage,
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <PageContainer fullscreen>
      <UpgradeAccountPage />
    </PageContainer>
  ),
}
