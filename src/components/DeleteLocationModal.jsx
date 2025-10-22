import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Modal from './Modal'
import { AlertTriangle } from 'lucide-react'

export default function DeleteLocationModal({ isOpen, onClose, onSuccess, location }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fetchingData, setFetchingData] = useState(false)

  // Data structures
  const [allLocations, setAllLocations] = useState([])
  const [allItems, setAllItems] = useState([])

  // Confirmation states
  const [checkedLocations, setCheckedLocations] = useState(new Set())
  const [checkedItems, setCheckedItems] = useState(new Set())
  const [emailConfirmation, setEmailConfirmation] = useState('')

  useEffect(() => {
    if (isOpen && location) {
      resetModal()
      fetchAllAffectedData()
    }
  }, [isOpen, location])

  const resetModal = () => {
    setCheckedLocations(new Set())
    setCheckedItems(new Set())
    setEmailConfirmation('')
    setError(null)
  }

  const fetchAllAffectedData = async () => {
    setFetchingData(true)
    try {
      // Recursively fetch all child locations
      const childLocations = await fetchChildLocationsRecursive(location.id)
      setAllLocations(childLocations)

      // Fetch all items in this location and all child locations
      const locationIds = [location.id, ...childLocations.map(l => l.id)]
      const { data: items } = await supabase
        .from('items')
        .select(`
          *,
          category:categories(name),
          location:locations(name, path)
        `)
        .in('location_id', locationIds)

      setAllItems(items || [])
    } catch (err) {
      console.error('Error fetching affected data:', err)
      setError(err.message)
    } finally {
      setFetchingData(false)
    }
  }

  const fetchChildLocationsRecursive = async (parentId) => {
    const { data: children } = await supabase
      .from('locations')
      .select('*')
      .eq('parent_id', parentId)

    if (!children || children.length === 0) return []

    // Recursively fetch children of children
    const allChildren = [...children]
    for (const child of children) {
      const grandchildren = await fetchChildLocationsRecursive(child.id)
      allChildren.push(...grandchildren)
    }

    return allChildren
  }

  const toggleLocationCheck = (locationId) => {
    const newSet = new Set(checkedLocations)
    if (newSet.has(locationId)) {
      newSet.delete(locationId)
    } else {
      newSet.add(locationId)
    }
    setCheckedLocations(newSet)
  }

  const toggleItemCheck = (itemId) => {
    const newSet = new Set(checkedItems)
    if (newSet.has(itemId)) {
      newSet.delete(itemId)
    } else {
      newSet.add(itemId)
    }
    setCheckedItems(newSet)
  }

  const toggleAllLocations = () => {
    if (checkedLocations.size === allLocations.length) {
      setCheckedLocations(new Set())
    } else {
      setCheckedLocations(new Set(allLocations.map(l => l.id)))
    }
  }

  const toggleAllItems = () => {
    if (checkedItems.size === allItems.length) {
      setCheckedItems(new Set())
    } else {
      setCheckedItems(new Set(allItems.map(i => i.id)))
    }
  }

  const canSubmit = () => {
    // All locations must be checked
    const allLocationsChecked = checkedLocations.size === allLocations.length
    // All items must be checked
    const allItemsChecked = checkedItems.size === allItems.length
    // Email must match user's email
    const emailMatches = emailConfirmation.toLowerCase() === user.email.toLowerCase()

    return allLocationsChecked && allItemsChecked && emailMatches && !loading
  }

  const handleDelete = async (e) => {
    e.preventDefault()

    if (!canSubmit()) return

    setLoading(true)
    setError(null)

    try {
      const now = new Date().toISOString()

      // Soft delete all items in this location and child locations
      const itemIds = allItems.map(i => i.id)
      if (itemIds.length > 0) {
        const { error: itemsError } = await supabase
          .from('items')
          .update({
            deleted_at: now,
            deleted_by: user.id,
          })
          .in('id', itemIds)

        if (itemsError) throw itemsError
      }

      // Soft delete all child locations
      const childLocationIds = allLocations.map(l => l.id)
      if (childLocationIds.length > 0) {
        const { error: childLocError } = await supabase
          .from('locations')
          .update({
            deleted_at: now,
            deleted_by: user.id,
          })
          .in('id', childLocationIds)

        if (childLocError) throw childLocError
      }

      // Soft delete the main location
      const { error: locationError } = await supabase
        .from('locations')
        .update({
          deleted_at: now,
          deleted_by: user.id,
        })
        .eq('id', location.id)

      if (locationError) throw locationError

      // Create audit log entry
      const { error: auditError } = await supabase
        .from('audit_logs')
        .insert([{
          user_id: user.id,
          action: 'delete_location',
          details: {
            location_id: location.id,
            location_name: location.name,
            location_path: location.path,
            deleted_child_locations: allLocations.map(l => ({ id: l.id, name: l.name, path: l.path })),
            deleted_items: allItems.map(i => ({ id: i.id, name: i.name, serial_number: i.serial_number })),
            total_locations_deleted: allLocations.length + 1,
            total_items_deleted: allItems.length,
            soft_delete: true,
          }
        }])

      if (auditError) throw auditError

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error deleting location:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!location) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Location" size="xl">
      <form onSubmit={handleDelete} className="space-y-6">
        {/* Warning Banner */}
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-destructive mb-1">Permanent Deletion Warning</h3>
            <p className="text-sm text-destructive/90">
              You are about to permanently delete <strong>"{location.name}"</strong> and all of its contents.
              This action cannot be undone.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {fetchingData ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading affected items and locations...
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="bg-muted rounded-lg p-4">
              <h4 className="font-semibold mb-2">Deletion Summary</h4>
              <div className="space-y-1 text-sm">
                <p>• Main location: <strong>{location.name}</strong></p>
                <p>• Sub-locations: <strong>{allLocations.length}</strong></p>
                <p>• Total items: <strong>{allItems.length}</strong></p>
                <p className="text-destructive font-semibold pt-2">
                  Total deletions: {allLocations.length + 1} locations + {allItems.length} items
                </p>
              </div>
            </div>

            {/* Child Locations */}
            {allLocations.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Sub-Locations to Delete ({allLocations.length})</h4>
                  <button
                    type="button"
                    onClick={toggleAllLocations}
                    className="text-sm text-primary hover:underline"
                  >
                    {checkedLocations.size === allLocations.length ? 'Uncheck All' : 'Check All'}
                  </button>
                </div>
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {allLocations.map((loc) => (
                    <label
                      key={loc.id}
                      className="flex items-start gap-3 p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={checkedLocations.has(loc.id)}
                        onChange={() => toggleLocationCheck(loc.id)}
                        className="mt-0.5 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{loc.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{loc.path}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Items */}
            {allItems.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Items to Delete ({allItems.length})</h4>
                  <button
                    type="button"
                    onClick={toggleAllItems}
                    className="text-sm text-primary hover:underline"
                  >
                    {checkedItems.size === allItems.length ? 'Uncheck All' : 'Check All'}
                  </button>
                </div>
                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  {allItems.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-start gap-3 p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={checkedItems.has(item.id)}
                        onChange={() => toggleItemCheck(item.id)}
                        className="mt-0.5 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{item.name}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {item.serial_number && (
                            <span>SN: {item.serial_number}</span>
                          )}
                          {item.category?.name && (
                            <span>{item.category.name}</span>
                          )}
                          {item.location?.name && (
                            <span>@ {item.location.name}</span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Email Confirmation */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Confirm by typing your email: <span className="text-destructive">*</span>
              </label>
              <input
                type="email"
                required
                value={emailConfirmation}
                onChange={(e) => setEmailConfirmation(e.target.value)}
                placeholder={user.email}
                className="w-full px-3 py-2 border rounded-md bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Type your email address to confirm this deletion
              </p>
            </div>

            {/* Validation Messages */}
            {!canSubmit() && (emailConfirmation || checkedLocations.size > 0 || checkedItems.size > 0) && (
              <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
                <p className="font-medium">To proceed, you must:</p>
                <ul className="list-disc list-inside space-y-0.5 text-muted-foreground ml-2">
                  {allLocations.length > 0 && checkedLocations.size !== allLocations.length && (
                    <li>Check all {allLocations.length} sub-locations</li>
                  )}
                  {allItems.length > 0 && checkedItems.size !== allItems.length && (
                    <li>Check all {allItems.length} items</li>
                  )}
                  {emailConfirmation.toLowerCase() !== user.email.toLowerCase() && (
                    <li>Enter your email address correctly</li>
                  )}
                </ul>
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-md hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit() || fetchingData}
            className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Deleting...' : 'Delete Permanently'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
