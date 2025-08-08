import type { Meta, StoryObj } from '@storybook/react'
import { SandboxRunningPage } from './SandboxRunningPage'

const meta: Meta<typeof SandboxRunningPage> = {
  title: 'Pages/Sandbox Running',
  component: SandboxRunningPage,
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <SandboxRunningPage />,
}
