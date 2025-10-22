import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Modal from './Modal'

export default function CheckoutModal({ isOpen, onClose, onSuccess, item }) {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [formData, setFormData] = useState({
    checked_out_to: '',
    checked_out_to_user_id: '',
    use_registered_user: false,
    checked_out_at: new Date().toISOString().slice(0, 16),
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      fetchUsers()
      setFormData({
        checked_out_to: '',
        checked_out_to_user_id: '',
        use_registered_user: false,
        checked_out_at: new Date().toISOString().slice(0, 16),
        notes: '',
      })
      setError(null)
    }
  }, [isOpen])

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .neq('role', 'pending')
      .order('email')
    setUsers(data || [])
  }

  const handleUserSelection = (userId) => {
    if (userId) {
      const selectedUser = users.find(u => u.id === userId)
      setFormData({
        ...formData,
        checked_out_to_user_id: userId,
        checked_out_to: selectedUser?.email || '',
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
      // Create checkout log entry
      const { data: checkoutLog, error: logError } = await supabase
        .from('checkout_logs')
        .insert([{
          item_id: item.id,
          checked_out_to: formData.checked_out_to,
          checked_out_to_user_id: formData.checked_out_to_user_id || null,
          checked_out_at: formData.checked_out_at,
          checkout_notes: formData.notes || null,
          performed_by: user.id,
        }])
        .select()
        .single()

      if (logError) throw logError

      // Update item with checkout info
      const { error: updateError } = await supabase
        .from('items')
        .update({
          checked_out_by: formData.checked_out_to_user_id || null,
          checkout_log_id: checkoutLog.id,
        })
        .eq('id', item.id)

      if (updateError) throw updateError

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
                    {u.email} ({u.role})
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
