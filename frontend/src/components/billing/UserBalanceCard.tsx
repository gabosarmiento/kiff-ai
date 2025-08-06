import React, { useState } from 'react'
import { 
  DollarSign, 
  TrendingDown,
  TrendingUp,
  Clock,
  Gift,
  CreditCard,
  Plus
} from 'lucide-react'

interface UserBalanceCardProps {
  balance: number
  totalSpent: number
  totalSaved: number
  freeAPIsRemaining: number
  recentTransactions?: Array<{
    id: string
    apiName: string
    amount: number
    savings: number
    timestamp: string
    type: 'charge' | 'credit' | 'free'
  }>
}

export const UserBalanceCard: React.FC<UserBalanceCardProps> = ({
  balance,
  totalSpent,
  totalSaved,
  freeAPIsRemaining,
  recentTransactions = []
}) => {
  const [showTransactions, setShowTransactions] = useState(false)

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-100 flex items-center">
          <CreditCard className="w-4 h-4 mr-2 text-green-400" />
          Account Balance
        </h3>
        <button
          onClick={() => setShowTransactions(!showTransactions)}
          className="text-xs text-cyan-400 hover:text-cyan-300"
        >
          {showTransactions ? 'Hide History' : 'Show History'}
        </button>
      </div>

      {/* Balance Display */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-400">${balance.toFixed(2)}</div>
          <div className="text-xs text-slate-400">Available Balance</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-blue-400">${totalSaved.toFixed(2)}</div>
          <div className="text-xs text-slate-400">Total Saved</div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-slate-700/30 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Spent</span>
            <TrendingDown className="w-3 h-3 text-red-400" />
          </div>
          <div className="text-sm font-medium text-slate-100">${totalSpent.toFixed(2)}</div>
        </div>
        <div className="bg-slate-700/30 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Free APIs</span>
            <Gift className="w-3 h-3 text-purple-400" />
          </div>
          <div className="text-sm font-medium text-slate-100">{freeAPIsRemaining} left</div>
        </div>
      </div>

      {/* Add Credits Button */}
      <button className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg py-2 px-4 text-sm font-medium transition-all duration-200 flex items-center justify-center space-x-2">
        <Plus className="w-4 h-4" />
        <span>Add Credits</span>
      </button>

      {/* Transaction History */}
      {showTransactions && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          <h4 className="text-sm font-medium text-slate-300 mb-3">Recent Activity</h4>
          {recentTransactions.length > 0 ? (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {recentTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between py-2 px-3 bg-slate-700/20 rounded">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      transaction.type === 'free' ? 'bg-green-400' : 
                      transaction.type === 'credit' ? 'bg-blue-400' : 'bg-red-400'
                    }`} />
                    <div>
                      <div className="text-xs font-medium text-slate-200">{transaction.apiName}</div>
                      <div className="text-xs text-slate-400">
                        {new Date(transaction.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-medium ${
                      transaction.type === 'free' ? 'text-green-400' :
                      transaction.type === 'credit' ? 'text-blue-400' : 'text-red-400'
                    }`}>
                      {transaction.type === 'free' ? 'FREE' : 
                       transaction.type === 'credit' ? `+$${transaction.amount.toFixed(2)}` :
                       `-$${transaction.amount.toFixed(2)}`}
                    </div>
                    {transaction.savings > 0 && (
                      <div className="text-xs text-green-400">
                        Saved ${transaction.savings.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <Clock className="w-6 h-6 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No transactions yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}