import React from 'react'
import { DollarSign, Wallet } from 'lucide-react'

interface SidebarBalanceProps {
  balance: number
}

export const SidebarBalance: React.FC<SidebarBalanceProps> = ({ balance }) => {
  return (
    <div className="px-4 pb-3">
      <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Wallet className="w-4 h-4 text-green-400" />
            <span className="text-xs text-slate-400">Balance</span>
          </div>
          <div className="text-sm font-semibold text-green-400">
            ${balance.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  )
}
