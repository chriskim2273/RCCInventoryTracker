import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Modal from './Modal'

export default function CheckoutModal({ isOpen, onClose, onSuccess, item }) {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [availableQuantity, setAvailableQuantity] = useState(0)
  const [formData, setFormData] = useState({
    checked_out_to: '',
    checked_out_to_user_id: '',
    use_registered_user: false,
    checked_out_at: new Date().toISOString().slice(0, 16),
    quantity: 1,
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen && item) {
      fetchUsers()
      calculateAvailableQuantity()
      setFormData({
        checked_out_to: '',
        checked_out_to_user_id: '',
        use_registered_user: false,
        checked_out_at: new Date().toISOString().slice(0, 16),
        quantity: 1,
        notes: '',
      })
      setError(null)
    }
  }, [isOpen, item])

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('*, first_name, last_name')
      .neq('role', 'pending')
      .order('first_name, last_name, email')
    setUsers(data || [])
  }

  const calculateAvailableQuantity = async () => {
    if (!item) return

    // Get all active checkouts for this item
    const { data: activeCheckouts } = await supabase
      .from('checkout_logs')
      .select('quantity_checked_out, quantity_checked_in')
      .eq('item_id', item.id)
      .is('checked_in_at', null)

    // Calculate total checked out quantity (only counting what hasn't been returned)
    const checkedOutQty = (activeCheckouts || []).reduce((sum, log) => {
      const checkedOut = log.quantity_checked_out || 0
      const checkedIn = log.quantity_checked_in || 0
      return sum + (checkedOut - checkedIn)
    }, 0)

    const available = Math.max(0, (item.quantity || 0) - checkedOutQty)
    setAvailableQuantity(available)
  }

  const getUserDisplayName = (user) => {
    if (!user) return ''
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`
    }
    return user.email || ''
  }

  const handleUserSelection = (userId) => {
    if (userId) {
      const selectedUser = users.find(u => u.id === userId)
      setFormData({
        ...formData,
        checked_out_to_user_id: userId,
        checked_out_to: getUserDisplayName(selectedUser),
      })
    } else {
      setFormData({
        ...formData,
        checked_out_to_user_id: '',
        checked_out_to: '',
      })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const checkoutQty = parseInt(formData.quantity)

      // Validate quantity
      if (checkoutQty <= 0) {
        throw new Error('Quantity must be greater than 0')
      }
      if (checkoutQty > availableQuantity) {
        throw new Error(`Only ${availableQuantity} units available`)
      }

      // Create checkout log entry
      const { error: logError } = await supabase
        .from('checkout_logs')
        .insert([{
          item_id: item.id,
          checked_out_to: formData.checked_out_to,
          checked_out_to_user_id: formData.checked_out_to_user_id || null,
          checked_out_at: formData.checked_out_at,
          quantity_checked_out: checkoutQty,
          checkout_notes: formData.notes || null,
          performed_by: user.id,
        }])

      if (logError) throw logError

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error checking out item:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!item) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Check Out Item">
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
          <label className="block text-sm font-medium mb-1">Quantity *</label>
          <input
            type="number"
            required
            min="1"
            max={availableQuantity}
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
            className="w-full px-3 py-2 border rounded-md bg-background"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Available: {availableQuantity} of {item.quantity}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Check Out To *</label>
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!formData.use_registered_user}
                  onChange={() => setFormData({ ...formData, use_registered_user: false, checked_out_to_user_id: '', checked_out_to: '' })}
                  className="rounded-full"
                />
                <span className="text-sm">Enter name manually</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={formData.use_registered_user}
                  onChange={() => setFormData({ ...formData, use_registered_user: true })}
                  className="rounded-full"
                />
                <span className="text-sm">Select registered user</span>
              </label>
            </div>

            {formData.use_registered_user ? (
              <select
                required
                value={formData.checked_out_to_user_id}
                onChange={(e) => handleUserSelection(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="">Select user...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {getUserDisplayName(u)} ({u.role})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                required
                value={formData.checked_out_to}
                onChange={(e) => setFormData({ ...formData, checked_out_to: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
                placeholder="Enter person's name (e.g., John Doe, Room 305)"
              />
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Check Out Date/Time *</label>
          <input
            type="datetime-local"
            required
            value={formData.checked_out_at}
            onChange={(e) => setFormData({ ...formData, checked_out_at: e.target.value })}
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
            placeholder="Reason for checkout, expected return date, etc..."
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
            {loading ? 'Checking Out...' : 'Check Out'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
