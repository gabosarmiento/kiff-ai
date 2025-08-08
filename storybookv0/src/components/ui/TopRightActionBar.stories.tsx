import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import TopRightActionBar from './TopRightActionBar'

const meta: Meta<typeof TopRightActionBar> = {
  title: 'Navigation/TopRightActionBar',
  component: TopRightActionBar,
  parameters: { layout: 'fullscreen' }
}

export default meta

type Story = StoryObj<typeof TopRightActionBar>

export const Default: Story = {
  render: () => {
    return (
      <div className="relative h-screen w-full bg-slate-50">
        <TopRightActionBar
          tokens={10.0}
          onOpenTokens={() => console.log('open tokens')}
          onBuyCredits={() => console.log('buy credits')}
          userInitials="KS"
        />
        <main className="p-6">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-lg font-semibold text-slate-900">Floating action bar</h1>
            <p className="mt-2 text-sm text-slate-600">Top-right rounded actions for user, token balance, and buy credits with a subtle glow.</p>
          </div>
        </main>
      </div>
    )
  }
}
