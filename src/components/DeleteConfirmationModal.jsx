import { useState, useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName,
  itemType, // 'category', 'location', 'item'
  userEmail,
  affectedData = null, // { items: [], locations: [] }
}) {
  const [confirmations, setConfirmations] = useState({})
  const [emailInput, setEmailInput] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setConfirmations({})
      setEmailInput('')
      setLoading(false)
    }
  }, [isOpen])

  const getConfirmationChecks = () => {
    const checks = []

    // Base confirmation
    checks.push({
      id: 'understand_deletion',
      label: `I understand this will delete "${itemName}"`,
    })

    // Type-specific confirmations
    if (itemType === 'category' && affectedData?.items?.length > 0) {
      checks.push({
        id: 'understand_items_affected',
        label: `I understand ${affectedData.items.length} item${affectedData.items.length !== 1 ? 's' : ''} will lose their category assignment`,
      })
      checks.push({
        id: 'understand_category_null',
        label: 'I understand affected items will have their category set to NULL',
      })
    }

    if (itemType === 'location') {
      if (affectedData?.childLocations?.length > 0) {
        checks.push({
          id: 'understand_child_locations',
          label: `I understand ${affectedData.childLocations.length} sub-location${affectedData.childLocations.length !== 1 ? 's' : ''} will also be deleted`,
        })
      }
      if (affectedData?.items?.length > 0) {
        checks.push({
          id: 'understand_location_items',
          label: `I understand ${affectedData.items.length} item${affectedData.items.length !== 1 ? 's' : ''} at this location will be deleted`,
        })
      }
    }

    // Final confirmation
    checks.push({
      id: 'understand_permanent',
      label: 'I understand this action can be restored from the Deleted Items tab',
    })

    return checks
  }

  const checks = getConfirmationChecks()
  const allChecked = checks.every((check) => confirmations[check.id])
  const emailMatches = emailInput.toLowerCase() === userEmail.toLowerCase()
  const canDelete = allChecked && emailMatches

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
      console.error('Error during deletion:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        {/* Warning Header */}
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-destructive mb-1">Warning: Deletion Action</h3>
            <p className="text-sm text-muted-foreground">
              This action will soft-delete the {itemType} and can be restored from the Admin Panel.
            </p>
          </div>
        </div>

        {/* Affected Items/Locations Details */}
        {affectedData && (
          <div className="space-y-3">
            {/* Affected Items */}
            {affectedData.items?.length > 0 && (
              <div className="border rounded-lg p-3 bg-muted/30">
                <h4 className="font-semibold text-sm mb-2">
                  Affected Items ({affectedData.items.length})
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {affectedData.items
                    .sort((a, b) => {
                      // Sort by location path first, then by item name
                      const pathA = a.location?.path || ''
                      const pathB = b.location?.path || ''
                      if (pathA !== pathB) return pathA.localeCompare(pathB)
                      return a.name.localeCompare(b.name)
                    })
                    .map((item) => (
                      <div key={item.id} className="text-xs">
                        <div className="font-medium text-foreground">
                          • {item.name}
                          {item.serial_number && ` (SN: ${item.serial_number})`}
                        </div>
                        {item.location?.path && (
                          <div className="ml-3 text-muted-foreground font-mono text-[10px]">
                            at: {item.location.path}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Affected Child Locations */}
            {affectedData.childLocations?.length > 0 && (
              <div className="border rounded-lg p-3 bg-muted/30">
                <h4 className="font-semibold text-sm mb-2">
                  Sub-Locations to be Deleted ({affectedData.childLocations.length})
                </h4>
                <p className="text-xs text-muted-foreground mb-2">
                  All nested locations at any depth will be deleted
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {affectedData.childLocations
                    .sort((a, b) => a.path.localeCompare(b.path))
                    .map((loc) => (
                      <div key={loc.id} className="text-xs text-muted-foreground font-mono">
                        • {loc.path}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

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
            className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
