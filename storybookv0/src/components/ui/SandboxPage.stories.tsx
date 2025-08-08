import type { Meta } from '@storybook/react'
import { SandboxPage } from './SandboxPage'
import { PageContainer } from './PageContainer'

const meta: Meta<typeof SandboxPage> = {
  title: 'Kiffs/Sandbox',
  component: SandboxPage,
  parameters: {
    layout: 'fullscreen',
    // This story is intentionally disabled; use Kiffs/Flow instead.
    docs: { disable: true },
  },
}

export default meta

// No named story exports on purpose to hide this entry from the sidebar.
