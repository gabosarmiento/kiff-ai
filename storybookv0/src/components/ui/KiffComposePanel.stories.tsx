import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import KiffComposePanel from './KiffComposePanel'

const meta: Meta<typeof KiffComposePanel> = {
  title: 'Kiffs/Compose',
  component: KiffComposePanel,
  parameters: { layout: 'fullscreen' }
}

export default meta

type Story = StoryObj<typeof KiffComposePanel>

export const Default: Story = {
  render: () => (
    <div className="h-screen w-full bg-slate-50 p-6">
      <KiffComposePanel onSubmit={(p)=>console.log('compose submit', p)} />
    </div>
  )
}
