import React from 'react'
import { useNavigate } from 'react-router-dom'
import { XCircle, RotateCcw, ArrowLeft, HelpCircle } from 'lucide-react'

export const SubscriptionCancel: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {/* Cancel Icon */}
        <div className="w-20 h-20 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-10 h-10 text-white" />
        </div>

        {/* Cancel Message */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Subscription Cancelled
        </h1>
        
        <p className="text-gray-600 mb-6">
          Your subscription upgrade was cancelled. No charges were made to your account.
        </p>

        {/* Still Available Features */}
        <div className="bg-blue-50 rounded-xl p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">You still have access to:</h3>
          
          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
              <span>100 API calls per month (Free plan)</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
              <span>Pay-per-token option (pay only for tokens used)</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
              <span>Basic API documentation access</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
              <span>Community support</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/')}
            className="w-full bg-gradient-to-r from-orange-500 to-pink-500 text-white py-3 px-6 rounded-lg font-medium hover:from-orange-600 hover:to-pink-600 transition-all duration-200 flex items-center justify-center space-x-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Try Again Later</span>
          </button>
          
          <button
            onClick={() => navigate('/api-gallery')}
            className="w-full border border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-50 transition-all duration-200 flex items-center justify-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Continue with Free Plan</span>
          </button>
        </div>

        {/* Help Section */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-center text-sm text-gray-500">
            <HelpCircle className="w-4 h-4 mr-2" />
            <span>
              Need help? {' '}
              <a href="#" className="text-orange-600 hover:text-orange-700 underline">
                Contact support
              </a>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}