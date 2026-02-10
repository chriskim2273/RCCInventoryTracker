import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatTimestamp, formatDate } from '@/lib/utils'
import { ArrowLeft, Edit, Trash2, Plus, Minus, UserCheck, UserX, ChevronDown, ChevronRight, History, RefreshCw, Lock, MessageSquare, Check, X } from 'lucide-react'
import ItemModal from '@/components/ItemModal'
import ReorderRequestModal from '@/components/ReorderRequestModal'
import CheckoutModal from '@/components/CheckoutModal'
import CheckinModal from '@/components/CheckinModal'
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal'
import { calculateItemAvailability, getItemStatus, formatItemStatus } from '@/lib/itemUtils'

export default function ItemDetail() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { canEdit, user, isAdmin, isCoordinator } = useAuth()

  // Admin comments state
  const [adminComments, setAdminComments] = useState([])
  const [showAdminComments, setShowAdminComments] = useState(false)
  const [newCommentText, setNewCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [item, setItem] = useState(null)
  const [logs, setLogs] = useState([])
  const [checkoutLogs, setCheckoutLogs] = useState([])
  const [activeCheckouts, setActiveCheckouts] = useState([])
  const [availability, setAvailability] = useState({ availableQuantity: 0, checkedOutQuantity: 0 })
  const [usersMap, setUsersMap] = useState(new Map())
  const [locationsMap, setLocationsMap] = useState(new Map())
  const [categoriesMap, setCategoriesMap] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [showCheckinModal, setShowCheckinModal] = useState(false)
  const [editingQuantity, setEditingQuantity] = useState(false)
  const [quantityInput, setQuantityInput] = useState('')
  const [showChangeLogs, setShowChangeLogs] = useState(false)
  const [showCheckoutLogs, setShowCheckoutLogs] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showReorderModal, setShowReorderModal] = useState(false)
  const [expandedLogIds, setExpandedLogIds] = useState(new Set())

  const getUserDisplayName = (user) => {
    if (!user) return 'Unknown User'
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`
    }
    return user.email || 'Unknown User'
  }

  useEffect(() => {
    fetchItemData()
  }, [itemId])

  const consolidateLogs = (logs) => {
    if (!logs || logs.length === 0) return []

    const consolidated = []
    let currentGroup = null
    const TIME_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

    // Logs come in descending order (newest first), so we process them that way
    logs.forEach((log) => {
      const logTime = new Date(log.timestamp).getTime()

      // Check if this log should be merged with the current group
      // Only consolidate 'update' actions (not check_in, check_out, create, delete)
      if (
        currentGroup &&
        currentGroup.user_id === log.user_id &&
        currentGroup.action === 'update' &&
        log.action === 'update' &&
        (currentGroup.lastTimestamp - logTime) < TIME_WINDOW_MS
      ) {
        // Since logs are in reverse order (newest first):
        // - currentGroup has the NEWEST changes
        // - log has OLDER changes
        // We want: old value from the OLDEST log, new value from the NEWEST log

        if (log.changes?.old) {
          Object.keys(log.changes.old).forEach((key) => {
            // Keep updating old values as we go back in time (this will be the oldest)
            currentGroup.mergedOldValues[key] = log.changes.old[key]
          })
        }
        if (log.changes?.new) {
          Object.keys(log.changes.new).forEach((key) => {
            // Only set new value if we haven't seen this field before
            // (first time we see it is the newest since we're going backwards)
            if (!(key in currentGroup.mergedNewValues)) {
              currentGroup.mergedNewValues[key] = log.changes.new[key]
            }
            // Also update old value as we go back
            if (log.changes?.old?.[key] !== undefined) {
              currentGroup.mergedOldValues[key] = log.changes.old[key]
            }
          })
        }
        currentGroup.count++
        currentGroup.firstTimestamp = logTime
        currentGroup.individualLogs.push(log) // Add to individual logs array
      } else {
        // Start a new group
        if (currentGroup) {
          // Update changes with merged values for consolidated groups
          if (currentGroup.count > 1) {
            currentGroup.changes = {
              old: currentGroup.mergedOldValues,
              new: currentGroup.mergedNewValues
            }
          }
          consolidated.push(currentGroup)
        }

        currentGroup = {
          ...log,
          count: 1,
          firstTimestamp: logTime,
          lastTimestamp: logTime,
          mergedOldValues: log.changes?.old ? { ...log.changes.old } : {},
          mergedNewValues: log.changes?.new ? { ...log.changes.new } : {},
          changes: log.changes,
          individualLogs: [log] // Keep track of individual logs for expansion
        }
      }
    })

    // Add the last group
    if (currentGroup) {
      // Update changes with merged values for consolidated groups
      if (currentGroup.count > 1) {
        currentGroup.changes = {
          old: currentGroup.mergedOldValues,
          new: currentGroup.mergedNewValues
        }
      }
      consolidated.push(currentGroup)
    }

    return consolidated
  }

  const fetchItemData = async () => {
    setLoading(true)

    try {
      // Fetch item, logs, checkout logs, and users separately since we removed FK constraints
      const [itemResult, logsData, checkoutLogsData, usersResult, locationsResult, categoriesResult] = await Promise.all([
        supabase
          .from('items')
          .select(`
            *,
            category:categories(name, icon),
            location:locations(name, path)
          `)
          .eq('id', itemId)
          .single(),
        supabase
          .from('item_logs')
          .select('*')
          .eq('item_id', itemId)
          .order('timestamp', { ascending: false })
          .limit(20),
        supabase
          .from('checkout_logs')
          .select('*')
          .eq('item_id', itemId)
          .order('checked_out_at', { ascending: false }),
        supabase
          .from('users')
          .select('id, email, first_name, last_name'),
        supabase
          .from('locations')
          .select('id, name, path'),
        supabase
          .from('categories')
          .select('id, name')
      ])

      // Create maps for lookups
      const usersMap = new Map((usersResult.data || []).map(user => [user.id, user]))
      const locationsMap = new Map((locationsResult.data || []).map(loc => [loc.id, loc]))
      const categoriesMap = new Map((categoriesResult.data || []).map(cat => [cat.id, cat]))

      setUsersMap(usersMap)
      setLocationsMap(locationsMap)
      setCategoriesMap(categoriesMap)

      const itemWithUsers = {
        ...itemResult.data,
        created_by_user: itemResult.data?.created_by ? usersMap.get(itemResult.data.created_by) : null,
        checked_out_by_user: itemResult.data?.checked_out_by ? usersMap.get(itemResult.data.checked_out_by) : null
      }

      setItem(itemWithUsers)

      // Calculate item availability
      const availabilityInfo = await calculateItemAvailability(itemWithUsers)
      setAvailability(availabilityInfo)
      setActiveCheckouts(availabilityInfo.activeCheckouts)

      // Manually join users to logs
      const logsWithUsers = (logsData.data || []).map(log => ({
        ...log,
        user: log.user_id ? usersMap.get(log.user_id) : null
      }))

      // Manually join users to checkout logs
      const checkoutLogsWithUsers = (checkoutLogsData.data || []).map(log => ({
        ...log,
        checked_out_to_user: log.checked_out_to_user_id ? usersMap.get(log.checked_out_to_user_id) : null,
        performed_by_user: log.performed_by ? usersMap.get(log.performed_by) : null
      }))

      setLogs(consolidateLogs(logsWithUsers))
      setCheckoutLogs(checkoutLogsWithUsers)

      // Fetch admin comments (RLS will return empty for non-admins)
      const { data: commentsData } = await supabase
        .from('item_admin_comments')
        .select('*')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })

      setAdminComments(commentsData || [])
    } catch (error) {
      console.error('Error fetching item:', error)
    } finally {
      setLoading(false)
    }
  }

  // Admin comment functions
  const handleAddComment = async () => {
    if (!newCommentText.trim() || !isAdmin) return

    setSubmittingComment(true)
    try {
      const userName = user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.email

      const { error } = await supabase
        .from('item_admin_comments')
        .insert({
          item_id: itemId,
          user_id: user.id,
          user_name: userName,
          content: newCommentText.trim()
        })

      if (error) throw error

      setNewCommentText('')
      // Refresh comments
      const { data: commentsData } = await supabase
        .from('item_admin_comments')
        .select('*')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })

      setAdminComments(commentsData || [])
    } catch (error) {
      console.error('Error adding comment:', error)
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleResolveComment = async (commentId) => {
    if (!isAdmin) return

    try {
      const userName = user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.email

      const { error } = await supabase
        .from('item_admin_comments')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
          resolved_by_name: userName
        })
        .eq('id', commentId)

      if (error) throw error

      // Refresh comments
      const { data: commentsData } = await supabase
        .from('item_admin_comments')
        .select('*')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })

      setAdminComments(commentsData || [])
    } catch (error) {
      console.error('Error resolving comment:', error)
    }
  }

  const handleDeleteComment = async (commentId) => {
    if (!isAdmin || !confirm('Are you sure you want to delete this comment?')) return

    try {
      const { error } = await supabase
        .from('item_admin_comments')
        .delete()
        .eq('id', commentId)

      if (error) throw error

      // Refresh comments
      const { data: commentsData } = await supabase
        .from('item_admin_comments')
        .select('*')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })

      setAdminComments(commentsData || [])
    } catch (error) {
      console.error('Error deleting comment:', error)
    }
  }


  const handleQuantityChange = async (delta) => {
    if (!item || item.is_unique || item.quantity === null) return

    const newQuantity = Math.max(0, item.quantity + delta)

    // Optimistically update local state
    setItem(prevItem => ({
      ...prevItem,
      quantity: newQuantity
    }))

    // Then update database
    const { error } = await supabase
      .from('items')
      .update({ quantity: newQuantity })
      .eq('id', itemId)

    if (error) {
      // Revert on error
      console.error('Error updating quantity:', error)
      fetchItemData()
    }
  }

  const startEditingQuantity = () => {
    if (!canEdit || item.is_unique || item.quantity === null) return
    setQuantityInput(String(item.quantity))
    setEditingQuantity(true)
  }

  const saveQuantity = async () => {
    const newQuantity = parseInt(quantityInput)
    if (isNaN(newQuantity) || newQuantity < 0) {
      setEditingQuantity(false)
      return
    }

    // Only update if value actually changed
    if (newQuantity === item.quantity) {
      setEditingQuantity(false)
      return
    }

    // Optimistically update local state
    setItem(prevItem => ({
      ...prevItem,
      quantity: newQuantity
    }))
    setEditingQuantity(false)

    // Then update database
    const { error } = await supabase
      .from('items')
      .update({ quantity: newQuantity })
      .eq('id', itemId)

    if (error) {
      // Revert on error
      console.error('Error updating quantity:', error)
      fetchItemData()
    }
  }

  const handleQuantityKeyDown = (e) => {
    if (e.key === 'Enter') {
      saveQuantity()
    } else if (e.key === 'Escape') {
      setEditingQuantity(false)
    }
  }

  const prepareDelete = () => {
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    const { error } = await supabase
      .from('items')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user?.id,
      })
      .eq('id', itemId)

    if (!error) {
      if (location.state?.from) {
        const search = location.state.search ? `?${location.state.search}` : ''
        navigate(`${location.state.from}${search}`)
      } else {
        navigate('/locations')
      }
    }
  }

  const formatFieldName = (key) => {
    const fieldNames = {
      name: 'Name',
      brand: 'Brand',
      model: 'Model',
      serial_number: 'Serial Number',
      stony_brook_asset_tag: 'Stony Brook Asset Tag',
      quantity: 'Quantity',
      min_quantity: 'Min Quantity',
      is_unique: 'Unique Item',
      category_id: 'Category',
      location_id: 'Location',
      checked_out_by: 'Checked Out By',
      image_url: 'Image',
      description: 'Description',
      deleted_at: 'Deleted At',
      deleted_by: 'Deleted By',
    }
    return fieldNames[key] || key
  }

  const formatValue = (value, key) => {
    if (value === null || value === undefined) return 'None'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'

    // Handle specific ID fields
    if (key === 'location_id') {
      if (locationsMap.has(value)) {
        return locationsMap.get(value).path || locationsMap.get(value).name
      }
      return 'Unknown Location'
    }
    if (key === 'category_id') {
      if (categoriesMap.has(value)) {
        return categoriesMap.get(value).name
      }
      return 'Unknown Category'
    }
    if ((key === 'checked_out_by' || key === 'created_by' || key === 'user_id' || key === 'deleted_by') && typeof value === 'string') {
      if (usersMap.has(value)) {
        return getUserDisplayName(usersMap.get(value))
      }
      return 'Unknown User'
    }

    if (typeof value === 'string' && value.length === 0) return '(empty)'

    // Check if it's a UUID (only if not one of the specific keys above)
    if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      return '(changed)'
    }
    // Truncate very long URLs
    if (typeof value === 'string' && value.startsWith('http') && value.length > 50) {
      return 'Image updated'
    }
    return String(value)
  }

  const shouldShowField = (key) => {
    const hiddenFields = [
      'id',
      'created_at',
      'updated_at',
      'created_by',
      'checkout_log_id'
    ]
    return !hiddenFields.includes(key)
  }

  const toggleLogExpansion = (logId) => {
    setExpandedLogIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(logId)) {
        newSet.delete(logId)
      } else {
        newSet.add(logId)
      }
      return newSet
    })
  }

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>
  }

  if (!item) {
    return <div className="text-center py-8 text-muted-foreground">Item not found</div>
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <div className="bg-card border rounded-lg p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold truncate">{item.name}</h1>
                <p className="text-sm sm:text-base text-muted-foreground mt-1">
                  {item.category?.icon && <span className="mr-1">{item.category.icon}</span>}
                  {item.category?.name || 'Uncategorized'}
                </p>
              </div>

              {canEdit && (
                <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="p-2 hover:bg-muted rounded-md"
                    title="Edit item"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={prepareDelete}
                    className="p-2 hover:bg-destructive/10 text-destructive rounded-md"
                    title="Delete item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {item.image_url && (
              <div className="mb-4">
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-full max-w-md h-auto rounded-lg border object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none'
                  }}
                />
              </div>
            )}

            {item.description && (
              <div className="mb-4 p-3 bg-muted/30 rounded-lg border border-border">
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">Description</p>
                <p className="text-sm sm:text-base whitespace-pre-wrap">{item.description}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Brand</p>
                <p className="font-medium text-sm sm:text-base">{item.brand || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Model</p>
                <p className="font-medium text-sm sm:text-base">{item.model || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Serial Number</p>
                <p className="font-medium text-sm sm:text-base break-all">{item.serial_number || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Stony Brook Asset Tag</p>
                <p className="font-medium text-sm sm:text-base break-all">{item.stony_brook_asset_tag || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Location</p>
                {item.location_id ? (
                  <button
                    onClick={() => navigate(`/locations/${item.location_id}`)}
                    className="font-medium text-sm sm:text-base truncate text-left text-primary hover:underline"
                    title={`Go to ${item.location?.path || 'location'}`}
                  >
                    {item.location?.path || 'Unknown'}
                  </button>
                ) : (
                  <p className="font-medium text-sm sm:text-base truncate" title="Unknown">Unknown</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs sm:text-sm text-muted-foreground">Min Quantity Threshold</p>
                <p className="font-medium text-sm sm:text-base">
                  {item.min_quantity !== null && item.min_quantity !== undefined ? (
                    <span className={item.quantity < item.min_quantity ? 'text-orange-600 dark:text-orange-400' : ''}>
                      {item.min_quantity}
                      {item.quantity < item.min_quantity && ' ⚠️ Below threshold'}
                    </span>
                  ) : (
                    'Not set'
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-lg overflow-hidden">
            <button
              onClick={() => setShowCheckoutLogs(!showCheckoutLogs)}
              className="w-full flex items-center justify-between p-4 sm:p-6 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 sm:h-5 sm:w-5" />
                <h2 className="text-lg sm:text-xl font-semibold">Checkout History</h2>
                <span className="text-xs sm:text-sm text-muted-foreground">({checkoutLogs.length})</span>
              </div>
              {showCheckoutLogs ? (
                <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              )}
            </button>

            {showCheckoutLogs && (
              <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                {checkoutLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No checkout history</p>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {checkoutLogs.map((log) => (
                      <div key={log.id} className="p-3 sm:p-4 bg-muted/30 rounded-md border border-border">
                        <div className="mb-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-muted-foreground font-medium uppercase">Checked Out To:</span>
                            {!log.checked_in_at && (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                Currently Out
                              </span>
                            )}
                          </div>

                          <p className="text-lg font-semibold">
                            {log.checked_out_to || <span className="font-normal">Reservation: {log.reservation_id}</span>}
                          </p>
                          {log.checked_out_to && log.reservation_id && (
                            <p className="text-sm text-muted-foreground">Reservation ID: {log.reservation_id}</p>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground space-y-0.5 mb-3">
                          <p>
                            <span className="font-medium">Checked Out:</span>{' '}
                            {formatTimestamp(log.checked_out_at)}
                          </p>
                          {log.checked_in_at && (
                            <p>
                              <span className="font-medium">Checked In:</span>{' '}
                              {formatTimestamp(log.checked_in_at)}
                            </p>
                          )}
                          <p>
                            <span className="font-medium">Performed By:</span> {getUserDisplayName(log.performed_by_user)}
                          </p>
                        </div>

                        {log.checkout_notes && (
                          <div className="mb-2 text-sm p-2 bg-background rounded border">
                            <p className="text-muted-foreground font-medium text-xs mb-1">Checkout Notes:</p>
                            <p>{log.checkout_notes}</p>
                          </div>
                        )}
                        {log.checkin_notes && (
                          <div className="text-sm p-2 bg-background rounded border">
                            <p className="text-muted-foreground font-medium text-xs mb-1">Check-in Notes:</p>
                            <p>{log.checkin_notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-card border rounded-lg overflow-hidden">
            <button
              onClick={() => setShowChangeLogs(!showChangeLogs)}
              className="w-full flex items-center justify-between p-4 sm:p-6 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-semibold">Change Log</h2>
                <span className="text-xs sm:text-sm text-muted-foreground">({logs.length})</span>
              </div>
              {showChangeLogs ? (
                <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              )}
            </button>

            {showChangeLogs && (
              <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                {logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No logs yet</p>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {logs.map((log) => (
                      <div key={log.id} className="p-3 sm:p-4 bg-muted/30 rounded-md border border-border">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex px-2 py-1 rounded-full text-xs font-medium capitalize ${log.action === 'create'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : log.action === 'update'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                  : log.action === 'check_out'
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                    : log.action === 'check_in'
                                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                }`}
                            >
                              {log.action.replace('_', ' ')}
                            </span>
                            {log.count > 1 && (
                              <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                {log.count} edits
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatTimestamp(log.timestamp)}
                          </p>
                        </div>
                        <p className="text-sm mb-2">
                          <span className="font-medium">{getUserDisplayName(log.user)}</span>
                        </p>
                        {log.changes && (
                          <div className="text-xs space-y-1 mt-2 pt-2 border-t border-border">
                            {log.action === 'create' && log.changes.new && (
                              <div className="space-y-1">
                                <p className="font-medium text-muted-foreground">Initial values:</p>
                                <div className="ml-2 space-y-0.5">
                                  {Object.entries(log.changes.new).map(([key, value]) => {
                                    if (!shouldShowField(key)) return null
                                    return (
                                      <p key={key}>
                                        <span className="text-muted-foreground">{formatFieldName(key)}:</span>{' '}
                                        <span className="font-medium">{formatValue(value, key)}</span>
                                      </p>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                            {(log.action === 'update' || log.action === 'check_out' || log.action === 'check_in') && log.changes.old && log.changes.new && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium text-muted-foreground">Changes:</p>
                                  {log.count > 1 && (
                                    <button
                                      onClick={() => toggleLogExpansion(log.id)}
                                      className="text-xs text-primary hover:underline flex items-center gap-1"
                                    >
                                      {expandedLogIds.has(log.id) ? 'Hide details' : 'Show details'}
                                      {expandedLogIds.has(log.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                    </button>
                                  )}
                                </div>
                                <div className="ml-2 space-y-1">
                                  {Object.keys(log.changes.new).map((key) => {
                                    if (!shouldShowField(key)) return null
                                    const oldValue = log.changes.old[key]
                                    const newValue = log.changes.new[key]
                                    if (oldValue === newValue) return null
                                    return (
                                      <div key={key} className="flex items-start gap-2">
                                        <span className="text-muted-foreground min-w-32">{formatFieldName(key)}:</span>
                                        <div className="flex-1">
                                          <span className="line-through text-red-600 dark:text-red-400">
                                            {formatValue(oldValue, key)}
                                          </span>
                                          {' → '}
                                          <span className="text-green-600 dark:text-green-400 font-medium">
                                            {formatValue(newValue, key)}
                                          </span>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>

                                {log.count > 1 && expandedLogIds.has(log.id) && log.individualLogs && (
                                  <div className="mt-3 pt-3 border-t border-border">
                                    <p className="text-xs font-medium text-muted-foreground mb-2">Individual changes ({log.count}):</p>
                                    <div className="space-y-2">
                                      {log.individualLogs.map((individualLog, idx) => (
                                        <div key={individualLog.id} className="ml-2 p-2 bg-background rounded border text-xs">
                                          <p className="text-muted-foreground mb-1">
                                            {formatTimestamp(individualLog.timestamp)}
                                          </p>
                                          {individualLog.changes?.old && individualLog.changes?.new && (
                                            <div className="space-y-0.5">
                                              {Object.keys(individualLog.changes.new).map((key) => {
                                                if (!shouldShowField(key)) return null
                                                const oldVal = individualLog.changes.old[key]
                                                const newVal = individualLog.changes.new[key]
                                                if (oldVal === newVal) return null
                                                return (
                                                  <div key={key} className="flex items-start gap-2">
                                                    <span className="text-muted-foreground min-w-24">{formatFieldName(key)}:</span>
                                                    <div className="flex-1">
                                                      <span className="text-red-600 dark:text-red-400">{formatValue(oldVal, key)}</span>
                                                      {' → '}
                                                      <span className="text-green-600 dark:text-green-400">{formatValue(newVal, key)}</span>
                                                    </div>
                                                  </div>
                                                )
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Admin Comments Section - Only visible to admins */}
          {isAdmin && (
            <div className="bg-card border rounded-lg overflow-hidden border-purple-200 dark:border-purple-900">
              <button
                onClick={() => setShowAdminComments(!showAdminComments)}
                className="w-full flex items-center justify-between p-4 sm:p-6 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
                  <h2 className="text-lg sm:text-xl font-semibold">Admin Comments</h2>
                  <span className="text-xs sm:text-sm text-muted-foreground">({adminComments.length})</span>
                  {adminComments.filter(c => !c.resolved_at).length > 0 && (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                      {adminComments.filter(c => !c.resolved_at).length} unresolved
                    </span>
                  )}
                </div>
                {showAdminComments ? (
                  <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                )}
              </button>

              {showAdminComments && (
                <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                  {/* Add Comment Form */}
                  <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-900">
                    <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-2 flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      Add Admin Comment
                    </p>
                    <textarea
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      placeholder="Enter your comment... (only visible to admins)"
                      rows={2}
                      className="w-full px-3 py-2 border rounded-md bg-background text-sm resize-none"
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={handleAddComment}
                        disabled={!newCommentText.trim() || submittingComment}
                        className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        {submittingComment ? 'Adding...' : 'Add Comment'}
                      </button>
                    </div>
                  </div>

                  {/* Comments List */}
                  {adminComments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No admin comments yet</p>
                  ) : (
                    <div className="space-y-3">
                      {adminComments.map((comment) => (
                        <div
                          key={comment.id}
                          className={`p-3 sm:p-4 rounded-md border ${comment.resolved_at
                            ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900'
                            : 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900'
                            }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {comment.resolved_at ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  <Check className="h-3 w-3" />
                                  Resolved
                                </span>
                              ) : (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                  Unresolved
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {comment.user_name} • {formatTimestamp(comment.created_at)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {!comment.resolved_at && (
                                <button
                                  onClick={() => handleResolveComment(comment.id)}
                                  className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                                  title="Mark as resolved"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                title="Delete comment"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <p className={`text-sm ${comment.resolved_at ? 'text-muted-foreground' : ''}`}>
                            {comment.content}
                          </p>
                          {comment.resolved_at && comment.resolved_by_name && (
                            <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-green-200 dark:border-green-900">
                              Resolved by {comment.resolved_by_name} • {formatTimestamp(comment.resolved_at)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="order-first lg:order-none space-y-3 sm:space-y-4">
          <div className="bg-card border rounded-lg p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Quantity</h3>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              {editingQuantity ? (
                <input
                  type="number"
                  min="0"
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(e.target.value)}
                  onBlur={saveQuantity}
                  onKeyDown={handleQuantityKeyDown}
                  autoFocus
                  className="text-2xl sm:text-3xl font-bold w-24 sm:w-32 px-2 py-1 border rounded-md bg-background"
                />
              ) : (
                <span
                  onClick={startEditingQuantity}
                  className={`text-2xl sm:text-3xl font-bold ${canEdit && !item.is_unique && item.quantity !== null ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
                  title={canEdit && !item.is_unique && item.quantity !== null ? 'Click to edit quantity' : ''}
                >
                  {item.quantity === null ? 'Unknown' : item.quantity}
                </span>
              )}
              {!item.is_unique && canEdit && !editingQuantity && item.quantity !== null && (
                <div className="flex gap-1.5 sm:gap-2">
                  <button
                    onClick={() => handleQuantityChange(-1)}
                    className="p-2 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-300 rounded-md transition-colors"
                    title="Decrease by 1"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleQuantityChange(1)}
                    className="p-2 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-300 rounded-md transition-colors"
                    title="Increase by 1"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {item.is_unique && (
              <p className="text-xs text-muted-foreground">This is a unique item</p>
            )}
            {item.quantity === null && (
              <p className="text-xs text-muted-foreground">Quantity is unknown. Edit this item to set a quantity.</p>
            )}
            {!item.is_unique && item.quantity !== null && canEdit && (
              <p className="text-xs text-muted-foreground">Click number to set value, or use +/- buttons</p>
            )}
          </div>

          <div className="bg-card border rounded-lg p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Availability</h3>
            {(() => {
              const status = getItemStatus(item, availability.availableQuantity, availability.checkedOutQuantity)
              const statusText = formatItemStatus(status, availability.availableQuantity, item.quantity)

              let bgColor = 'bg-green-100 dark:bg-green-900/30'
              let textColor = 'text-green-800 dark:text-green-200'

              if (status === 'unknown_quantity') {
                bgColor = 'bg-gray-100 dark:bg-gray-900/30'
                textColor = 'text-gray-800 dark:text-gray-200'
              } else if (status === 'out_of_stock') {
                bgColor = 'bg-red-100 dark:bg-red-900/30'
                textColor = 'text-red-800 dark:text-red-200'
              } else if (status === 'fully_checked_out') {
                bgColor = 'bg-yellow-100 dark:bg-yellow-900/30'
                textColor = 'text-yellow-800 dark:text-yellow-200'
              } else if (status === 'partially_available') {
                bgColor = 'bg-blue-100 dark:bg-blue-900/30'
                textColor = 'text-blue-800 dark:text-blue-200'
              }

              return (
                <div>
                  <div className={`flex items-center justify-between gap-2 mb-4 p-3 rounded-md ${bgColor}`}>
                    <div className="flex items-center gap-2 flex-1">
                      <UserCheck className="h-4 w-4" />
                      <div>
                        <p className={`text-sm font-medium ${textColor}`}>{statusText}</p>
                        {activeCheckouts.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {activeCheckouts.length} active checkout{activeCheckouts.length > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {activeCheckouts.length > 0 && (
                    <div className="mb-4 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Active Checkouts:</p>
                      {activeCheckouts.slice(0, 3).map((checkout) => {
                        const outQty = (checkout.quantity_checked_out || 0) - (checkout.quantity_checked_in || 0)
                        return (
                          <div key={checkout.id} className="text-xs p-2 bg-muted/30 rounded">
                            <p className="font-medium">
                              {checkout.checked_out_to || `Reservation: ${checkout.reservation_id}`}
                            </p>
                            <p className="text-muted-foreground">
                              {outQty} unit{outQty > 1 ? 's' : ''} • {formatDate(checkout.checked_out_at)}
                            </p>
                          </div>
                        )
                      })}
                      {activeCheckouts.length > 3 && (
                        <p className="text-xs text-muted-foreground">+ {activeCheckouts.length - 3} more</p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {canEdit && (availability.availableQuantity > 0 || status === 'unknown_quantity') && (
                      <button
                        onClick={() => setShowCheckoutModal(true)}
                        className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90"
                      >
                        <UserCheck className="h-4 w-4" />
                        Check Out
                      </button>
                    )}
                    {canEdit && activeCheckouts.length > 0 && (
                      <button
                        onClick={() => setShowCheckinModal(true)}
                        className="flex-1 flex items-center justify-center gap-2 border border-primary text-primary px-4 py-2 rounded-md hover:bg-primary/10"
                      >
                        <UserX className="h-4 w-4" />
                        Check In
                      </button>
                    )}
                    {canEdit && availability.availableQuantity === 0 && activeCheckouts.length === 0 && status !== 'unknown_quantity' && (
                      <button
                        disabled
                        className="flex-1 flex items-center justify-center gap-2 bg-muted text-muted-foreground px-4 py-2 rounded-md cursor-not-allowed opacity-50"
                        title="Cannot check out - out of stock"
                      >
                        <UserCheck className="h-4 w-4" />
                        Check Out
                      </button>
                    )}
                  </div>

                  {/* Request Restock Button - Admin/Coordinator only */}
                  {(isAdmin) && (
                    <button
                      onClick={() => setShowReorderModal(true)}
                      className="w-full flex items-center justify-center gap-2 bg-indigo-500 text-white px-4 py-2 rounded-md hover:bg-indigo-600 transition-colors mt-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Request Restock
                    </button>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      <ItemModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={fetchItemData}
        item={item}
      />

      <CheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        onSuccess={fetchItemData}
        item={item}
      />

      <CheckinModal
        isOpen={showCheckinModal}
        onClose={() => setShowCheckinModal(false)}
        onSuccess={fetchItemData}
        item={item}
      />

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Delete Item"
        itemName={item?.name || ''}
        itemType="item"
        userEmail={user?.email || ''}
        affectedData={null}
      />

      <ReorderRequestModal
        isOpen={showReorderModal}
        onClose={() => setShowReorderModal(false)}
        onSuccess={() => setShowReorderModal(false)}
        preselectedItem={item}
      />
    </div >
  )
}
