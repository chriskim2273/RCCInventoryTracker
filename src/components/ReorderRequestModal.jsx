import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { formatDate as utilsFormatDate, formatTimestamp as utilsFormatTimestamp, parseTimestamp } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import Modal from './Modal'
import ItemPicker, { ItemPickerTrigger } from './ItemPicker'
import CreateItemFromRequestModal from './CreateItemFromRequestModal'
import { ExternalLink, Pencil, RefreshCw, Trash2, PackagePlus } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'new_request', label: 'New Request' },
  { value: 'approved_pending', label: 'Approved / Pending Purchase' },
  { value: 'purchased', label: 'Purchased' },
  { value: 'arrived', label: 'Arrived' },
  { value: 'documented', label: 'Documented' },
  { value: 'rejected', label: 'Rejected' },
]

const STATUS_CONFIG = {
  new_request: { label: 'New Request', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' },
  approved_pending: { label: 'Approved / Pending', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' },
  purchased: { label: 'Purchased', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200' },
  arrived: { label: 'Arrived', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200' },
  documented: { label: 'Documented', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' },
}

const PRIORITY_CONFIG = {
  high: { label: 'High', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' },
  standard: { label: 'Standard', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-200' },
}

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A'
  return utilsFormatDate(dateStr, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const formatDateTime = (dateStr) => {
  if (!dateStr) return 'N/A'
  return utilsFormatTimestamp(dateStr, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Get local datetime string for datetime-local input (not UTC)
const getLocalDateTimeString = (date = new Date()) => {
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60 * 1000)
  return localDate.toISOString().slice(0, 16)
}


export default function ReorderRequestModal({
  isOpen,
  onClose,
  onSuccess,
  request = null,
  preselectedItem = null
}) {
  const { user, canEdit } = useAuth()
  const [mode, setMode] = useState('view') // 'view', 'edit', or 'status'
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
    date_requested: getLocalDateTimeString(),
    priority: 'standard',
    quantity_to_order: 1,
    units_per_pack: '',
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
  const [showItemPicker, setShowItemPicker] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCreateItemModal, setShowCreateItemModal] = useState(false)

  // State for Quick Quantity Update
  const [quickQty, setQuickQty] = useState('')
  const [updatingQty, setUpdatingQty] = useState(false)

  // Separate state for status update form
  const [statusFormData, setStatusFormData] = useState({
    status: 'new_request',
    purchased_by: '',
    purchased_by_name: '',
    use_registered_purchaser: true,
    rejection_reason: '',
  })

  const isExistingRequest = !!request

  useEffect(() => {
    if (isOpen) {
      fetchOptions()

      if (request) {
        // Viewing/editing existing request - start in view mode
        setMode('view')
        setFormData({
          is_new_item: !request.item_id,
          item_id: request.item_id || '',
          item_name: request.item_name || '',
          item_brand: request.item_brand || '',
          item_model: request.item_model || '',
          item_category_id: request.item_category_id || '',
          date_requested: request.date_requested ? getLocalDateTimeString(parseTimestamp(request.date_requested)) : getLocalDateTimeString(),
          priority: request.priority || 'standard',
          quantity_to_order: request.quantity_to_order || 1,
          units_per_pack: request.units_per_pack || '',
          order_link: request.order_link || '',
          location_id: request.location_id || '',
          notes: request.notes || '',
          status: request.status || 'new_request',
          purchased_by: request.purchased_by || '',
          purchased_by_name: request.purchased_by_name || '',
          use_registered_purchaser: !!request.purchased_by || !request.purchased_by_name,
        })

        // Fetch current quantity if item exists
        if (request.item_id) {
          fetchCurrentItemQuantity(request.item_id)
        }

        // Initialize status form data
        setStatusFormData({
          status: request.status || 'new_request',
          purchased_by: request.purchased_by || '',
          purchased_by_name: request.purchased_by_name || '',
          use_registered_purchaser: !!request.purchased_by || !request.purchased_by_name,
          rejection_reason: request.rejection_reason || '',
        })
      } else if (preselectedItem) {
        // Creating from item detail page - start in edit mode
        setMode('edit')
        setFormData({
          is_new_item: false,
          item_id: preselectedItem.id,
          item_name: preselectedItem.name || '',
          item_brand: preselectedItem.brand || '',
          item_model: preselectedItem.model || '',
          item_category_id: preselectedItem.category_id || '',
          date_requested: getLocalDateTimeString(),
          priority: 'standard',
          quantity_to_order: 1,
          units_per_pack: '',
          order_link: preselectedItem.order_link || '',
          location_id: getCenterFromLocation(preselectedItem.location_id) || '',
          notes: '',
          status: 'new_request',
          purchased_by: '',
          purchased_by_name: '',
          use_registered_purchaser: true,
        })
      } else {
        // Creating new request - start in edit mode
        setMode('edit')
        setFormData({
          is_new_item: false,
          item_id: '',
          item_name: '',
          item_brand: '',
          item_model: '',
          item_category_id: '',
          date_requested: getLocalDateTimeString(),
          priority: 'standard',
          quantity_to_order: 1,
          units_per_pack: '',
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
    return locationId
  }

  const fetchOptions = async () => {
    const [itemsRes, categoriesRes, locationsRes, usersRes] = await Promise.all([
      supabase.from('items').select('id, name, brand, model, category_id, order_link, location_id').is('deleted_at', null).order('name'),
      supabase.from('categories').select('*').is('deleted_at', null).order('name'),
      supabase.from('locations').select('*').is('deleted_at', null).order('path'),
      supabase.from('users').select('*').eq('role', 'admin').order('first_name, last_name, email'),
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

  // Handle item selection from the new ItemPicker
  const handleItemPickerSelect = (selectedItem) => {
    setFormData({
      ...formData,
      item_id: selectedItem.id,
      item_name: selectedItem.name,
      item_brand: selectedItem.brand || '',
      item_model: selectedItem.model || '',
      item_category_id: selectedItem.category_id || '',
      order_link: selectedItem.order_link || formData.order_link,
      location_id: findCenterForLocation(selectedItem.location_id) || formData.location_id,
    })
    setShowItemPicker(false)
  }

  // Get selected item object for the picker
  const getSelectedItemForPicker = () => {
    return items.find(i => i.id === formData.item_id) || null
  }

  // Get category for selected item
  const getSelectedItemCategory = () => {
    const item = getSelectedItemForPicker()
    if (item) {
      return categories.find(c => c.id === item.category_id) || null
    }
    return null
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

      if (isExistingRequest) {
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

  const handleClose = () => {
    setMode('view')
    setShowDeleteConfirm(false)
    setShowCreateItemModal(false)
    onClose()
  }

  const handleCancelEdit = () => {
    // Reset form data to original request data and go back to view mode
    if (request) {
      setFormData({
        is_new_item: !request.item_id,
        item_id: request.item_id || '',
        item_name: request.item_name || '',
        item_brand: request.item_brand || '',
        item_model: request.item_model || '',
        item_category_id: request.item_category_id || '',
        date_requested: request.date_requested ? getLocalDateTimeString(parseTimestamp(request.date_requested)) : getLocalDateTimeString(),
        priority: request.priority || 'standard',
        quantity_to_order: request.quantity_to_order || 1,
        units_per_pack: request.units_per_pack || '',
        order_link: request.order_link || '',
        location_id: request.location_id || '',
        notes: request.notes || '',
        status: request.status || 'new_request',
        purchased_by: request.purchased_by || '',
        purchased_by_name: request.purchased_by_name || '',
        use_registered_purchaser: !!request.purchased_by || !request.purchased_by_name,
      })
      setMode('view')
      setError(null)
    } else {
      onClose()
    }
  }

  // Get display values for view mode
  const getCategoryDisplay = () => {
    const cat = categories.find(c => c.id === formData.item_category_id)
    return cat ? `${cat.icon} ${cat.name}` : 'No category'
  }

  const getLocationDisplay = () => {
    const loc = locations.find(l => l.id === formData.location_id)
    return loc?.name || 'Unknown'
  }

  const getRequestorDisplay = () => {
    if (request?.requested_by_name) return request.requested_by_name
    if (request?.requested_by_user) {
      const u = request.requested_by_user
      return u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.email
    }
    return 'Unknown'
  }

  const getPurchaserDisplay = () => {
    if (formData.purchased_by_name) return formData.purchased_by_name
    if (request?.purchased_by_user) {
      const u = request.purchased_by_user
      return u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.email
    }
    return null
  }

  // Handle status form purchaser selection
  const handleStatusPurchaserSelection = (userId) => {
    if (userId) {
      const selectedUser = adminUsers.find(u => u.id === userId)
      const displayName = selectedUser?.first_name && selectedUser?.last_name
        ? `${selectedUser.first_name} ${selectedUser.last_name}`
        : selectedUser?.email || ''
      setStatusFormData({
        ...statusFormData,
        purchased_by: userId,
        purchased_by_name: displayName,
      })
    } else {
      setStatusFormData({
        ...statusFormData,
        purchased_by: '',
        purchased_by_name: '',
      })
    }
  }

  // Handle status update submit
  const handleStatusSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Validate purchased_by is required when status is 'purchased'
      if (statusFormData.status === 'purchased') {
        const hasPurchaser = statusFormData.use_registered_purchaser
          ? statusFormData.purchased_by
          : statusFormData.purchased_by_name?.trim()
        if (!hasPurchaser) {
          throw new Error('Purchased By is required when setting status to Purchased')
        }
      }

      const updateData = {
        status: statusFormData.status,
        rejection_reason: statusFormData.status === 'rejected' ? statusFormData.rejection_reason : null,
      }

      // Handle purchased_by field
      if (statusFormData.status !== 'new_request' && statusFormData.status !== 'rejected' && statusFormData.status !== 'approved_pending') {
        if (statusFormData.use_registered_purchaser && statusFormData.purchased_by) {
          updateData.purchased_by = statusFormData.purchased_by
          updateData.purchased_by_name = statusFormData.purchased_by_name
        } else if (!statusFormData.use_registered_purchaser && statusFormData.purchased_by_name) {
          updateData.purchased_by = null
          updateData.purchased_by_name = statusFormData.purchased_by_name
        }
      }

      const { error: updateError } = await supabase
        .from('reorder_requests')
        .update(updateData)
        .eq('id', request.id)

      if (updateError) throw updateError

      // Send notification for status change (non-blocking)
      // Only send if status actually changed
      if (request.status !== statusFormData.status) {
        try {
          await supabase.functions.invoke('notify-admin-order-status-change', {
            body: {
              requestId: request.id,
              oldStatus: request.status,
              newStatus: statusFormData.status,
              changedByUserId: user?.id,
              changedByName: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : 'Unknown',
              itemName: request.item_name,
              itemBrand: request.item_brand,
              locationId: request.location_id,
              categoryId: request.item_category_id,
              priority: request.priority,
              quantity: request.quantity_to_order,
            }
          })
        } catch (notifyError) {
          // Don't fail the status update if notification fails
          console.error('Failed to send status change notification:', notifyError)
        }
      }

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error updating status:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Handle cancel status update
  const handleCancelStatus = () => {
    // Reset status form data to original
    setStatusFormData({
      status: request?.status || 'new_request',
      purchased_by: request?.purchased_by || '',
      purchased_by_name: request?.purchased_by_name || '',
      use_registered_purchaser: !!request?.purchased_by || !request?.purchased_by_name,
      rejection_reason: request?.rejection_reason || '',
    })
    setMode('view')
    setError(null)
  }

  // Handle delete
  const handleDelete = async () => {
    setLoading(true)
    setError(null)

    try {
      const { error: deleteError } = await supabase
        .from('reorder_requests')
        .delete()
        .eq('id', request.id)

      if (deleteError) throw deleteError

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error deleting reorder request:', err)
      setError(err.message)
      setShowDeleteConfirm(false)
    } finally {
      setLoading(false)
    }
  }

  const statusConfig = STATUS_CONFIG[formData.status] || STATUS_CONFIG.new_request
  const priorityConfig = PRIORITY_CONFIG[formData.priority] || PRIORITY_CONFIG.standard

  const fetchCurrentItemQuantity = async (itemId) => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('quantity')
        .eq('id', itemId)
        .single()

      if (data && !error) {
        setQuickQty(data.quantity)
      }
    } catch (err) {
      console.error('Error fetching item quantity:', err)
    }
  }

  const handleQuickQuantityUpdate = async () => {
    if (!formData.item_id || !quickQty) return

    setUpdatingQty(true)
    setError(null)

    try {
      const newQty = parseInt(quickQty)
      if (isNaN(newQty) || newQty < 0) {
        throw new Error('Please enter a valid quantity')
      }

      // 1. Update item quantity
      const { error: itemError } = await supabase
        .from('items')
        .update({ quantity: newQty })
        .eq('id', formData.item_id)

      if (itemError) throw itemError

      // 2. Update reorder request
      const { error: requestError } = await supabase
        .from('reorder_requests')
        .update({ quantity_updated_at: new Date().toISOString() })
        .eq('id', request.id)

      if (requestError) throw requestError

      // 3. Log the change
      const { error: logError } = await supabase
        .from('item_logs')
        .insert({
          item_id: formData.item_id,
          user_id: user.id,
          user_name: user.first_name ? `${user.first_name} ${user.last_name}` : user.email,
          action: 'update',
          details: {
            field: 'quantity',
            value: newQty,
            source: 'reorder_request_quick_update',
            request_id: request.id
          }
        })

      if (logError) console.error('Error logging quantity update:', logError)

      onSuccess() // Refresh parent data
      alert('Quantity updated successfully!')

    } catch (err) {
      console.error('Error updating quantity:', err)
      setError(err.message)
    } finally {
      setUpdatingQty(false)
    }
  }

  // Determine modal title
  const getModalTitle = () => {
    if (!isExistingRequest) return 'New Reorder Request'
    if (mode === 'view') return 'View Reorder Request'
    if (mode === 'status') return 'Update Status'
    return 'Edit Reorder Request'
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={getModalTitle()}
      size="lg"
    >
      {mode === 'view' ? (
        // VIEW MODE
        <div className="space-y-5">
          {/* Status and Priority Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${priorityConfig.color}`}>
              {priorityConfig.label} Priority
            </span>
          </div>

          {/* Rejection Reason */}
          {formData.status === 'rejected' && request?.rejection_reason && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-md text-sm">
              <span className="font-medium block mb-1">Rejection Reason:</span>
              <p>{request.rejection_reason}</p>
            </div>
          )}

          {/* Item Details */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <h3 className="font-semibold text-lg flex items-center">
              {formData.item_id ? (
                <Link
                  to={`/items/${formData.item_id}`}
                  target="_blank"
                  className="hover:underline flex items-center gap-2"
                >
                  {formData.item_name}
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </Link>
              ) : (
                formData.item_name
              )}
              {formData.item_brand && <span className="text-muted-foreground font-normal ml-2">({formData.item_brand})</span>}
            </h3>
            {formData.item_model && (
              <p className="text-sm text-muted-foreground mt-0.5">Model: {formData.item_model}</p>
            )}
            <div className="flex items-center gap-2 mt-2 text-sm">
              <span className="text-muted-foreground">Category:</span>
              <span>{getCategoryDisplay()}</span>
            </div>

            {/* Quick Quantity Update - Minimalist */}
            {mode === 'view' && formData.item_id && canEdit && (
              <div className={`mt-4 pt-3 border-t ${request?.quantity_updated_at ? 'border-yellow-200/50 dark:border-yellow-900/30' : 'border-border/10'}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <PackagePlus className="h-3 w-3" />
                        Quick Update Quantity
                      </label>
                      {request?.quantity_updated_at && (
                        <span className="text-[10px] text-yellow-600 dark:text-yellow-400 font-medium bg-yellow-100/50 dark:bg-yellow-900/20 px-1.5 py-0.5 rounded">
                          Updated {formatDate(request.quantity_updated_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={quickQty}
                        onChange={(e) => setQuickQty(e.target.value)}
                        className={`h-8 w-24 px-2 text-sm border rounded bg-background/50 focus:bg-background transition-colors ${request?.quantity_updated_at ? 'border-yellow-200 focus:border-yellow-400 dark:border-yellow-900 dark:focus:border-yellow-700' : ''}`}
                        placeholder="Qty"
                      />
                      <button
                        type="button"
                        onClick={handleQuickQuantityUpdate}
                        disabled={updatingQty}
                        className={`h-8 px-3 text-xs font-medium rounded transition-colors ${request?.quantity_updated_at
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:hover:bg-yellow-900/50'
                          : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                      >
                        {updatingQty ? '...' : 'Update'}
                      </button>
                    </div>
                    {request?.quantity_updated_at && (
                      <p className="text-[10px] text-yellow-600/80 dark:text-yellow-400/80 mt-1.5">
                        ⚠️ Already updated for this request.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quantity */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <span className="text-sm text-muted-foreground block">Quantity</span>
              <span className="font-medium text-lg">{formData.quantity_to_order}</span>
            </div>
            {formData.units_per_pack && (
              <div>
                <span className="text-sm text-muted-foreground block">Units/Pack</span>
                <span className="font-medium text-lg">{formData.units_per_pack}</span>
              </div>
            )}
          </div>

          {formData.units_per_pack && (
            <p className="text-sm text-muted-foreground -mt-2">
              Total units: {calculateTotalUnits()}
            </p>
          )}

          {/* Order Link */}
          {formData.order_link && (
            <div>
              <span className="text-sm text-muted-foreground block mb-1">Order Link</span>
              <a
                href={formData.order_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                {formData.order_link.length > 50
                  ? formData.order_link.substring(0, 50) + '...'
                  : formData.order_link}
              </a>
            </div>
          )}

          {/* Location and Requestor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-muted-foreground block">Location</span>
              <span className="font-medium">{getLocationDisplay()}</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground block">Requested By</span>
              <span className="font-medium">{getRequestorDisplay()}</span>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
            <div>
              <span className="text-sm text-muted-foreground block">Date Requested</span>
              <span className="font-medium">{formatDateTime(formData.date_requested)}</span>
            </div>
            {request?.purchased_on && (
              <div>
                <span className="text-sm text-muted-foreground block">Date Purchased</span>
                <span className="font-medium">{formatDate(request.purchased_on)}</span>
              </div>
            )}
            {getPurchaserDisplay() && (
              <div>
                <span className="text-sm text-muted-foreground block">Purchased By</span>
                <span className="font-medium">{getPurchaserDisplay()}</span>
              </div>
            )}
            {request?.arrived_on && (
              <div>
                <span className="text-sm text-muted-foreground block">Date Arrived</span>
                <span className="font-medium">{formatDate(request.arrived_on)}</span>
              </div>
            )}
            {request?.documented_on && (
              <div>
                <span className="text-sm text-muted-foreground block">Date Documented</span>
                <span className="font-medium">{formatDate(request.documented_on)}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          {formData.notes && (
            <div className="pt-2 border-t">
              <span className="text-sm text-muted-foreground block mb-1">Notes</span>
              <p className="text-sm whitespace-pre-wrap">{formData.notes}</p>
            </div>
          )}

          {/* Delete Confirmation */}
          {showDeleteConfirm && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
              <p className="text-sm font-medium text-destructive mb-3">
                Are you sure you want to delete this request? This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={loading}
                  className="px-3 py-1.5 text-sm border rounded-md hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-3 py-1.5 text-sm bg-destructive text-destructive-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <div>
              {canEdit && !showDeleteConfirm && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 border rounded-md hover:bg-secondary transition-colors"
              >
                Close
              </button>
              {canEdit && (
                <>
                  {/* Create as Item button - shown when arrived and not linked to existing item */}
                  {request?.status === 'arrived' && !request?.item_id && (
                    <button
                      type="button"
                      onClick={() => setShowCreateItemModal(true)}
                      className="flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 dark:border-green-700 dark:text-green-300 rounded-md hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                    >
                      <PackagePlus className="h-4 w-4" />
                      Create as Item
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setMode('status')}
                    className="flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Update Status
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('edit')}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : mode === 'status' ? (
        // STATUS UPDATE MODE
        <form onSubmit={handleStatusSubmit} className="space-y-5">
          {error && (
            <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Current Status Display */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <span className="text-sm text-muted-foreground block mb-2">Current Status</span>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>

          {/* New Status Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">New Status *</label>
            <select
              required
              value={statusFormData.status}
              onChange={(e) => setStatusFormData({ ...statusFormData, status: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Rejection Reason - only show for rejected status */}
          {statusFormData.status === 'rejected' && (
            <div>
              <label className="block text-sm font-medium mb-2">Rejection Reason *</label>
              <textarea
                required
                value={statusFormData.rejection_reason}
                onChange={(e) => setStatusFormData({ ...statusFormData, rejection_reason: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
                rows="3"
                placeholder="Please enter a reason for rejection..."
              />
            </div>
          )}

          {/* Purchased By - only show for relevant statuses (purchased, arrived, documented) */}
          {statusFormData.status !== 'new_request' && statusFormData.status !== 'rejected' && statusFormData.status !== 'approved_pending' && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Purchased By {statusFormData.status === 'purchased' && <span className="text-destructive">*</span>}
              </label>
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={statusFormData.use_registered_purchaser}
                      onChange={() => setStatusFormData({ ...statusFormData, use_registered_purchaser: true, purchased_by: '', purchased_by_name: '' })}
                      className="rounded-full"
                    />
                    <span className="text-sm">System user</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!statusFormData.use_registered_purchaser}
                      onChange={() => setStatusFormData({ ...statusFormData, use_registered_purchaser: false, purchased_by: '' })}
                      className="rounded-full"
                    />
                    <span className="text-sm">Enter name</span>
                  </label>
                </div>

                {statusFormData.use_registered_purchaser ? (
                  <select
                    value={statusFormData.purchased_by}
                    onChange={(e) => handleStatusPurchaserSelection(e.target.value)}
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
                    value={statusFormData.purchased_by_name}
                    onChange={(e) => setStatusFormData({ ...statusFormData, purchased_by_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    placeholder="Enter purchaser name"
                  />
                )}
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={handleCancelStatus}
              className="px-4 py-2 border rounded-md hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </form>
      ) : (
        // EDIT MODE
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Item Selection */}
          <div className="space-y-4">
            {/* Toggle between existing/new item */}
            <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_new_item: false, item_id: '', item_name: '', item_brand: '', item_model: '', item_category_id: '' })}
                disabled={isExistingRequest}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${!formData.is_new_item
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
                  } ${isExistingRequest ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Existing Item
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_new_item: true, item_id: '' })}
                disabled={isExistingRequest}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${formData.is_new_item
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
                  } ${isExistingRequest ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                New Item
              </button>
            </div>

            {!formData.is_new_item ? (
              /* Command-palette style item picker */
              <div>
                <label className="block text-sm font-medium mb-2">Select Item *</label>
                <ItemPickerTrigger
                  selectedItem={getSelectedItemForPicker()}
                  category={getSelectedItemCategory()}
                  onClick={() => !isExistingRequest && setShowItemPicker(true)}
                  disabled={isExistingRequest}
                  placeholder="Search and select an item..."
                />
                {formData.item_id && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500"></span>
                    Item linked to inventory
                  </p>
                )}
              </div>
            ) : (
              /* New item form */
              <div className="bg-muted/30 p-4 rounded-xl space-y-4 border border-dashed border-border">
                <div>
                  <label className="block text-sm font-medium mb-1">Item Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.item_name}
                    onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="Enter item name"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Brand</label>
                    <input
                      type="text"
                      value={formData.item_brand}
                      onChange={(e) => setFormData({ ...formData, item_brand: e.target.value })}
                      className="w-full px-3 py-2.5 border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      placeholder="Brand name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Model</label>
                    <input
                      type="text"
                      value={formData.item_model}
                      onChange={(e) => setFormData({ ...formData, item_model: e.target.value })}
                      className="w-full px-3 py-2.5 border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      placeholder="Model number"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select
                    value={formData.item_category_id}
                    onChange={(e) => setFormData({ ...formData, item_category_id: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  >
                    <option value="">Select category...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Order Link</label>
                  <input
                    type="url"
                    value={formData.order_link}
                    onChange={(e) => setFormData({ ...formData, order_link: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="https://..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    URL for ordering this item (optional)
                  </p>
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
                disabled={isExistingRequest}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Priority *</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: 'standard' })}
                  className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${formData.priority === 'standard'
                    ? 'bg-gray-100 border-gray-400 text-gray-800 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-100'
                    : 'bg-background border-border text-muted-foreground hover:bg-muted'
                    }`}
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: 'high' })}
                  className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${formData.priority === 'high'
                    ? 'bg-red-100 border-red-400 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-200'
                    : 'bg-background border-border text-muted-foreground hover:bg-muted'
                    }`}
                >
                  High
                </button>
              </div>
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
              {!formData.is_new_item && formData.item_id ? (
                <>
                  <div className="w-full px-3 py-2 border rounded-md bg-muted/50 text-muted-foreground">
                    {getCategoryDisplay()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Inherited from item. Edit the item directly to change.
                  </p>
                </>
              ) : (
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
              )}
            </div>
          </div>

          {/* Quantity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>

          {/* Order Link - Auto-filled from item */}
          {formData.order_link && (
            <div>
              <label className="block text-sm font-medium mb-1">Order Link</label>
              <div className="flex gap-2">
                <div className="flex-1 px-3 py-2 border rounded-md bg-muted/50 text-muted-foreground truncate">
                  {formData.order_link}
                </div>
                <a
                  href={formData.order_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 border rounded-md hover:bg-secondary transition-colors"
                  title="Open link"
                >
                  <ExternalLink className="h-5 w-5" />
                </a>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Auto-filled from item. Edit the item directly to change.
              </p>
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
              onClick={handleCancelEdit}
              className="px-4 py-2 border rounded-md hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Saving...' : isExistingRequest ? 'Save Changes' : 'Create Request'}
            </button>
          </div>
        </form>
      )}

      {/* Item Picker Overlay */}
      <ItemPicker
        items={items}
        categories={categories}
        locations={locations}
        selectedItemId={formData.item_id}
        onSelect={handleItemPickerSelect}
        onClose={() => setShowItemPicker(false)}
        isOpen={showItemPicker}
        disabled={isExistingRequest}
      />

      {/* Create Item from Request Modal */}
      <CreateItemFromRequestModal
        isOpen={showCreateItemModal}
        onClose={() => setShowCreateItemModal(false)}
        onSuccess={() => {
          setShowCreateItemModal(false)
          onSuccess()
          onClose()
        }}
        request={request}
      />
    </Modal>
  )
}
