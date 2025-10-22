import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { ArrowLeft, Edit, Trash2, Plus, Minus, UserCheck, UserX, ChevronDown, ChevronRight, History } from 'lucide-react'
import ItemModal from '@/components/ItemModal'
import CheckoutModal from '@/components/CheckoutModal'
import CheckinModal from '@/components/CheckinModal'
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal'

export default function ItemDetail() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const { canEdit, user } = useAuth()
  const [item, setItem] = useState(null)
  const [logs, setLogs] = useState([])
  const [checkoutLogs, setCheckoutLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [showCheckinModal, setShowCheckinModal] = useState(false)
  const [editingQuantity, setEditingQuantity] = useState(false)
  const [quantityInput, setQuantityInput] = useState('')
  const [showChangeLogs, setShowChangeLogs] = useState(false)
  const [showCheckoutLogs, setShowCheckoutLogs] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [expandedLogIds, setExpandedLogIds] = useState(new Set())

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
      const { data: itemData } = await supabase
        .from('items')
        .select(`
          *,
          category:categories(name, icon),
          location:locations(name, path),
          created_by_user:users!items_created_by_fkey(email),
          checked_out_by_user:users!items_checked_out_by_fkey(email)
        `)
        .eq('id', itemId)
        .single()

      setItem(itemData)

      const [logsData, checkoutLogsData] = await Promise.all([
        supabase
          .from('item_logs')
          .select(`
            *,
            user:users(email)
          `)
          .eq('item_id', itemId)
          .order('timestamp', { ascending: false })
          .limit(20),
        supabase
          .from('checkout_logs')
          .select(`
            *,
            checked_out_to_user:users!checkout_logs_checked_out_to_user_id_fkey(email),
            performed_by_user:users!checkout_logs_performed_by_fkey(email)
          `)
          .eq('item_id', itemId)
          .order('checked_out_at', { ascending: false })
      ])

      setLogs(consolidateLogs(logsData.data || []))
      setCheckoutLogs(checkoutLogsData.data || [])
    } catch (error) {
      console.error('Error fetching item:', error)
    } finally {
      setLoading(false)
    }
  }


  const handleQuantityChange = async (delta) => {
    if (!item || item.is_unique) return

    const newQuantity = Math.max(0, item.quantity + delta)
    const { error } = await supabase
      .from('items')
      .update({ quantity: newQuantity })
      .eq('id', itemId)

    if (!error) {
      fetchItemData()
    }
  }

  const startEditingQuantity = () => {
    if (!canEdit || item.is_unique) return
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

    const { error } = await supabase
      .from('items')
      .update({ quantity: newQuantity })
      .eq('id', itemId)

    if (!error) {
      await fetchItemData()
      setEditingQuantity(false)
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
      navigate('/locations')
    }
  }

  const formatFieldName = (key) => {
    const fieldNames = {
      name: 'Name',
      brand: 'Brand',
      model: 'Model',
      serial_number: 'Serial Number',
      quantity: 'Quantity',
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

  const formatValue = (value) => {
    if (value === null || value === undefined) return 'None'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'string' && value.length === 0) return '(empty)'
    // Check if it's a UUID (category_id, location_id, etc)
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
                <p className="text-xs sm:text-sm text-muted-foreground">Location</p>
                <p className="font-medium text-sm sm:text-base truncate" title={item.location?.path || 'Unknown'}>{item.location?.path || 'Unknown'}</p>
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
                          <p className="text-lg font-semibold">{log.checked_out_to}</p>
                        </div>

                        <div className="text-xs text-muted-foreground space-y-0.5 mb-3">
                          <p>
                            <span className="font-medium">Checked Out:</span>{' '}
                            {new Date(log.checked_out_at).toLocaleString()}
                          </p>
                          {log.checked_in_at && (
                            <p>
                              <span className="font-medium">Checked In:</span>{' '}
                              {new Date(log.checked_in_at).toLocaleString()}
                            </p>
                          )}
                          <p>
                            <span className="font-medium">Performed By:</span> {log.performed_by_user?.email}
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
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium capitalize ${
                            log.action === 'create'
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
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <p className="text-sm mb-2">
                      <span className="font-medium">{log.user?.email}</span>
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
                                    <span className="font-medium">{formatValue(value)}</span>
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
                                        {formatValue(oldValue)}
                                      </span>
                                      {' → '}
                                      <span className="text-green-600 dark:text-green-400 font-medium">
                                        {formatValue(newValue)}
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
                                        {new Date(individualLog.timestamp).toLocaleString()}
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
                                                  <span className="text-red-600 dark:text-red-400">{formatValue(oldVal)}</span>
                                                  {' → '}
                                                  <span className="text-green-600 dark:text-green-400">{formatValue(newVal)}</span>
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
        </div>

        <div className="space-y-3 sm:space-y-4">
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
                  className={`text-2xl sm:text-3xl font-bold ${canEdit && !item.is_unique ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
                  title={canEdit && !item.is_unique ? 'Click to edit quantity' : ''}
                >
                  {item.quantity}
                </span>
              )}
              {!item.is_unique && canEdit && !editingQuantity && (
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
            {!item.is_unique && canEdit && (
              <p className="text-xs text-muted-foreground">Click number to set value, or use +/- buttons</p>
            )}
          </div>

          <div className="bg-card border rounded-lg p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Status</h3>
            {item.checkout_log_id ? (
              <div>
                <div className="flex items-center gap-2 mb-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-md">
                  <UserCheck className="h-4 w-4" />
                  <div className="flex-1 text-sm">
                    <p className="font-medium">Checked Out</p>
                    <p className="text-xs text-muted-foreground">
                      {checkoutLogs.find(log => !log.checked_in_at)?.checked_out_to || 'Unknown'}
                    </p>
                  </div>
                </div>

                {canEdit && (
                  <button
                    onClick={() => setShowCheckinModal(true)}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90"
                  >
                    <UserX className="h-4 w-4" />
                    Check In
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-4 p-3 bg-green-100 dark:bg-green-900/30 rounded-md">
                  <UserCheck className="h-4 w-4" />
                  <p className="text-sm font-medium">Available</p>
                </div>

                {canEdit && (
                  <button
                    onClick={() => setShowCheckoutModal(true)}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90"
                  >
                    <UserCheck className="h-4 w-4" />
                    Check Out
                  </button>
                )}
              </div>
            )}
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
    </div>
  )
}
