import React from 'react'
import { Coins, Plus } from 'lucide-react'

export type TopRightActionBarProps = {
  tokens?: number | string
  onBuyCredits?: () => void
  onOpenTokens?: () => void
  userAvatarUrl?: string
  userInitials?: string
}

// Floating, rounded, light-themed top-right action bar
export const TopRightActionBar: React.FC<TopRightActionBarProps> = ({
  tokens = '0',
  onBuyCredits,
  onOpenTokens,
  userAvatarUrl,
  userInitials = 'K',
}) => {
  return (
    <div className="pointer-events-none fixed right-4 top-3 z-50 flex items-center gap-3">
      {/* Token pill */}
      <button
        onClick={onOpenTokens}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-sm text-slate-800 shadow-sm backdrop-blur transition hover:bg-white"
      >
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-yellow-100 text-yellow-700 ring-1 ring-inset ring-yellow-200">
          <Coins className="h-3.5 w-3.5" />
        </span>
        <span className="tabular-nums">{tokens}</span>
      </button>

      {/* Buy credits with subtle color glow */}
      <button
        onClick={onBuyCredits}
        className="pointer-events-auto group relative inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-sm text-slate-800 shadow-sm backdrop-blur transition hover:bg-white"
      >
        {/* soft outer glow */}
        <span
          aria-hidden
          className="absolute -inset-1 -z-10 rounded-full opacity-60 blur-md transition-opacity group-hover:opacity-90"
          style={{
            background:
              'radial-gradient(40% 120% at 10% 50%, rgba(96,165,250,0.35), transparent 60%), radial-gradient(40% 120% at 60% 50%, rgba(34,197,94,0.30), transparent 60%), radial-gradient(40% 120% at 100% 50%, rgba(244,114,182,0.30), transparent 60%)',
          }}
        />
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white">
          <Plus className="h-3.5 w-3.5" />
        </span>
        Buy Credits
      </button>

      {/* User avatar */}
      <div className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm">
        {userAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={userAvatarUrl} alt="avatar" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm font-medium">{userInitials}</span>
        )}
      </div>
    </div>
  )
}

export default TopRightActionBar
