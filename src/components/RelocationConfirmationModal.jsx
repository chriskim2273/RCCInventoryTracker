import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import Modal from './Modal'

export default function RelocationConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  item,
  currentLocation,
  targetLocation,
}) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
      onClose()
    } catch (error) {
      console.error('Error relocating item:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!item || !targetLocation) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Relocate Item" size="md">
      <div className="space-y-4">
        {/* Item Details */}
        <div className="border rounded-lg p-4 bg-muted/30">
          <h4 className="font-semibold text-sm mb-2">Item</h4>
          <div className="flex items-start gap-3">
            {item.image_url && (
              <img
                src={item.image_url}
                alt={item.name}
                className="w-16 h-16 object-cover rounded-md border"
                onError={(e) => {
                  e.target.style.display = 'none'
                }}
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium">{item.name}</p>
              {item.serial_number && (
                <p className="text-xs text-muted-foreground">
                  SN: {item.serial_number}
                </p>
              )}
              {item.category?.name && (
                <p className="text-xs text-muted-foreground">
                  {item.category.icon && <span className="mr-1">{item.category.icon}</span>}
                  {item.category.name}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Location Change Display */}
        <div className="border rounded-lg p-4 bg-card">
          <h4 className="font-semibold text-sm mb-3">Location Change</h4>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">From:</p>
              <p className="text-sm font-medium font-mono bg-muted px-3 py-2 rounded">
                {item.location?.path || currentLocation?.path || 'Unknown Location'}
              </p>
            </div>
            <div className="flex justify-center">
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">To:</p>
              <p className="text-sm font-medium font-mono bg-primary/10 px-3 py-2 rounded border border-primary/20">
                {targetLocation.path}
              </p>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Are you sure you want to move this item to the new location?
        </p>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border rounded-md hover:bg-secondary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Moving...' : 'Confirm Move'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
