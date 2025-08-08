import type { Meta, StoryObj } from '@storybook/react'
import { AccountPage } from './AccountPage'
import { PageContainer } from './PageContainer'

const meta: Meta<typeof AccountPage> = {
  title: 'Pages/Account',
  component: AccountPage,
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <PageContainer fullscreen>
      <AccountPage />
    </PageContainer>
  ),
}
