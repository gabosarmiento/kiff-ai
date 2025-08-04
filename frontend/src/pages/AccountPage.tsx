import { useState } from 'react'
import { User, Edit2, Mail, Trash2, Save, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'
import { apiRequest } from '@/utils/apiConfig'

interface EditableFieldProps {
  label: string
  value: string
  isEditing: boolean
  onEdit: () => void
  onSave: (newValue: string) => void
  onCancel: () => void
  placeholder?: string
  type?: 'text' | 'email'
}

function EditableField({ 
  label, 
  value, 
  isEditing, 
  onEdit, 
  onSave, 
  onCancel, 
  placeholder,
  type = 'text' 
}: EditableFieldProps) {
  const [inputValue, setInputValue] = useState(value)

  const handleSave = () => {
    if (inputValue.trim() !== value) {
      onSave(inputValue.trim())
    } else {
      onCancel()
    }
  }

  const handleCancel = () => {
    setInputValue(value)
    onCancel()
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-300">
        {label}
      </label>
      <div className="flex items-center space-x-3">
        {isEditing ? (
          <>
            <input
              type={type}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholder}
              className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 transition-all duration-200"
              autoFocus
            />
            <button
              onClick={handleSave}
              className="p-2 text-green-400 hover:bg-green-400/10 rounded-lg transition-colors"
              title="Save"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={handleCancel}
              className="p-2 text-slate-400 hover:bg-slate-700/50 rounded-lg transition-colors"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 px-3 py-2 text-slate-100 bg-slate-800/30 rounded-lg border border-slate-700/50">
              {value || placeholder}
            </span>
            <button
              onClick={onEdit}
              className="p-2 text-cyan-400 hover:bg-cyan-400/10 rounded-lg transition-colors"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function AccountPage() {
  const { user, refreshUser, logout } = useAuth()
  const [editingField, setEditingField] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const updateUserField = async (field: string, value: string) => {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) {
        toast.error('Authentication required')
        return
      }

      const response = await apiRequest('/api/auth/update-profile', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': '4485db48-71b7-47b0-8128-c6dca5be352d'
        },
        body: JSON.stringify({ [field]: value })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.status === 'success') {
          toast.success(`${field === 'full_name' ? 'Name' : 'Email'} updated successfully`)
          await refreshUser()
          setEditingField(null)
        } else {
          toast.error(result.message || 'Update failed')
        }
      } else {
        const errorData = await response.json()
        toast.error(errorData.detail || 'Update failed')
      }
    } catch (error) {
      console.error('Update failed:', error)
      toast.error('Update failed. Please try again.')
    }
  }

  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true)
      const token = localStorage.getItem('authToken')
      if (!token) {
        toast.error('Authentication required')
        return
      }

      const response = await apiRequest('/api/auth/delete-account', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': '4485db48-71b7-47b0-8128-c6dca5be352d'
        }
      })

      if (response.ok) {
        toast.success('Account deleted successfully')
        logout()
      } else {
        const errorData = await response.json()
        toast.error(errorData.detail || 'Account deletion failed')
      }
    } catch (error) {
      console.error('Account deletion failed:', error)
      toast.error('Account deletion failed. Please try again.')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center py-12">
          <p className="text-slate-400">Loading account information...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">My Account</h1>
        <p className="text-slate-400">Manage your account information and preferences</p>
      </div>

      {/* Account Card */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
        {/* Profile Section */}
        <div className="p-8">
          <div className="flex items-start space-x-6 mb-8">
            {/* Simple Avatar with Email Initial */}
            <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {user.email.charAt(0).toUpperCase()}
            </div>

            {/* Profile Info */}
            <div className="flex-1 space-y-1">
              <h2 className="text-xl font-semibold text-slate-100">
                {user.full_name || user.username}
              </h2>
              <p className="text-slate-400 flex items-center">
                <Mail className="w-4 h-4 mr-2" />
                {user.email}
              </p>
              <p className="text-sm text-slate-500">
                Member since {new Date(user.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Editable Fields */}
          <div className="space-y-6">
            <EditableField
              label="Name"
              value={user.full_name || user.username}
              isEditing={editingField === 'full_name'}
              onEdit={() => setEditingField('full_name')}
              onSave={(value) => updateUserField('full_name', value)}
              onCancel={() => setEditingField(null)}
              placeholder="Enter your name"
            />

            {/* Email - Read Only */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Email
              </label>
              <div className="flex items-center space-x-3">
                <span className="flex-1 px-3 py-2 text-slate-100 bg-slate-800/30 rounded-lg border border-slate-700/50">
                  {user.email}
                </span>
                <span className="text-xs text-slate-500 px-3">Account identifier</span>
              </div>
            </div>
          </div>
        </div>

        {/* Account Data Section */}
        <div className="px-8 py-6 bg-slate-900/30 border-t border-slate-700/50">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Account's data</h3>
          <p className="text-slate-400 text-sm mb-4">The user data of your account.</p>
          
          <div className="flex items-center justify-between py-3 px-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                <User className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-slate-200 font-medium">kiff</p>
                <p className="text-sm text-slate-400">Your Kiff AI application data</p>
              </div>
            </div>
          </div>
        </div>

        {/* Delete Account Section */}
        <div className="px-8 py-6 border-t border-slate-700/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Delete Account</h3>
              <p className="text-slate-400 text-sm">Permanently delete your account and all associated data</p>
            </div>
            
            {showDeleteConfirm ? (
              <div className="flex items-center space-x-3">
                <p className="text-sm text-slate-300">Are you sure?</p>
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded-lg text-sm transition-colors flex items-center space-x-2"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-slate-300 hover:bg-slate-700/50 disabled:opacity-50 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 text-red-400 border border-red-400/50 hover:bg-red-400/10 hover:border-red-400 rounded-lg text-sm transition-colors flex items-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Account</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}