import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Modal from './Modal'

export default function LocationModal({ isOpen, onClose, onSuccess, location = null, parentId = null }) {
  const [formData, setFormData] = useState({
    name: '',
    parent_id: parentId || '',
  })
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      fetchLocations()
      if (location) {
        setFormData({
          name: location.name || '',
          parent_id: location.parent_id || '',
        })
      } else {
        setFormData({
          name: '',
          parent_id: parentId || '',
        })
      }
      setError(null)
    }
  }, [isOpen, location, parentId])

  const fetchLocations = async () => {
    const { data } = await supabase
      .from('locations')
      .select('*')
      .order('path')

    // Filter out current location and its children to prevent circular references
    let filteredLocations = data || []
    if (location) {
      filteredLocations = filteredLocations.filter(
        (loc) => loc.id !== location.id && !loc.path?.startsWith(location.path)
      )
    }
    setLocations(filteredLocations)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const locationData = {
        name: formData.name,
        parent_id: formData.parent_id || null,
      }

      if (location) {
        // Update existing location
        const { error: updateError } = await supabase
          .from('locations')
          .update(locationData)
          .eq('id', location.id)

        if (updateError) throw updateError
      } else {
        // Create new location
        const { error: insertError } = await supabase
          .from('locations')
          .insert([locationData])

        if (insertError) throw insertError
      }

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error saving location:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={location ? 'Edit Location' : 'Add New Location'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Name *</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-md bg-background"
            placeholder="e.g., Main Office, Room 101, Shelf A"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Parent Location</label>
          <select
            value={formData.parent_id}
            onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
            className="w-full px-3 py-2 border rounded-md bg-background"
          >
            <option value="">None (Top Level)</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.path}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            Leave empty to create a top-level location
          </p>
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
            {loading ? 'Saving...' : location ? 'Update Location' : 'Create Location'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
