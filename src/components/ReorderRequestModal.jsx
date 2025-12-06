import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Modal from './Modal'
import { Package, ExternalLink } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'new_request', label: 'New Request' },
  { value: 'approved_pending', label: 'Approved / Pending Purchase' },
  { value: 'purchased', label: 'Purchased' },
  { value: 'arrived', label: 'Arrived' },
  { value: 'documented', label: 'Documented' },
  { value: 'rejected', label: 'Rejected' },
]

export default function ReorderRequestModal({
  isOpen,
  onClose,
  onSuccess,
  request = null,
  preselectedItem = null
}) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [locations, setLocations] = useState([])
  const [adminUsers, setAdminUsers] = useState([])
  const [formData, setFormData] = useState({
    is_new_item: false,
    item_id: '',
    item_name: '',
    item_brand: '',
    item_model: '',
    item_category_id: '',
    date_requested: new Date().toISOString().slice(0, 16),
    priority: 'standard',
    quantity_to_order: 1,
    units_per_pack: '',
    price_per_pack: '',
    order_link: '',
    location_id: '',
    notes: '',
    status: 'new_request',
    purchased_by: '',
    purchased_by_name: '',
    use_registered_purchaser: true,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const isEditing = !!request

  useEffect(() => {
    if (isOpen) {
      fetchOptions()

      if (request) {
        // Editing existing request
        setFormData({
          is_new_item: !request.item_id,
          item_id: request.item_id || '',
          item_name: request.item_name || '',
          item_brand: request.item_brand || '',
          item_model: request.item_model || '',
          item_category_id: request.item_category_id || '',
          date_requested: request.date_requested ? new Date(request.date_requested).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
          priority: request.priority || 'standard',
          quantity_to_order: request.quantity_to_order || 1,
          units_per_pack: request.units_per_pack || '',
          price_per_pack: request.price_per_pack || '',
          order_link: request.order_link || '',
          location_id: request.location_id || '',
          notes: request.notes || '',
          status: request.status || 'new_request',
          purchased_by: request.purchased_by || '',
          purchased_by_name: request.purchased_by_name || '',
          use_registered_purchaser: !!request.purchased_by || !request.purchased_by_name,
        })
      } else if (preselectedItem) {
        // Creating from item detail page
        setFormData({
          is_new_item: false,
          item_id: preselectedItem.id,
          item_name: preselectedItem.name || '',
          item_brand: preselectedItem.brand || '',
          item_model: preselectedItem.model || '',
          item_category_id: preselectedItem.category_id || '',
          date_requested: new Date().toISOString().slice(0, 16),
          priority: 'standard',
          quantity_to_order: 1,
          units_per_pack: '',
          price_per_pack: '',
          order_link: preselectedItem.order_link || '',
          location_id: getCenterFromLocation(preselectedItem.location_id) || '',
          notes: '',
          status: 'new_request',
          purchased_by: '',
          purchased_by_name: '',
          use_registered_purchaser: true,
        })
      } else {
        // Creating new request
        setFormData({
          is_new_item: false,
          item_id: '',
          item_name: '',
          item_brand: '',
          item_model: '',
          item_category_id: '',
          date_requested: new Date().toISOString().slice(0, 16),
          priority: 'standard',
          quantity_to_order: 1,
          units_per_pack: '',
          price_per_pack: '',
          order_link: '',
          location_id: '',
          notes: '',
          status: 'new_request',
          purchased_by: '',
          purchased_by_name: '',
          use_registered_purchaser: true,
        })
      }
      setError(null)
    }
  }, [isOpen, request, preselectedItem])

  const getCenterFromLocation = (locationId) => {
    // This will be populated after locations are fetched
    // For now, return the locationId and we'll handle it after fetch
    return locationId
  }

  const fetchOptions = async () => {
    const [itemsRes, categoriesRes, locationsRes, usersRes] = await Promise.all([
      supabase.from('items').select('id, name, brand, model, category_id, order_link, location_id').is('deleted_at', null).order('name'),
      supabase.from('categories').select('*').is('deleted_at', null).order('name'),
      supabase.from('locations').select('*').is('deleted_at', null).order('path'),
      supabase.from('users').select('*').in('role', ['admin', 'coordinator']).order('first_name, last_name, email'),
    ])
    setItems(itemsRes.data || [])
    setCategories(categoriesRes.data || [])
    setLocations(locationsRes.data || [])
    setAdminUsers(usersRes.data || [])
  }

  // Get only center-level locations (no parent)
  const centerLocations = locations.filter(loc => loc.parent_id === null)

  // Find center for a given location (traverse up the tree)
  const findCenterForLocation = (locationId) => {
    if (!locationId || locations.length === 0) return ''
    let current = locations.find(l => l.id === locationId)
    while (current && current.parent_id) {
      current = locations.find(l => l.id === current.parent_id)
    }
    return current?.id || ''
  }

  // When item selection changes, auto-fill fields
  const handleItemChange = (itemId) => {
    const selectedItem = items.find(i => i.id === itemId)
    if (selectedItem) {
      setFormData({
        ...formData,
        item_id: itemId,
        item_name: selectedItem.name,
        item_brand: selectedItem.brand || '',
        item_model: selectedItem.model || '',
        item_category_id: selectedItem.category_id || '',
        order_link: selectedItem.order_link || formData.order_link,
        location_id: findCenterForLocation(selectedItem.location_id) || formData.location_id,
      })
    } else {
      setFormData({
        ...formData,
        item_id: '',
        item_name: '',
        item_brand: '',
        item_model: '',
        item_category_id: '',
      })
    }
  }

  const handlePurchaserSelection = (userId) => {
    if (userId) {
      const selectedUser = adminUsers.find(u => u.id === userId)
      const displayName = selectedUser?.first_name && selectedUser?.last_name
        ? `${selectedUser.first_name} ${selectedUser.last_name}`
        : selectedUser?.email || ''
      setFormData({
        ...formData,
        purchased_by: userId,
        purchased_by_name: displayName,
      })
    } else {
      setFormData({
        ...formData,
        purchased_by: '',
        purchased_by_name: '',
      })
    }
  }

  const calculateTotalCost = () => {
    const price = parseFloat(formData.price_per_pack) || 0
    const qty = parseInt(formData.quantity_to_order) || 0
    return (price * qty).toFixed(2)
  }

  const calculateTotalUnits = () => {
    const qty = parseInt(formData.quantity_to_order) || 0
    const units = parseInt(formData.units_per_pack) || 1
    return qty * units
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Validation
      if (!formData.item_name?.trim()) {
        throw new Error('Item name is required')
      }
      if (!formData.location_id) {
        throw new Error('Location is required')
      }
      if (!formData.quantity_to_order || formData.quantity_to_order < 1) {
        throw new Error('Quantity must be at least 1')
      }
      if (formData.price_per_pack === '' || parseFloat(formData.price_per_pack) < 0) {
        throw new Error('Price per pack is required')
      }

      const requestData = {
        item_id: formData.is_new_item ? null : (formData.item_id || null),
        date_requested: formData.date_requested,
        priority: formData.priority,
        item_name: formData.item_name,
        item_brand: formData.item_brand || null,
        item_model: formData.item_model || null,
        item_category_id: formData.item_category_id || null,
        quantity_to_order: parseInt(formData.quantity_to_order),
        units_per_pack: formData.units_per_pack ? parseInt(formData.units_per_pack) : null,
        price_per_pack: parseFloat(formData.price_per_pack),
        order_link: formData.order_link || null,
        location_id: formData.location_id,
        notes: formData.notes || null,
        status: formData.status,
      }

      // Handle purchased_by field
      if (formData.status !== 'new_request' && formData.status !== 'rejected') {
        if (formData.use_registered_purchaser && formData.purchased_by) {
          requestData.purchased_by = formData.purchased_by
          requestData.purchased_by_name = formData.purchased_by_name
        } else if (!formData.use_registered_purchaser && formData.purchased_by_name) {
          requestData.purchased_by = null
          requestData.purchased_by_name = formData.purchased_by_name
        }
      }

      if (isEditing) {
        // Update existing request
        const { error: updateError } = await supabase
          .from('reorder_requests')
          .update(requestData)
          .eq('id', request.id)

        if (updateError) throw updateError
      } else {
        // Create new request
        const displayName = user.first_name && user.last_name
          ? `${user.first_name} ${user.last_name}`
          : user.email

        const { error: insertError } = await supabase
          .from('reorder_requests')
          .insert([{
            ...requestData,
            requested_by: user.id,
            requested_by_name: displayName,
          }])

        if (insertError) throw insertError
      }

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error saving reorder request:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Reorder Request' : 'New Reorder Request'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Item Selection Toggle */}
        <div className="bg-muted/50 p-4 rounded-lg space-y-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={!formData.is_new_item}
                onChange={() => setFormData({ ...formData, is_new_item: false, item_id: '', item_name: '', item_brand: '', item_model: '', item_category_id: '' })}
                className="rounded-full"
                disabled={isEditing}
              />
              <span className="text-sm font-medium">Existing Item</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={formData.is_new_item}
                onChange={() => setFormData({ ...formData, is_new_item: true, item_id: '' })}
                className="rounded-full"
                disabled={isEditing}
              />
              <span className="text-sm font-medium">New Item (not in inventory)</span>
            </label>
          </div>

          {!formData.is_new_item ? (
            <div>
              <label className="block text-sm font-medium mb-1">Select Item *</label>
              <select
                required={!formData.is_new_item}
                value={formData.item_id}
                onChange={(e) => handleItemChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background"
                disabled={isEditing}
              >
                <option value="">Select an item...</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} {item.brand ? `(${item.brand})` : ''} {item.model ? `- ${item.model}` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  value={formData.item_name}
                  onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="Enter item name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Brand</label>
                <input
                  type="text"
                  value={formData.item_brand}
                  onChange={(e) => setFormData({ ...formData, item_brand: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Model</label>
                <input
                  type="text"
                  value={formData.item_model}
                  onChange={(e) => setFormData({ ...formData, item_model: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={formData.item_category_id}
                  onChange={(e) => setFormData({ ...formData, item_category_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option value="">Select category...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Request Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Date Requested *</label>
            <input
              type="datetime-local"
              required
              value={formData.date_requested}
              onChange={(e) => setFormData({ ...formData, date_requested: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background"
              disabled={isEditing}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Priority *</label>
            <select
              required
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background"
            >
              <option value="standard">Standard</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Location (Center) *</label>
            <select
              required
              value={formData.location_id}
              onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background"
            >
              <option value="">Select center...</option>
              {centerLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              value={formData.item_category_id}
              onChange={(e) => setFormData({ ...formData, item_category_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background"
              disabled={!formData.is_new_item && formData.item_id}
            >
              <option value="">Select category...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quantity and Price */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Quantity to Order *</label>
            <input
              type="number"
              required
              min="1"
              value={formData.quantity_to_order}
              onChange={(e) => setFormData({ ...formData, quantity_to_order: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Units per Pack</label>
            <input
              type="number"
              min="1"
              value={formData.units_per_pack}
              onChange={(e) => setFormData({ ...formData, units_per_pack: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background"
              placeholder="e.g., 3 for a 3-pack"
            />
            {formData.units_per_pack && (
              <p className="text-xs text-muted-foreground mt-1">
                Total units: {calculateTotalUnits()}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Price per Pack ($) *</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={formData.price_per_pack}
              onChange={(e) => setFormData({ ...formData, price_per_pack: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background"
              placeholder="0.00"
            />
            {formData.price_per_pack && formData.quantity_to_order && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
                Total cost: ${calculateTotalCost()}
              </p>
            )}
          </div>
        </div>

        {/* Order Link */}
        <div>
          <label className="block text-sm font-medium mb-1">Order Link</label>
          <div className="flex gap-2">
            <input
              type="url"
              value={formData.order_link}
              onChange={(e) => setFormData({ ...formData, order_link: e.target.value })}
              className="flex-1 px-3 py-2 border rounded-md bg-background"
              placeholder="https://..."
            />
            {formData.order_link && (
              <a
                href={formData.order_link}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 border rounded-md hover:bg-secondary transition-colors"
                title="Open link"
              >
                <ExternalLink className="h-5 w-5" />
              </a>
            )}
          </div>
        </div>

        {/* Status (only when editing) */}
        {isEditing && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg space-y-4">
            <h3 className="font-medium text-blue-800 dark:text-blue-200">Status Update</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Status *</label>
                <select
                  required
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {formData.status !== 'new_request' && formData.status !== 'rejected' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Purchased By</label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={formData.use_registered_purchaser}
                          onChange={() => setFormData({ ...formData, use_registered_purchaser: true, purchased_by: '', purchased_by_name: '' })}
                          className="rounded-full"
                        />
                        <span className="text-xs">System user</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={!formData.use_registered_purchaser}
                          onChange={() => setFormData({ ...formData, use_registered_purchaser: false, purchased_by: '' })}
                          className="rounded-full"
                        />
                        <span className="text-xs">Enter name</span>
                      </label>
                    </div>

                    {formData.use_registered_purchaser ? (
                      <select
                        value={formData.purchased_by}
                        onChange={(e) => handlePurchaserSelection(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md bg-background"
                      >
                        <option value="">Select purchaser...</option>
                        {adminUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.email} ({u.role})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={formData.purchased_by_name}
                        onChange={(e) => setFormData({ ...formData, purchased_by_name: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md bg-background"
                        placeholder="Enter purchaser name"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea
            rows="3"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-3 py-2 border rounded-md bg-background"
            placeholder="Reason for request, where it's going, or other details..."
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
            {loading ? 'Saving...' : isEditing ? 'Update Request' : 'Create Request'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
