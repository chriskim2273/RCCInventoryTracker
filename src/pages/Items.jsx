import { useState, useEffect, useCallback, memo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Package, CheckCircle, Trash2, MapPin, X, Plus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { calculateItemAvailability, getItemStatus, formatItemStatus } from '@/lib/itemUtils'
import { fuzzySearchItems } from '@/lib/fuzzySearch'
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal'
import ItemModal from '@/components/ItemModal'
import SearchBar from '@/components/SearchBar'
import { aiSearch } from '@/lib/aiSearch'

// Memoized Mobile Item Card Component
const MobileItemCard = memo(({ item, isSelected, canEdit, onToggleSelect, currentSearchParams }) => {
  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex gap-3 mb-3">
        {canEdit && (
          <div className="flex items-start pt-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(item.id)}
              className="w-4 h-4 rounded border-gray-300 cursor-pointer"
            />
          </div>
        )}
        {item.image_url && (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-16 h-16 rounded-md object-cover flex-shrink-0 border"
            onError={(e) => {
              e.target.style.display = 'none'
            }}
          />
        )}
        <div className="flex items-start justify-between gap-3 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <Link
              to={`/items/${item.id}`}
              state={{ from: '/items', search: currentSearchParams }}
              className="text-primary hover:underline font-medium text-base block truncate"
            >
              {item.name}
            </Link>
            {item.brand && (
              <p className="text-sm text-muted-foreground mt-0.5">{item.brand}</p>
            )}
            {item.serial_number && (
              <p className="text-xs text-muted-foreground mt-0.5">SN: {item.serial_number}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <span className="text-muted-foreground">Category:</span>
          <div className="font-medium mt-0.5">
            {item.category?.icon && <span className="mr-1">{item.category.icon}</span>}
            {item.category?.name || 'Uncategorized'}
          </div>
        </div>
        <div>
          <span className="text-muted-foreground">Quantity:</span>
          <div className="font-medium mt-0.5">{item.quantity === null ? 'Unknown' : item.quantity}</div>
        </div>
        <div className="col-span-2">
          <span className="text-muted-foreground">Location:</span>
          <div className="font-medium mt-0.5 truncate">{item.location?.path || 'Unknown'}</div>
        </div>
        <div className="col-span-2">
          {(() => {
            const status = getItemStatus(item, item.availableQuantity, item.checkedOutQuantity)
            const statusText = formatItemStatus(status, item.availableQuantity, item.quantity)

            let bgColor = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            if (status === 'out_of_stock') {
              bgColor = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            } else if (status === 'fully_checked_out') {
              bgColor = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
            } else if (status === 'partially_available') {
              bgColor = 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
            }

            return (
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${bgColor}`}>
                {statusText}
              </span>
            )
          })()}
        </div>
      </div>
    </div>
  )
})

MobileItemCard.displayName = 'MobileItemCard'

// Memoized Desktop Item Row Component
const DesktopItemRow = memo(({ item, isSelected, canEdit, onToggleSelect, currentSearchParams }) => {
  return (
    <tr className="hover:bg-muted/30 transition-colors">
      {canEdit && (
        <td className="px-4 py-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(item.id)}
            className="w-4 h-4 rounded border-gray-300 cursor-pointer"
          />
        </td>
      )}
      <td className="px-4 py-3">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-12 h-12 rounded-md object-cover border"
            onError={(e) => {
              e.target.style.display = 'none'
            }}
          />
        ) : (
          <div className="w-12 h-12 rounded-md bg-muted border flex items-center justify-center">
            <Package className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <div>
          <Link
            to={`/items/${item.id}`}
            state={{ from: '/items', search: currentSearchParams }}
            className="text-primary hover:underline font-medium"
          >
            {item.name}
          </Link>
          {item.brand && (
            <span className="text-sm text-muted-foreground ml-2">({item.brand})</span>
          )}
          {item.serial_number && (
            <div className="text-xs text-muted-foreground mt-0.5">SN: {item.serial_number}</div>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1 text-sm">
          {item.category?.icon && <span>{item.category.icon}</span>}
          {item.category?.name || 'Uncategorized'}
        </span>
      </td>
      <td className="px-4 py-3 text-sm">{item.location?.path || 'Unknown'}</td>
      <td className="px-4 py-3 text-sm">{item.quantity === null ? 'Unknown' : item.quantity}</td>
      <td className="px-4 py-3">
        {(() => {
          const status = getItemStatus(item, item.availableQuantity, item.checkedOutQuantity)
          const statusText = formatItemStatus(status, item.availableQuantity, item.quantity)

          let bgColor = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          if (status === 'out_of_stock') {
            bgColor = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          } else if (status === 'fully_checked_out') {
            bgColor = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
          } else if (status === 'partially_available') {
            bgColor = 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
          }

          return (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${bgColor}`}>
              {statusText}
            </span>
          )
        })()}
      </td>
    </tr>
  )
})

DesktopItemRow.displayName = 'DesktopItemRow'

export default function Items() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState([])
  const [filteredItems, setFilteredItems] = useState([])
  const [categories, setCategories] = useState([])
  const [locations, setLocations] = useState([])
  const [selectedItems, setSelectedItems] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [sublocationIds, setSublocationIds] = useState([])
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [moveToLocationId, setMoveToLocationId] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [aiMatchingIds, setAiMatchingIds] = useState([])
  const [aiSearchError, setAiSearchError] = useState(null)
  const [showItemModal, setShowItemModal] = useState(false)
  const { canEdit, user } = useAuth()

  // Derive filter state directly from URL params (single source of truth)
  const searchQuery = searchParams.get('search') || ''
  const useAiSearch = searchParams.get('ai') === '1'
  const selectedCategory = searchParams.get('category') || null
  const selectedStatus = searchParams.get('status') || 'all'
  const selectedLocation = searchParams.get('location') || null

  // Helper to update URL params
  const updateParams = useCallback((updates) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '' || value === 'all') {
          newParams.delete(key)
        } else {
          newParams.set(key, String(value))
        }
      })
      return newParams
    }, { replace: true })
  }, [setSearchParams])

  useEffect(() => {
    fetchData()
  }, [])

  // Re-fetch locations when the page becomes visible again (to catch renames)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Refresh locations data to catch any name changes made elsewhere
        const refreshLocations = async () => {
          const { data: locationsData } = await supabase
            .from('locations')
            .select('*')
            .is('deleted_at', null)
            .order('path')
          if (locationsData) {
            setLocations(locationsData)
          }
        }
        refreshLocations()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Filter items when dependencies change
  useEffect(() => {
    filterItems()
  }, [items, selectedCategory, selectedStatus, selectedLocation, searchQuery, sublocationIds, useAiSearch, aiMatchingIds])

  useEffect(() => {
    if (selectedLocation) {
      getAllSublocationIds(selectedLocation)
    } else {
      setSublocationIds([])
    }
  }, [selectedLocation, locations])

  // AI Search Effect
  useEffect(() => {
    if (!useAiSearch || !searchQuery.trim()) {
      setAiMatchingIds([])
      setAiSearchError(null)
      return
    }

    const performAiSearch = async () => {
      setSearchLoading(true)
      setAiSearchError(null)
      try {
        const matchingIds = await aiSearch(items, searchQuery)
        setAiMatchingIds(matchingIds)
      } catch (error) {
        console.error('AI search failed:', error)
        setAiSearchError(error.message)
        setAiMatchingIds([])
      } finally {
        setSearchLoading(false)
      }
    }

    performAiSearch()
  }, [useAiSearch, searchQuery, items])

  // Scroll persistence - save scroll position when navigating away
  useEffect(() => {
    return () => {
      sessionStorage.setItem('items-scroll', String(window.scrollY))
    }
  }, [])

  // Scroll persistence - restore scroll position after content loads
  useEffect(() => {
    if (!loading && filteredItems.length > 0) {
      const savedScroll = sessionStorage.getItem('items-scroll')
      if (savedScroll) {
        requestAnimationFrame(() => {
          window.scrollTo(0, parseInt(savedScroll, 10))
        })
        sessionStorage.removeItem('items-scroll')
      }
    }
  }, [loading, filteredItems.length])

  // Recursively get all sublocation IDs for a given location
  const getAllSublocationIds = async (locationId) => {
    // Immediately set the current location ID so filtering works right away
    setSublocationIds([locationId])

    const allIds = [locationId]
    const queue = [locationId]

    while (queue.length > 0) {
      const currentId = queue.shift()

      // Get all direct children of current location
      const children = locations.filter(loc => loc.parent_id === currentId)

      for (const child of children) {
        if (!allIds.includes(child.id)) {
          allIds.push(child.id)
          queue.push(child.id)
        }
      }
    }

    // Update with full list including sublocations
    setSublocationIds(allIds)
  }

  const fetchData = async () => {
    setLoading(true)

    try {
      const [itemsResult, categoriesResult, locationsData, checkoutLogsResult] = await Promise.all([
        supabase
          .from('items')
          .select(`
            *,
            category:categories(name, icon),
            location:locations(name, path)
          `)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase.from('categories').select('*').is('deleted_at', null).order('name'),
        supabase.from('locations').select('*').is('deleted_at', null).order('path'),
        supabase
          .from('checkout_logs')
          .select('*')
          .is('checked_in_at', null),
      ])

      if (itemsResult.data) {
        // Group checkout logs by item_id
        const checkoutsByItem = {}
        if (checkoutLogsResult.data) {
          checkoutLogsResult.data.forEach(log => {
            if (!checkoutsByItem[log.item_id]) {
              checkoutsByItem[log.item_id] = []
            }
            checkoutsByItem[log.item_id].push(log)
          })
        }

        // Calculate availability for each item
        const itemsWithAvailability = await Promise.all(
          itemsResult.data.map(async (item) => {
            const activeCheckouts = checkoutsByItem[item.id] || []
            const availability = await calculateItemAvailability(item, activeCheckouts)
            return {
              ...item,
              ...availability
            }
          })
        )

        setItems(itemsWithAvailability)
      }

      if (categoriesResult.data) {
        setCategories(categoriesResult.data)
      }

      if (locationsData.data) {
        setLocations(locationsData.data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterItems = () => {
    let filtered = [...items]

    // Filter by search query (AI or fuzzy)
    if (searchQuery) {
      if (useAiSearch && aiMatchingIds.length > 0) {
        // Use AI search results
        filtered = filtered.filter((item) => aiMatchingIds.includes(item.id))
      } else if (!useAiSearch) {
        // Use fuzzy search (searches name, description, brand, model, serial_number, asset tag)
        filtered = fuzzySearchItems(filtered, searchQuery)
      }
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter((item) => item.category_id === selectedCategory)
    }

    // Filter by status
    if (selectedStatus === 'available') {
      filtered = filtered.filter((item) => item.checkedOutQuantity === 0 && item.quantity !== null && item.quantity > 0)
    } else if (selectedStatus === 'checked_out') {
      filtered = filtered.filter((item) => item.checkedOutQuantity > 0)
    }

    // Filter by location (includes sublocations)
    if (selectedLocation && sublocationIds.length > 0) {
      filtered = filtered.filter((item) => sublocationIds.includes(item.location_id))
    }

    setFilteredItems(filtered)
  }

  const handleRegularSearch = useCallback((inputValue) => {
    setSearchLoading(true)
    setAiSearchError(null)
    setAiMatchingIds([])
    updateParams({ search: inputValue, ai: null })
    // Simulate brief loading for UI consistency
    setTimeout(() => {
      setSearchLoading(false)
    }, 100)
  }, [updateParams])

  const handleAiSearch = useCallback((inputValue) => {
    updateParams({ search: inputValue, ai: '1' })
  }, [updateParams])

  const handleClearSearch = useCallback(() => {
    setAiMatchingIds([])
    setAiSearchError(null)
    updateParams({ search: null, ai: null })
  }, [updateParams])

  const toggleSelectItem = useCallback((itemId) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }, [])

  const exportToCSV = () => {
    const headers = ['Name', 'Brand', 'Serial Number', 'Total Qty', 'Available Qty', 'Checked Out Qty', 'Category', 'Location', 'Status']
    const rows = filteredItems.map((item) => {
      const status = getItemStatus(item, item.availableQuantity, item.checkedOutQuantity)
      const statusText = formatItemStatus(status, item.availableQuantity, item.quantity)

      return [
        item.name,
        item.brand || '',
        item.serial_number || '',
        item.quantity === null ? 'Unknown' : item.quantity,
        item.availableQuantity === null ? 'N/A' : item.availableQuantity,
        item.checkedOutQuantity,
        item.category?.name || '',
        item.location?.path || '',
        statusText,
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventory-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.id)))
    }
  }

  const handleBulkDelete = async () => {
    const { error } = await supabase
      .from('items')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user?.id,
      })
      .in('id', Array.from(selectedItems))

    if (error) {
      console.error('Error deleting items:', error)
      alert('Failed to delete items. Please try again.')
      throw error
    }

    await fetchData()
    setSelectedItems(new Set())
  }

  const handleBulkMove = async () => {
    if (!moveToLocationId) {
      alert('Please select a location')
      return
    }

    setIsProcessing(true)
    try {
      const { error } = await supabase
        .from('items')
        .update({ location_id: moveToLocationId })
        .in('id', Array.from(selectedItems))

      if (error) throw error

      await fetchData()
      setSelectedItems(new Set())
      setShowMoveModal(false)
      setMoveToLocationId('')
    } catch (error) {
      console.error('Error moving items:', error)
      alert('Failed to move items. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">All Items</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Browse and manage your entire inventory</p>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <SearchBar
          onRegularSearch={handleRegularSearch}
          onAiSearch={handleAiSearch}
          onClearSearch={handleClearSearch}
          onExportCSV={exportToCSV}
          searchLoading={searchLoading}
          useAiSearch={useAiSearch}
          activeSearchQuery={searchQuery}
          aiSearchError={aiSearchError}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Category</label>
            <select
              value={selectedCategory || ''}
              onChange={(e) => updateParams({ category: e.target.value || null })}
              className="w-full px-3 py-2 text-sm sm:text-base border rounded-md bg-background"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => updateParams({ status: e.target.value })}
              className="w-full px-3 py-2 text-sm sm:text-base border rounded-md bg-background"
            >
              <option value="all">All Statuses</option>
              <option value="available">Available</option>
              <option value="checked_out">Checked Out</option>
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Location</label>
            <select
              value={selectedLocation || ''}
              onChange={(e) => updateParams({ location: e.target.value || null })}
              className="w-full px-3 py-2 text-sm sm:text-base border rounded-md bg-background"
            >
              <option value="">All Locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.path}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-lg sm:text-xl font-semibold">
            Items ({filteredItems.length})
          </h2>
          {canEdit && (
            <button
              onClick={() => setShowItemModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Loading...</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No items found. {searchQuery || selectedCategory || selectedStatus !== 'all' || selectedLocation ? 'Try adjusting your filters.' : 'Start by adding items to your inventory.'}
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="lg:hidden space-y-3">
              {filteredItems.map((item) => (
                <MobileItemCard
                  key={item.id}
                  item={item}
                  isSelected={selectedItems.has(item.id)}
                  canEdit={canEdit}
                  onToggleSelect={toggleSelectItem}
                  currentSearchParams={searchParams.toString()}
                />
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block bg-card border rounded-lg overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    {canEdit && (
                      <th className="px-4 py-3 w-12">
                        <input
                          type="checkbox"
                          checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 w-16"></th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Location</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Quantity</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredItems.map((item) => (
                    <DesktopItemRow
                      key={item.id}
                      item={item}
                      isSelected={selectedItems.has(item.id)}
                      canEdit={canEdit}
                      onToggleSelect={toggleSelectItem}
                      currentSearchParams={searchParams.toString()}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {canEdit && selectedItems.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-lg p-4 z-50">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => setSelectedItems(new Set())}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowMoveModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm"
              >
                <MapPin className="h-4 w-4" />
                Move
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors text-sm"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleBulkDelete}
        title="Delete Items"
        itemName={selectedItems.size === 1
          ? items.find(item => selectedItems.has(item.id))?.name || 'Item'
          : `${selectedItems.size} items`
        }
        itemType="item"
        userEmail={user?.email || ''}
        affectedData={{
          items: items.filter(item => selectedItems.has(item.id))
        }}
      />

      {/* Item Create Modal */}
      <ItemModal
        isOpen={showItemModal}
        onClose={() => setShowItemModal(false)}
        onSuccess={() => {
          setShowItemModal(false)
          fetchData()
        }}
      />

      {/* Move Location Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Move Items</h3>
              <button
                onClick={() => {
                  setShowMoveModal(false)
                  setMoveToLocationId('')
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Move {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} to a new location.
            </p>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Select Location</label>
              <select
                value={moveToLocationId}
                onChange={(e) => setMoveToLocationId(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="">Choose a location...</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.path}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowMoveModal(false)
                  setMoveToLocationId('')
                }}
                disabled={isProcessing}
                className="px-4 py-2 border rounded-md hover:bg-secondary transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkMove}
                disabled={isProcessing || !moveToLocationId}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm disabled:opacity-50"
              >
                {isProcessing ? 'Moving...' : 'Move'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
