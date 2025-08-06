import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle, Sparkles, ArrowRight, Crown } from 'lucide-react'

export const SubscriptionSuccess: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [sessionId] = useState(searchParams.get('session_id'))

  useEffect(() => {
    // In a real app, you'd verify the session with your backend here
    if (sessionId) {
      console.log('Subscription successful! Session ID:', sessionId)
    }
  }, [sessionId])

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-pink-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-white" />
        </div>

        {/* Success Message */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome to Pro! 🎉
        </h1>
        
        <p className="text-gray-600 mb-6">
          Your subscription has been activated successfully. You now have access to all premium features.
        </p>

        {/* Pro Features */}
        <div className="bg-gradient-to-r from-orange-50 to-pink-50 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-center mb-3">
            <Crown className="w-6 h-6 text-orange-500 mr-2" />
            <h3 className="font-semibold text-gray-900">Pro Plan Active</h3>
          </div>
          
          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex items-center">
              <Sparkles className="w-4 h-4 text-orange-500 mr-2" />
              <span>Unlimited API calls</span>
            </div>
            <div className="flex items-center">
              <Sparkles className="w-4 h-4 text-orange-500 mr-2" />
              <span>5x faster processing</span>
            </div>
            <div className="flex items-center">
              <Sparkles className="w-4 h-4 text-orange-500 mr-2" />
              <span>Advanced AI capabilities</span>
            </div>
            <div className="flex items-center">
              <Sparkles className="w-4 h-4 text-orange-500 mr-2" />
              <span>Premium support</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/api-gallery')}
            className="w-full bg-gradient-to-r from-orange-500 to-pink-500 text-white py-3 px-6 rounded-lg font-medium hover:from-orange-600 hover:to-pink-600 transition-all duration-200 flex items-center justify-center space-x-2"
          >
            <span>Start Using Pro Features</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full border border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-50 transition-all duration-200"
          >
            Go to Dashboard
          </button>
        </div>

        {/* Receipt Info */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            A receipt has been sent to your email address. 
            <br />
            Session ID: {sessionId?.slice(0, 20)}...
          </p>
        </div>
      </div>
    </div>
  )
}