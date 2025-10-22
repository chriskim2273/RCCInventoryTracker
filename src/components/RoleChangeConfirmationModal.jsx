import { useState } from 'react'
import { AlertTriangle, User, Shield, Eye, UserCog, Clock } from 'lucide-react'
import Modal from './Modal'

const RoleChangeConfirmationModal = ({ isOpen, onClose, onConfirm, user, newRole, currentUserEmail }) => {
  const [confirmations, setConfirmations] = useState({
    understand: false,
    reviewed: false,
    irreversible: false
  })
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const allConfirmed =
    confirmations.understand && confirmations.reviewed && confirmations.irreversible && email === currentUserEmail

  const handleConfirm = async () => {
    if (!allConfirmed) return

    setIsSubmitting(true)
    try {
      await onConfirm()
      handleClose()
    } catch (error) {
      console.error('Error changing role:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setConfirmations({
      understand: false,
      reviewed: false,
      irreversible: false
    })
    setEmail('')
    setIsSubmitting(false)
    onClose()
  }

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4" />
      case 'coordinator':
        return <UserCog className="w-4 h-4" />
      case 'editor':
        return <UserCog className="w-4 h-4" />
      case 'viewer':
        return <Eye className="w-4 h-4" />
      case 'pending':
        return <Clock className="w-4 h-4" />
      default:
        return <User className="w-4 h-4" />
    }
  }

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'coordinator':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
      case 'editor':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'viewer':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'pending':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const getRoleDescription = (role) => {
    switch (role) {
      case 'admin':
        return 'Full system access including user management and all inventory operations'
      case 'coordinator':
        return 'Full inventory access (items, locations, categories) but cannot change user roles'
      case 'editor':
        return 'Can view and modify inventory items, locations, and categories'
      case 'viewer':
        return 'Read-only access to inventory data'
      case 'pending':
        return 'No access - user must wait for role assignment'
      default:
        return 'Unknown role'
    }
  }

  const isChangingOwnRole = user?.email === currentUserEmail
  const isDowngradingFromAdmin = user?.role === 'admin' && newRole !== 'admin'

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Confirm Role Change</h2>
          <p className="text-sm text-muted-foreground">This action will modify user permissions</p>
        </div>
      </div>

      {/* User Account Details */}
      <div className="bg-muted/50 rounded-lg p-4 mb-6 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <User className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm text-foreground">Account Details</h3>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Email Address</p>
            <p className="text-sm font-medium text-foreground">{user?.email}</p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Account Created</p>
            <p className="text-sm text-foreground">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }) : 'Unknown'}
            </p>
          </div>

          {/* Role Change Visualization */}
          <div className="pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Role Change</p>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium capitalize ${getRoleColor(user?.role)}`}>
                  {getRoleIcon(user?.role)}
                  {user?.role || 'Unknown'}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {getRoleDescription(user?.role)}
                </p>
              </div>

              <div className="text-muted-foreground">→</div>

              <div className="flex-1">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium capitalize ${getRoleColor(newRole)}`}>
                  {getRoleIcon(newRole)}
                  {newRole}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {getRoleDescription(newRole)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Special Warnings */}
      {isChangingOwnRole && (
        <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 rounded-lg p-3 mb-4">
          <div className="flex gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-orange-900 dark:text-orange-200">
                Warning: You are changing your own role
              </p>
              <p className="text-xs text-orange-800 dark:text-orange-300 mt-1">
                This will affect your current permissions and may lock you out of admin features.
              </p>
            </div>
          </div>
        </div>
      )}

      {isDowngradingFromAdmin && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-3 mb-4">
          <div className="flex gap-2">
            <Shield className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900 dark:text-red-200">
                Removing Administrator Privileges
              </p>
              <p className="text-xs text-red-800 dark:text-red-300 mt-1">
                This user will lose access to the admin panel and user management features.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Checklist */}
      <div className="space-y-3 mb-6">
        <p className="text-sm font-medium text-foreground">Please confirm the following:</p>

        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={confirmations.understand}
            onChange={(e) => setConfirmations({ ...confirmations, understand: e.target.checked })}
            className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm text-foreground group-hover:text-foreground/80">
            I understand that this will immediately change the user's permissions
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={confirmations.reviewed}
            onChange={(e) => setConfirmations({ ...confirmations, reviewed: e.target.checked })}
            className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm text-foreground group-hover:text-foreground/80">
            I have reviewed the account details and new role permissions
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={confirmations.irreversible}
            onChange={(e) => setConfirmations({ ...confirmations, irreversible: e.target.checked })}
            className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm text-foreground group-hover:text-foreground/80">
            I understand this action will be logged for audit purposes
          </span>
        </label>
      </div>

      {/* Email Verification */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-foreground mb-2">
          Type your email to confirm: <span className="text-muted-foreground">({currentUserEmail})</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your.email@example.com"
          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          disabled={isSubmitting}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleClose}
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 border border-input rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-foreground"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={!allConfirmed || isSubmitting}
          className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isSubmitting ? 'Changing Role...' : 'Confirm Role Change'}
        </button>
      </div>
    </Modal>
  )
}

export default RoleChangeConfirmationModal
