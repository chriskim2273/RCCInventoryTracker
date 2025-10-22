import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Modal from './Modal'

export default function CheckinModal({ isOpen, onClose, onSuccess, item }) {
  const [activeCheckouts, setActiveCheckouts] = useState([])
  const [selectedCheckouts, setSelectedCheckouts] = useState({}) // {checkoutId: quantityToReturn}
  const [formData, setFormData] = useState({
    checked_in_at: new Date().toISOString().slice(0, 16),
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen && item) {
      setFormData({
        checked_in_at: new Date().toISOString().slice(0, 16),
        notes: '',
      })
      setSelectedCheckouts({})
      setError(null)
      fetchActiveCheckouts()
    }
  }, [isOpen, item])

  const fetchActiveCheckouts = async () => {
    if (!item) return

    const { data } = await supabase
      .from('checkout_logs')
      .select('*')
      .eq('item_id', item.id)
      .is('checked_in_at', null)
      .order('checked_out_at', { ascending: false })

    setActiveCheckouts(data || [])
  }

  const getOutstandingQuantity = (checkout) => {
    const checkedOut = checkout.quantity_checked_out || 0
    const checkedIn = checkout.quantity_checked_in || 0
    return checkedOut - checkedIn
  }

  const getTotalSelectedQuantity = () => {
    return Object.values(selectedCheckouts).reduce((sum, qty) => sum + (parseInt(qty) || 0), 0)
  }

  const handleQuantityChange = (checkoutId, value) => {
    const checkout = activeCheckouts.find(c => c.id === checkoutId)
    if (!checkout) return

    const outstanding = getOutstandingQuantity(checkout)
    const qty = Math.max(0, Math.min(parseInt(value) || 0, outstanding))

    setSelectedCheckouts(prev => ({
      ...prev,
      [checkoutId]: qty
    }))
  }

  const toggleCheckout = (checkoutId) => {
    const checkout = activeCheckouts.find(c => c.id === checkoutId)
    if (!checkout) return

    if (selectedCheckouts[checkoutId]) {
      const { [checkoutId]: _, ...rest } = selectedCheckouts
      setSelectedCheckouts(rest)
    } else {
      setSelectedCheckouts(prev => ({
        ...prev,
        [checkoutId]: getOutstandingQuantity(checkout)
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const checkoutIds = Object.keys(selectedCheckouts)
      if (checkoutIds.length === 0) {
        throw new Error('Please select at least one checkout to check in')
      }

      // Process each checkout
      for (const checkoutId of checkoutIds) {
        const quantityToReturn = parseInt(selectedCheckouts[checkoutId])
        if (quantityToReturn <= 0) continue

        const checkout = activeCheckouts.find(c => c.id === checkoutId)
        const outstanding = getOutstandingQuantity(checkout)

        // Update the checkout log
        if (quantityToReturn >= outstanding) {
          // Full check-in - mark as completed
          const { error: logError } = await supabase
            .from('checkout_logs')
            .update({
              checked_in_at: formData.checked_in_at,
              quantity_checked_in: checkout.quantity_checked_out,
              checkin_notes: formData.notes || null,
            })
            .eq('id', checkoutId)

          if (logError) throw logError
        } else {
          // Partial check-in - update quantity_checked_in but leave checked_in_at null
          const newCheckedIn = (checkout.quantity_checked_in || 0) + quantityToReturn
          const { error: logError } = await supabase
            .from('checkout_logs')
            .update({
              quantity_checked_in: newCheckedIn,
              checkin_notes: formData.notes || null,
            })
            .eq('id', checkoutId)

          if (logError) throw logError
        }
      }

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error checking in item:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!item) return null

  const totalSelected = getTotalSelectedQuantity()

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Check In Item" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Item</label>
          <div className="px-3 py-2 bg-muted rounded-md text-sm">
            {item.name}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Active Checkouts</label>
          {activeCheckouts.length === 0 ? (
            <div className="px-3 py-2 bg-muted rounded-md text-sm text-muted-foreground">
              No active checkouts
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activeCheckouts.map((checkout) => {
                const outstanding = getOutstandingQuantity(checkout)
                const isSelected = selectedCheckouts[checkout.id] !== undefined

                return (
                  <div key={checkout.id} className="border rounded-md p-3 bg-card">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleCheckout(checkout.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{checkout.checked_out_to}</p>
                        <p className="text-xs text-muted-foreground">
                          Checked out: {new Date(checkout.checked_out_at).toLocaleString()}
                        </p>
                        {checkout.checkout_notes && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Notes: {checkout.checkout_notes}
                          </p>
                        )}
                        <p className="text-xs font-medium mt-1">
                          Outstanding: {outstanding} units
                        </p>
                      </div>
                      {isSelected && (
                        <div className="flex-shrink-0">
                          <label className="text-xs text-muted-foreground">Return Qty:</label>
                          <input
                            type="number"
                            min="1"
                            max={outstanding}
                            value={selectedCheckouts[checkout.id]}
                            onChange={(e) => handleQuantityChange(checkout.id, e.target.value)}
                            className="w-20 px-2 py-1 text-sm border rounded-md bg-background"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {totalSelected > 0 && (
          <div className="px-3 py-2 bg-primary/10 rounded-md text-sm">
            <p className="font-medium">Total checking in: {totalSelected} units</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Check In Date/Time *</label>
          <input
            type="datetime-local"
            required
            value={formData.checked_in_at}
            onChange={(e) => setFormData({ ...formData, checked_in_at: e.target.value })}
            className="w-full px-3 py-2 border rounded-md bg-background"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea
            rows="3"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-3 py-2 border rounded-md bg-background"
            placeholder="Condition of item, damages, etc..."
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-md hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || totalSelected === 0}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Checking In...' : `Check In ${totalSelected > 0 ? `(${totalSelected})` : ''}`}
          </button>
        </div>
      </form>
    </Modal>
  )
}
