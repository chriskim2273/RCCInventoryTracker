import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Modal from './Modal'

export default function CheckinModal({ isOpen, onClose, onSuccess, item }) {
  const [formData, setFormData] = useState({
    checked_in_at: new Date().toISOString().slice(0, 16),
    notes: '',
  })
  const [checkoutInfo, setCheckoutInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen && item?.checkout_log_id) {
      setFormData({
        checked_in_at: new Date().toISOString().slice(0, 16),
        notes: '',
      })
      setError(null)
      fetchCheckoutInfo()
    }
  }, [isOpen, item])

  const fetchCheckoutInfo = async () => {
    if (!item?.checkout_log_id) return

    const { data } = await supabase
      .from('checkout_logs')
      .select('*')
      .eq('id', item.checkout_log_id)
      .single()

    setCheckoutInfo(data)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Update the current checkout log with check-in info
      const { error: logError } = await supabase
        .from('checkout_logs')
        .update({
          checked_in_at: formData.checked_in_at,
          checkin_notes: formData.notes || null,
        })
        .eq('id', item.checkout_log_id)

      if (logError) throw logError

      // Update item to clear checkout info
      const { error: updateError } = await supabase
        .from('items')
        .update({
          checked_out_by: null,
          checkout_log_id: null,
        })
        .eq('id', item.id)

      if (updateError) throw updateError

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Check In Item">
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
          <label className="block text-sm font-medium mb-1">Currently Checked Out To</label>
          <div className="px-3 py-2 bg-muted rounded-md text-sm">
            {checkoutInfo ? (
              <div>
                <p className="font-medium">{checkoutInfo.checked_out_to}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Since: {new Date(checkoutInfo.checked_out_at).toLocaleString()}
                </p>
                {checkoutInfo.checkout_notes && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Notes: {checkoutInfo.checkout_notes}
                  </p>
                )}
              </div>
            ) : (
              'Loading...'
            )}
          </div>
        </div>

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
            disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Checking In...' : 'Check In'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
