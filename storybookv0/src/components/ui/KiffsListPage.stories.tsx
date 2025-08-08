import type { Meta, StoryObj } from '@storybook/react'
import { KiffsListPage } from './KiffsListPage'
import { PageContainer } from './PageContainer'

const meta: Meta<typeof KiffsListPage> = {
  title: 'Pages/Kiffs',
  component: KiffsListPage,
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <PageContainer fullscreen>
      <KiffsListPage />
    </PageContainer>
  ),
}
