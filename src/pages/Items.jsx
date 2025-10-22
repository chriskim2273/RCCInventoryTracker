import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Package, Search, Download, CheckCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { calculateItemAvailability, getItemStatus, formatItemStatus } from '@/lib/itemUtils'

export default function Items() {
  const [items, setItems] = useState([])
  const [filteredItems, setFilteredItems] = useState([])
  const [categories, setCategories] = useState([])
  const [locations, setLocations] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItems, setSelectedItems] = useState([])
  const [loading, setLoading] = useState(true)
  const { canEdit } = useAuth()

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    filterItems()
  }, [items, selectedCategory, selectedStatus, selectedLocation, searchQuery])

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

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (item) =>
          item.name?.toLowerCase().includes(query) ||
          item.brand?.toLowerCase().includes(query) ||
          item.serial_number?.toLowerCase().includes(query)
      )
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter((item) => item.category_id === selectedCategory)
    }

    // Filter by status
    if (selectedStatus === 'available') {
      filtered = filtered.filter((item) => item.checkedOutQuantity === 0 && item.quantity > 0)
    } else if (selectedStatus === 'checked_out') {
      filtered = filtered.filter((item) => item.checkedOutQuantity > 0)
    }

    // Filter by location
    if (selectedLocation) {
      filtered = filtered.filter((item) => item.location_id === selectedLocation)
    }

    setFilteredItems(filtered)
  }

  const toggleSelectItem = (itemId) => {
    setSelectedItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    )
  }

  const exportToCSV = () => {
    const headers = ['Name', 'Brand', 'Serial Number', 'Total Qty', 'Available Qty', 'Checked Out Qty', 'Category', 'Location', 'Status']
    const rows = filteredItems.map((item) => {
      const status = getItemStatus(item, item.availableQuantity, item.checkedOutQuantity)
      const statusText = formatItemStatus(status, item.availableQuantity, item.quantity)

      return [
        item.name,
        item.brand || '',
        item.serial_number || '',
        item.quantity,
        item.availableQuantity,
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

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">All Items</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Browse and manage your entire inventory</p>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm sm:text-base border rounded-md bg-background"
            />
          </div>
          <button
            onClick={exportToCSV}
            className="flex items-center justify-center gap-2 px-4 py-2 border rounded-md hover:bg-secondary transition-colors text-sm sm:text-base whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Category</label>
            <select
              value={selectedCategory || ''}
              onChange={(e) => setSelectedCategory(e.target.value || null)}
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
              onChange={(e) => setSelectedStatus(e.target.value)}
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
              onChange={(e) => setSelectedLocation(e.target.value || null)}
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
                <div key={item.id} className="bg-card border rounded-lg p-4">
                  <div className="flex gap-3 mb-3">
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
                          className="text-primary hover:underline font-medium text-base block truncate"
                        >
                          {item.name}
                        </Link>
                        {item.brand && (
                          <p className="text-sm text-muted-foreground mt-0.5">{item.brand}</p>
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
                      <div className="font-medium mt-0.5">{item.quantity}</div>
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
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block bg-card border rounded-lg overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
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
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
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
                        <Link
                          to={`/items/${item.id}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {item.name}
                        </Link>
                        {item.brand && (
                          <span className="text-sm text-muted-foreground ml-2">({item.brand})</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-sm">
                          {item.category?.icon && <span>{item.category.icon}</span>}
                          {item.category?.name || 'Uncategorized'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{item.location?.path || 'Unknown'}</td>
                      <td className="px-4 py-3 text-sm">{item.quantity}</td>
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
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
