import { useState, useEffect } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import Modal from './Modal'

export default function HardDeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  itemType, // 'item', 'location', 'category'
  itemName,
  itemDetails, // Additional details like serial_number, path, etc.
  userEmail,
}) {
  const [confirmations, setConfirmations] = useState({})
  const [emailInput, setEmailInput] = useState('')
  const [typeConfirm, setTypeConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setConfirmations({})
      setEmailInput('')
      setTypeConfirm('')
      setLoading(false)
    }
  }, [isOpen])

  const typeLabel = itemType === 'item' ? 'item' : itemType === 'location' ? 'location' : 'category'

  const checks = [
    {
      id: 'understand_permanent',
      label: `I understand this will PERMANENTLY delete "${itemName}"`,
    },
    {
      id: 'understand_no_restore',
      label: 'I understand this action CANNOT be undone or restored',
    },
    {
      id: 'understand_audit_trail',
      label: 'I understand only the audit trail will remain after deletion',
    },
  ]

  const allChecked = checks.every((check) => confirmations[check.id])
  const emailMatches = emailInput.toLowerCase() === userEmail.toLowerCase()
  const typeMatches = typeConfirm === 'PERMANENTLY DELETE'
  const canDelete = allChecked && emailMatches && typeMatches

  const handleCheckChange = (checkId) => {
    setConfirmations((prev) => ({
      ...prev,
      [checkId]: !prev[checkId],
    }))
  }

  const handleConfirm = async () => {
    if (!canDelete) return

    setLoading(true)
    try {
      await onConfirm()
      onClose()
    } catch (error) {
      console.error('Error during hard deletion:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Permanent Deletion Confirmation">
      <div className="space-y-4">
        {/* Critical Warning Header */}
        <div className="bg-red-500/10 border-2 border-red-500/50 rounded-lg p-4 flex items-start gap-3">
          <Trash2 className="h-6 w-6 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-red-600 dark:text-red-500 mb-2 text-lg">
              CRITICAL WARNING: Permanent Deletion
            </h3>
            <p className="text-sm text-foreground font-medium">
              You are about to permanently delete this item from the database. This action is
              <span className="font-bold text-red-600 dark:text-red-500"> IRREVERSIBLE</span> and
              <span className="font-bold text-red-600 dark:text-red-500"> CANNOT BE UNDONE</span>.
            </p>
          </div>
        </div>

        {/* Item Details */}
        <div className="border-2 border-destructive/30 rounded-lg p-4 bg-destructive/5">
          <h4 className="font-semibold text-sm mb-2 text-destructive capitalize">
            {typeLabel} to be permanently deleted:
          </h4>
          <div className="space-y-1 ml-2">
            <div className="text-sm">
              <span className="text-muted-foreground">Name:</span>{' '}
              <span className="font-medium">{itemName}</span>
            </div>
            {itemDetails?.serialNumber && (
              <div className="text-sm">
                <span className="text-muted-foreground">Serial Number:</span>{' '}
                <span className="font-medium">{itemDetails.serialNumber}</span>
              </div>
            )}
            {itemDetails?.path && (
              <div className="text-sm">
                <span className="text-muted-foreground">Path:</span>{' '}
                <span className="font-medium font-mono text-xs">{itemDetails.path}</span>
              </div>
            )}
          </div>
        </div>

        {/* Warning Notice */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> This is different from the regular "Delete" action. Regular deletions
              can be restored from the Deleted Items tab. Hard deletion removes the {typeLabel} entirely from
              the database and only the audit trail will remain.
            </p>
          </div>
        </div>

        {/* Confirmation Checkboxes */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Please confirm the following:</h4>
          <div className="space-y-2">
            {checks.map((check) => (
              <label
                key={check.id}
                className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={confirmations[check.id] || false}
                  onChange={() => handleCheckChange(check.id)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
                <span className="text-sm select-none">{check.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Type Confirmation */}
        <div>
          <label className="block text-sm font-semibold mb-2">
            Type <span className="font-mono text-red-600 dark:text-red-500">PERMANENTLY DELETE</span> to confirm:
          </label>
          <input
            type="text"
            value={typeConfirm}
            onChange={(e) => setTypeConfirm(e.target.value)}
            placeholder="Type here..."
            className="w-full px-3 py-2 border rounded-md bg-background font-mono"
            autoComplete="off"
          />
          {typeConfirm && !typeMatches && (
            <p className="text-xs text-destructive mt-1">Text does not match</p>
          )}
        </div>

        {/* Email Verification */}
        <div>
          <label className="block text-sm font-semibold mb-2">
            Type your email to confirm: <span className="text-muted-foreground font-normal">({userEmail})</span>
          </label>
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="Enter your email"
            className="w-full px-3 py-2 border rounded-md bg-background"
            autoComplete="off"
          />
          {emailInput && !emailMatches && (
            <p className="text-xs text-destructive mt-1">Email does not match</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-md hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canDelete || loading}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {loading ? 'Permanently Deleting...' : 'Permanently Delete'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
